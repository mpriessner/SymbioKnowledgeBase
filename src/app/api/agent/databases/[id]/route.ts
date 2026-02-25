import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withAgentAuth } from "@/lib/agent/auth";
import type { AgentContext } from "@/lib/agent/auth";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { z } from "zod";

type RouteContext = { params: Promise<Record<string, string>> };

/**
 * GET /api/agent/databases/:id — Get database schema and metadata
 */
export const GET = withAgentAuth(
  async (_req: NextRequest, ctx: AgentContext, routeContext: RouteContext) => {
    try {
      const { id } = await routeContext.params;

      if (!z.string().uuid().safeParse(id).success) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Invalid database ID",
          undefined,
          400
        );
      }

      const database = await prisma.database.findFirst({
        where: { id, tenantId: ctx.tenantId },
        include: {
          page: { select: { id: true, title: true, icon: true } },
          _count: { select: { rows: true } },
        },
      });

      if (!database) {
        return errorResponse(
          "NOT_FOUND",
          "Database not found",
          undefined,
          404
        );
      }

      return successResponse({
        id: database.id,
        title: database.page.title,
        page_id: database.pageId,
        icon: database.page.icon,
        schema: database.schema,
        row_count: database._count.rows,
        created_at: database.createdAt.toISOString(),
        updated_at: database.updatedAt.toISOString(),
      });
    } catch (error) {
      console.error("GET /api/agent/databases/:id error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);
