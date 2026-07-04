import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { serializePage } from "@/lib/pages/serialize";
import { relinkIncomingWikilinks } from "@/lib/wikilinks/renameUpdater";
import { rebuildPageLinks } from "@/lib/wikilinks/indexer";
import { updateSearchIndexForPage } from "@/lib/search/indexer";
import { syncPageToFilesystem } from "@/lib/sync/SyncService";
import type { TenantContext } from "@/types/auth";

const pageIdSchema = z.string().uuid("Page ID must be a valid UUID");

/**
 * POST /api/pages/[id]/trash-restore
 *
 * Restores a soft-deleted (trashed) page. Dedicated to the `deletedAt`-based
 * trash mechanism — distinct from the chemistry Archive `restore` route, which
 * is parent-folder gated and left untouched.
 *
 * Semantics:
 * - Clears `deletedAt`/`deletedBy`.
 * - Restores under the original parent if that parent still exists and is
 *   itself alive; otherwise moves the page to the workspace root.
 * - Rebuilds the page's OWN outgoing links + search index.
 * - Best-effort re-links incoming wikilinks by scanning tenant content for
 *   broken (pageId null) nodes whose pageName matches the restored title.
 */
export const POST = withTenant(
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
        select: { id: true, title: true, parentId: true, deletedAt: true },
      });

      if (!page) {
        return errorResponse("NOT_FOUND", "Page not found", undefined, 404);
      }

      // Only trashed pages can be restored through this route.
      if (!page.deletedAt) {
        return errorResponse(
          "NOT_FOUND",
          "Page is not in the Trash",
          undefined,
          404
        );
      }

      // Decide the restore parent: keep the original parent only if it still
      // exists AND is itself alive; otherwise fall back to the workspace root.
      let restoreParentId: string | null = null;
      if (page.parentId) {
        const parent = await prisma.page.findFirst({
          where: {
            id: page.parentId,
            tenantId,
            deletedAt: null,
          },
          select: { id: true },
        });
        restoreParentId = parent ? parent.id : null;
      }

      // Position at the end of the destination sibling list.
      const maxPosition = await prisma.page.aggregate({
        where: { tenantId, parentId: restoreParentId },
        _max: { position: true },
      });

      const restored = await prisma.page.update({
        where: { id: page.id },
        data: {
          deletedAt: null,
          deletedBy: null,
          parentId: restoreParentId,
          position: (maxPosition._max.position ?? -1) + 1,
        },
      });

      // Rebuild the restored page's OWN outgoing links + search index so its
      // wikilinks resolve and its content is searchable again.
      await rebuildPageLinks(page.id, tenantId);
      await updateSearchIndexForPage(page.id, tenantId);

      // Best-effort re-link of incoming wikilinks left broken at trash time,
      // then rebuild the touched source pages' link rows.
      const { affectedPageIds } = await relinkIncomingWikilinks(
        page.id,
        restored.title,
        tenantId
      );
      for (const sourcePageId of affectedPageIds) {
        await rebuildPageLinks(sourcePageId, tenantId);
      }

      // Regenerate the filesystem mirror (fire-and-forget).
      syncPageToFilesystem(tenantId, page.id).catch((err) =>
        console.error("Sync after trash restore failed:", err)
      );

      return successResponse(serializePage(restored));
    } catch (error) {
      console.error("POST /api/pages/[id]/trash-restore error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);
