import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import type { TenantContext } from "@/types/auth";

export const GET = withTenant(
  async (_req: NextRequest, ctx: TenantContext) => {
    try {
      const count = await prisma.notification.count({
        where: {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          read: false,
        },
      });

      return successResponse({ count });
    } catch (error) {
      console.error("GET /api/notifications/unread-count error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);
