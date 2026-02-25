import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { z } from "zod";
import type { TenantContext } from "@/types/auth";

const updatePermissionSchema = z.object({
  permission: z.enum(["FULL_ACCESS", "CAN_EDIT", "CAN_COMMENT", "CAN_VIEW"]),
});

/** PATCH /api/pages/[id]/share/[shareId] — Update a share's permission */
export const PATCH = withTenant(
  async (
    req: NextRequest,
    ctx: TenantContext,
    routeContext: { params: Promise<Record<string, string>> }
  ) => {
    const { id: pageId, shareId } = await routeContext.params;
    const body = await req.json();
    const parsed = updatePermissionSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid request body",
        parsed.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
        400
      );
    }

    const share = await prisma.pageShare.findFirst({
      where: { id: shareId, pageId, tenantId: ctx.tenantId },
    });
    if (!share) {
      return errorResponse("NOT_FOUND", "Share not found", undefined, 404);
    }

    const updated = await prisma.pageShare.update({
      where: { id: shareId },
      data: { permission: parsed.data.permission },
    });

    return successResponse({
      id: updated.id,
      permission: updated.permission,
    });
  }
);

/** DELETE /api/pages/[id]/share/[shareId] — Remove a share */
export const DELETE = withTenant(
  async (
    req: NextRequest,
    ctx: TenantContext,
    routeContext: { params: Promise<Record<string, string>> }
  ) => {
    const { id: pageId, shareId } = await routeContext.params;

    const share = await prisma.pageShare.findFirst({
      where: { id: shareId, pageId, tenantId: ctx.tenantId },
    });
    if (!share) {
      return errorResponse("NOT_FOUND", "Share not found", undefined, 404);
    }

    await prisma.pageShare.delete({ where: { id: shareId } });

    return new NextResponse(null, { status: 204 });
  }
);
