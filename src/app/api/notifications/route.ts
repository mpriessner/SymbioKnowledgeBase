import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { listResponse, errorResponse } from "@/lib/apiResponse";
import { z } from "zod";
import type { TenantContext } from "@/types/auth";
import type { Prisma } from "@/generated/prisma/client";

const listNotificationsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  read: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

export const GET = withTenant(
  async (req: NextRequest, ctx: TenantContext) => {
    try {
      const { searchParams } = new URL(req.url);
      const queryParams = Object.fromEntries(searchParams.entries());

      const parsed = listNotificationsSchema.safeParse(queryParams);
      if (!parsed.success) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Invalid query parameters",
          parsed.error.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message,
          })),
          400
        );
      }

      const { limit, offset, read } = parsed.data;

      const where: Prisma.NotificationWhereInput = {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
      };

      if (read !== undefined) {
        where.read = read;
      }

      const [notifications, total, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where,
          include: {
            page: { select: { title: true } },
            sourceUser: { select: { name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
          skip: offset,
          take: limit,
        }),
        prisma.notification.count({ where }),
        prisma.notification.count({
          where: {
            tenantId: ctx.tenantId,
            userId: ctx.userId,
            read: false,
          },
        }),
      ]);

      const formatted = notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        page_id: n.pageId,
        page_title: n.page?.title ?? null,
        source_user_id: n.sourceUserId,
        source_user_name: n.sourceUser?.name || n.sourceUser?.email || null,
        read: n.read,
        created_at: n.createdAt.toISOString(),
      }));

      return listResponse(formatted, total, limit, offset, {
        unread_count: unreadCount,
      });
    } catch (error) {
      console.error("GET /api/notifications error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);
