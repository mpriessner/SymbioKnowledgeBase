import { NextRequest } from "next/server";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { prisma } from "@/lib/db";
import { setupChemistryKbHierarchy } from "@/lib/chemistryKb/setupHierarchy";
import type { TenantContext } from "@/types/auth";

/**
 * POST /api/pages/[id]/restore
 * Restores an archived page back to the Experiments folder.
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

    // Only allow restoring from the Archive folder
    if (page.parentId !== hierarchy.archiveId) {
      return errorResponse(
        "BAD_REQUEST",
        "Page is not in the Archive folder",
        undefined,
        400
      );
    }

    // Move back to Experiments folder
    const maxPosition = await prisma.page.aggregate({
      where: { tenantId, parentId: hierarchy.experimentsId },
      _max: { position: true },
    });

    await prisma.page.update({
      where: { id: page.id },
      data: {
        parentId: hierarchy.experimentsId,
        position: (maxPosition._max.position ?? -1) + 1,
      },
    });

    return successResponse({ id: page.id, title: page.title, status: "restored" });
  }
);
