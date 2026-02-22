import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import type { TenantContext } from "@/types/auth";

export const PATCH = withTenant(
  async (
    _req: NextRequest,
    ctx: TenantContext,
    routeContext: { params: Promise<Record<string, string>> }
  ) => {
    try {
      const { id } = await routeContext.params;

      const notification = await prisma.notification.findFirst({
        where: {
          id,
          tenantId: ctx.tenantId,
          userId: ctx.userId,
        },
      });

      if (!notification) {
        return errorResponse(
          "NOT_FOUND",
          "Notification not found",
          undefined,
          404
        );
      }

      const updated = await prisma.notification.update({
        where: { id },
        data: { read: true },
      });

      return successResponse({
        id: updated.id,
        read: updated.read,
      });
    } catch (error) {
      console.error("PATCH /api/notifications/:id/read error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);
