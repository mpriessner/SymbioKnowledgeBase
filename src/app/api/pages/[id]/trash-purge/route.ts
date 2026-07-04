import fs from "fs/promises";
import path from "path";
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { markWikilinksAsDeleted } from "@/lib/wikilinks/renameUpdater";
import { adjustStorageUsed } from "@/lib/sync/attachments";
import { deletePageFile } from "@/lib/sync/SyncService";
import { MIRROR_ROOT } from "@/lib/sync/config";
import type { TenantContext } from "@/types/auth";

const pageIdSchema = z.string().uuid("Page ID must be a valid UUID");

/**
 * DELETE /api/pages/[id]/trash-purge
 *
 * Permanently deletes a soft-deleted (trashed) page: its blocks, links, and
 * attachments. Dedicated to the `deletedAt`-based trash mechanism — distinct
 * from the chemistry Archive `purge` route, which is parent-folder gated and
 * left untouched.
 *
 * Blocks and PageLinks cascade on `page.delete`, but `FileAttachment.pageId`
 * is `onDelete: SetNull` — so a bare delete would orphan the attachment rows,
 * leave their bytes on disk, and never reclaim `Tenant.storageUsed`. This route
 * therefore deletes the attachment rows explicitly, removes the stored files,
 * and decrements the storage counter through the shared accounting helper.
 */
export const DELETE = withTenant(
  async (
    _req: NextRequest,
    context: TenantContext,
    { params }
  ) => {
    try {
      const { id } = await params;
      const idParsed = pageIdSchema.safeParse(id);
      if (!idParsed.success) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Invalid page ID",
          undefined,
          400
        );
      }

      const { tenantId } = context;

      const page = await prisma.page.findFirst({
        where: { id: idParsed.data, tenantId },
        select: { id: true, title: true, deletedAt: true },
      });

      if (!page) {
        return errorResponse("NOT_FOUND", "Page not found", undefined, 404);
      }

      // Only trashed pages can be purged through this route.
      if (!page.deletedAt) {
        return errorResponse(
          "NOT_FOUND",
          "Page is not in the Trash",
          undefined,
          404
        );
      }

      // Gather the page's attachments up front so we can reclaim storage and
      // remove the on-disk bytes after the DB delete succeeds.
      const attachments = await prisma.fileAttachment.findMany({
        where: { pageId: page.id, tenantId },
        select: { id: true, fileSize: true, storagePath: true },
      });

      // Notify pages that still linked here (idempotent — trash already ran it).
      await markWikilinksAsDeleted(page.id, tenantId);

      // Delete attachment rows + the page (blocks and page_links cascade) in one
      // transaction so a mid-sequence failure can't orphan rows.
      await prisma.$transaction(async (tx) => {
        if (attachments.length > 0) {
          await tx.fileAttachment.deleteMany({
            where: { pageId: page.id, tenantId },
          });
        }
        await tx.page.delete({ where: { id: page.id } });
      });

      // Reclaim storage for the removed attachments through the single owner of
      // `storageUsed` mutations.
      const freedBytes = attachments.reduce(
        (sum, a) => sum + a.fileSize,
        BigInt(0)
      );
      if (freedBytes > BigInt(0)) {
        await adjustStorageUsed(tenantId, -freedBytes).catch((err) =>
          console.error("[trash-purge] storage accounting failed:", err)
        );
      }

      // Remove the stored attachment files (best-effort; DB is source of truth).
      const root = path.resolve(MIRROR_ROOT);
      for (const attachment of attachments) {
        const absPath = path.resolve(root, attachment.storagePath);
        if (absPath !== root && !absPath.startsWith(root + path.sep)) continue;
        await fs
          .unlink(absPath)
          .catch((err) =>
            console.error(
              `[trash-purge] Failed to remove file ${attachment.storagePath}:`,
              err
            )
          );
      }

      // Remove the page's markdown mirror file (best-effort).
      deletePageFile(tenantId, page.id).catch((err) =>
        console.error(
          `[trash-purge] Failed to delete mirror file for ${page.id}:`,
          err
        )
      );

      return successResponse({
        id: page.id,
        title: page.title,
        status: "purged",
      });
    } catch (error) {
      console.error("DELETE /api/pages/[id]/trash-purge error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);
