import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withAgentAuth } from "@/lib/agent/auth";
import type { AgentContext } from "@/lib/agent/auth";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { buildAgentPageTree, computeTreeMeta } from "@/lib/agent/pageTree";
import type { PageWithCounts } from "@/lib/agent/types";

/**
 * GET /api/agent/pages/tree — Full page hierarchy as a nested tree
 *
 * Enhanced with oneLiner, linkCount, childCount, and summaryStale fields.
 * Use GET /api/agent/pages?format=tree for filter support.
 */
export const GET = withAgentAuth(
  async (_req: NextRequest, ctx: AgentContext) => {
    try {
      const pages: PageWithCounts[] = await prisma.page.findMany({
        where: { tenantId: ctx.tenantId },
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          icon: true,
          oneLiner: true,
          parentId: true,
          position: true,
          spaceType: true,
          updatedAt: true,
          summaryUpdatedAt: true,
          _count: {
            select: {
              sourceLinks: true,
              targetLinks: true,
            },
          },
        },
      });

      const tree = buildAgentPageTree(pages);
      const meta = computeTreeMeta(pages);
      return successResponse({ pages: tree }, meta);
    } catch (error) {
      console.error("GET /api/agent/pages/tree error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);
