import { NextRequest } from "next/server";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { prisma } from "@/lib/db";
import type { TenantContext } from "@/types/auth";

type RouteContext = { params: Promise<Record<string, string>> };

/**
 * DELETE /api/settings/api-keys/:id — Revoke an API key
 */
export const DELETE = withTenant(
  async (
    _req: NextRequest,
    ctx: TenantContext,
    routeContext: RouteContext
  ) => {
    try {
      const { id } = await routeContext.params;

      const apiKey = await prisma.apiKey.findFirst({
        where: {
          id,
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          revokedAt: null,
        },
      });

      if (!apiKey) {
        return errorResponse(
          "NOT_FOUND",
          "API key not found",
          undefined,
          404
        );
      }

      await prisma.apiKey.update({
        where: { id },
        data: { revokedAt: new Date() },
      });

      return successResponse({ id, revoked: true });
    } catch (error) {
      console.error("DELETE /api/settings/api-keys/:id error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);
