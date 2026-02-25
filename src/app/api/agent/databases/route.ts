import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withAgentAuth } from "@/lib/agent/auth";
import type { AgentContext } from "@/lib/agent/auth";
import { listResponse, errorResponse } from "@/lib/apiResponse";

/**
 * GET /api/agent/databases — List all databases for the tenant
 */
export const GET = withAgentAuth(
  async (_req: NextRequest, ctx: AgentContext) => {
    try {
      const databases = await prisma.database.findMany({
        where: { tenantId: ctx.tenantId },
        include: {
          page: { select: { id: true, title: true, icon: true } },
          _count: { select: { rows: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      const data = databases.map((db) => ({
        id: db.id,
        title: db.page.title,
        page_id: db.pageId,
        icon: db.page.icon,
        column_count: ((db.schema as Record<string, unknown>)?.columns as unknown[] || []).length,
        row_count: db._count.rows,
        created_at: db.createdAt.toISOString(),
        updated_at: db.updatedAt.toISOString(),
      }));

      return listResponse(data, data.length, data.length, 0);
    } catch (error) {
      console.error("GET /api/agent/databases error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);
