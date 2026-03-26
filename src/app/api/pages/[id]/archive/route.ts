import { NextRequest } from "next/server";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { prisma } from "@/lib/db";
import { setupChemistryKbHierarchy } from "@/lib/chemistryKb/setupHierarchy";
import type { TenantContext } from "@/types/auth";

/**
 * POST /api/pages/[id]/archive
 * Moves a page to the Archive folder.
 */
export const POST = withTenant(
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

    // Already archived?
    if (page.parentId === hierarchy.archiveId) {
      return successResponse({ id: page.id, title: page.title, status: "already_archived" });
    }

    // Move to Archive folder
    const maxPosition = await prisma.page.aggregate({
      where: { tenantId, parentId: hierarchy.archiveId },
      _max: { position: true },
    });

    await prisma.page.update({
      where: { id: page.id },
      data: {
        parentId: hierarchy.archiveId,
        position: (maxPosition._max.position ?? -1) + 1,
      },
    });

    return successResponse({ id: page.id, title: page.title, status: "archived" });
  }
);
