import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { z } from "zod";
import type { TenantContext } from "@/types/auth";

// NOTE: tenantId is intentionally NOT accepted from the request. A broadcast is
// always scoped to the caller's own tenant (ctx.tenantId); allowing a
// client-supplied tenantId let an admin notify users in OTHER tenants.
const broadcastSchema = z.object({
  title: z.string().min(1).max(255),
  body: z.string().optional(),
});

export const POST = withTenant(
  async (req: NextRequest, ctx: TenantContext) => {
    try {
      if (ctx.role !== "ADMIN") {
        return errorResponse(
          "FORBIDDEN",
          "Admin access required",
          undefined,
          403
        );
      }

      const body = await req.json();
      const parsed = broadcastSchema.safeParse(body);

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

      const { title, body: notificationBody } = parsed.data;

      // Always scope the broadcast to the caller's own tenant.
      const users = await prisma.user.findMany({
        where: { tenantId: ctx.tenantId },
        select: { id: true, tenantId: true },
      });

      if (users.length === 0) {
        return errorResponse("NOT_FOUND", "No users found", undefined, 404);
      }

      await prisma.notification.createMany({
        data: users.map((user) => ({
          tenantId: user.tenantId,
          userId: user.id,
          type: "SYSTEM" as const,
          title,
          body: notificationBody,
        })),
      });

      return successResponse({
        sent_to: users.length,
        message: `Broadcast sent to ${users.length} users`,
      });
    } catch (error) {
      console.error(
        "POST /api/admin/notifications/broadcast error:",
        error
      );
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);
