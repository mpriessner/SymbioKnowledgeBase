import { NextRequest } from "next/server";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { prisma } from "@/lib/db";
import { setupChemistryKbHierarchy } from "@/lib/chemistryKb/setupHierarchy";
import { markWikilinksAsDeleted } from "@/lib/wikilinks/renameUpdater";
import { deletePageFile } from "@/lib/sync/SyncService";
import { extractPlainText } from "@/lib/search/indexer";
import type { Prisma } from "@/generated/prisma/client";
import type { TenantContext } from "@/types/auth";

/**
 * DELETE /api/pages/[id]/purge
 * Permanently deletes an archived page (hard delete).
 */
export const DELETE = withTenant(
  async (
    _req: NextRequest,
    context: TenantContext,
    { params }
  ) => {
    const { id } = await params;
    const { tenantId } = context;

    const page = await prisma.page.findFirst({
      where: { id, tenantId },
      select: { id: true, title: true, parentId: true },
    });

    if (!page) {
      return errorResponse("NOT_FOUND", "Page not found", undefined, 404);
    }

    const hierarchy = await setupChemistryKbHierarchy(tenantId);

    // Only allow purging from the Archive folder
    if (page.parentId !== hierarchy.archiveId) {
      return errorResponse(
        "BAD_REQUEST",
        "Only archived pages can be purged. Move to Archive first.",
        undefined,
        400
      );
    }

    // Notify linking pages (own writes; not part of the delete transaction).
    await markWikilinksAsDeleted(page.id, tenantId);

    // Snapshot the document content as a recoverable version BEFORE the hard
    // delete, then delete page + blocks + links atomically. Previously these
    // ran as separate statements with no transaction and no content capture, so
    // a mid-sequence failure could orphan rows and a purge was irreversible.
    const docBlock = await prisma.block.findFirst({
      where: { pageId: page.id, tenantId, type: "DOCUMENT" },
      select: { content: true },
    });

    await prisma.$transaction(async (tx) => {
      if (docBlock) {
        const latest = await tx.documentVersion.findFirst({
          where: { pageId: page.id },
          orderBy: { version: "desc" },
          select: { version: true },
        });
        await tx.documentVersion.create({
          data: {
            pageId: page.id,
            tenantId,
            version: (latest?.version ?? 0) + 1,
            content: docBlock.content as unknown as Prisma.InputJsonValue,
            plainText: extractPlainText(
              docBlock.content as Parameters<typeof extractPlainText>[0]
            ),
            changeType: "MANUAL",
            changeSource: context.userId,
            changeNotes: "Snapshot captured before page purge",
          },
        });
      }

      await tx.block.deleteMany({ where: { pageId: page.id } });
      await tx.pageLink.deleteMany({
        where: { OR: [{ sourcePageId: page.id }, { targetPageId: page.id }] },
      });
      await tx.page.delete({ where: { id: page.id } });
    });

    deletePageFile(tenantId, page.id).catch((err) =>
      console.error(`[pages/purge] Failed to delete mirror file for ${page.id}:`, err)
    );

    return successResponse(
      { id: page.id, title: page.title, status: "purged" },
      undefined,
      200
    );
  }
);
