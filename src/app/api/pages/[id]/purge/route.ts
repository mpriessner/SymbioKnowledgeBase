import { NextRequest } from "next/server";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { prisma } from "@/lib/db";
import { setupChemistryKbHierarchy } from "@/lib/chemistryKb/setupHierarchy";
import { markWikilinksAsDeleted } from "@/lib/wikilinks/renameUpdater";
import { deletePageFile } from "@/lib/sync/SyncService";
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

    // Hard delete
    await markWikilinksAsDeleted(page.id, tenantId);
    await prisma.block.deleteMany({ where: { pageId: page.id } });
    await prisma.pageLink.deleteMany({
      where: { OR: [{ sourcePageId: page.id }, { targetPageId: page.id }] },
    });
    await prisma.page.delete({ where: { id: page.id } });
    deletePageFile(tenantId, page.id).catch(() => {});

    return successResponse(
      { id: page.id, title: page.title, status: "purged" },
      undefined,
      200
    );
  }
);
