import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import type { TenantContext } from "@/types/auth";

// GET /api/pages/:id/presence — Get active users on a page
export const GET = withTenant(
  async (
    _req: NextRequest,
    ctx: TenantContext,
    routeContext: { params: Promise<Record<string, string>> }
  ) => {
    try {
      const { id: pageId } = await routeContext.params;

      // Active = heartbeat within last 10 seconds
      const cutoffTime = new Date(Date.now() - 10 * 1000);

      const presenceRecords = await prisma.pagePresence.findMany({
        where: {
          pageId,
          tenantId: ctx.tenantId,
          userId: { not: ctx.userId },
          lastHeartbeat: { gte: cutoffTime },
        },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      const data = presenceRecords.map((record) => ({
        userId: record.userId,
        userName: record.user.name || record.user.email,
        userAvatar: null,
        lastSeen: record.lastHeartbeat.toISOString(),
        isEditing: record.isEditing,
      }));

      return successResponse(data);
    } catch (error) {
      console.error("GET /api/pages/:id/presence error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);
