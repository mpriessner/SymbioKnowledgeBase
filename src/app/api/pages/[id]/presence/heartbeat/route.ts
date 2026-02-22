import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { z } from "zod";
import type { TenantContext } from "@/types/auth";

const heartbeatSchema = z.object({
  isEditing: z.boolean().default(false),
});

// POST /api/pages/:id/presence/heartbeat — Send presence heartbeat
export const POST = withTenant(
  async (
    req: NextRequest,
    ctx: TenantContext,
    routeContext: { params: Promise<Record<string, string>> }
  ) => {
    try {
      const { id: pageId } = await routeContext.params;

      const body = await req.json();
      const parsed = heartbeatSchema.safeParse(body);

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

      // Verify page exists in tenant
      const page = await prisma.page.findFirst({
        where: { id: pageId, tenantId: ctx.tenantId },
        select: { id: true },
      });

      if (!page) {
        return errorResponse("NOT_FOUND", "Page not found", undefined, 404);
      }

      // Upsert presence record
      await prisma.pagePresence.upsert({
        where: {
          pageId_userId: { pageId, userId: ctx.userId },
        },
        create: {
          pageId,
          userId: ctx.userId,
          tenantId: ctx.tenantId,
          lastHeartbeat: new Date(),
          isEditing: parsed.data.isEditing,
        },
        update: {
          lastHeartbeat: new Date(),
          isEditing: parsed.data.isEditing,
        },
      });

      return successResponse({ success: true });
    } catch (error) {
      console.error("POST /api/pages/:id/presence/heartbeat error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);
