import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import type { TenantContext } from "@/types/auth";

export const POST = withTenant(
  async (_req: NextRequest, ctx: TenantContext) => {
    try {
      const result = await prisma.notification.updateMany({
        where: {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          read: false,
        },
        data: { read: true },
      });

      return successResponse({
        marked_read: result.count,
      });
    } catch (error) {
      console.error("POST /api/notifications/read-all error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);
