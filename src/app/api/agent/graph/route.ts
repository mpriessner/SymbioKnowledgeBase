import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withAgentAuth } from "@/lib/agent/auth";
import type { AgentContext } from "@/lib/agent/auth";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { z } from "zod";

const graphQuerySchema = z.object({
  pageId: z.string().uuid().optional(),
  depth: z.coerce.number().int().min(1).max(5).default(2),
});

/**
 * BFS expansion from a starting page, following wikilinks bidirectionally.
 */
async function expandGraphBFS(
  startPageId: string,
  depth: number,
  tenantId: string
): Promise<string[]> {
  const visited = new Set<string>([startPageId]);
  let currentLayer = [startPageId];

  for (let i = 0; i < depth; i++) {
    if (currentLayer.length === 0) break;

    const links = await prisma.pageLink.findMany({
      where: {
        tenantId,
        OR: [
          { sourcePageId: { in: currentLayer } },
          { targetPageId: { in: currentLayer } },
        ],
      },
      select: { sourcePageId: true, targetPageId: true },
    });

    const nextLayer = new Set<string>();
    links.forEach((link) => {
      if (!visited.has(link.sourcePageId)) {
        visited.add(link.sourcePageId);
        nextLayer.add(link.sourcePageId);
      }
      if (!visited.has(link.targetPageId)) {
        visited.add(link.targetPageId);
        nextLayer.add(link.targetPageId);
      }
    });

    currentLayer = Array.from(nextLayer);
  }

  return Array.from(visited);
}

/**
 * GET /api/agent/graph — Knowledge graph with BFS expansion
 */
export const GET = withAgentAuth(
  async (req: NextRequest, ctx: AgentContext) => {
    try {
      const { searchParams } = new URL(req.url);
      const queryParams = Object.fromEntries(searchParams.entries());

      const parsed = graphQuerySchema.safeParse(queryParams);
      if (!parsed.success) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Invalid query parameters",
          undefined,
          400
        );
      }

      const { pageId, depth } = parsed.data;

      let pageIds: string[];

      if (pageId) {
        // Local graph: BFS expansion from pageId
        pageIds = await expandGraphBFS(pageId, depth, ctx.tenantId);
      } else {
        // Global graph: all pages
        const pages = await prisma.page.findMany({
          where: { tenantId: ctx.tenantId },
          select: { id: true },
        });
        pageIds = pages.map((p) => p.id);
      }

      // Fetch nodes
      const nodes = await prisma.page.findMany({
        where: { id: { in: pageIds }, tenantId: ctx.tenantId },
        select: { id: true, title: true, icon: true },
      });

      // Fetch edges (wikilinks between the selected pages)
      const edges = await prisma.pageLink.findMany({
        where: {
          tenantId: ctx.tenantId,
          sourcePageId: { in: pageIds },
          targetPageId: { in: pageIds },
        },
        select: { sourcePageId: true, targetPageId: true },
      });

      // Calculate link counts
      const linkCounts = new Map<string, number>();
      edges.forEach((e) => {
        linkCounts.set(
          e.sourcePageId,
          (linkCounts.get(e.sourcePageId) ?? 0) + 1
        );
        linkCounts.set(
          e.targetPageId,
          (linkCounts.get(e.targetPageId) ?? 0) + 1
        );
      });

      const formattedNodes = nodes.map((n) => ({
        id: n.id,
        label: n.title,
        icon: n.icon,
        link_count: linkCounts.get(n.id) ?? 0,
      }));

      const formattedEdges = edges.map((e) => ({
        source: e.sourcePageId,
        target: e.targetPageId,
      }));

      return successResponse(
        { nodes: formattedNodes, edges: formattedEdges },
        {
          node_count: formattedNodes.length,
          edge_count: formattedEdges.length,
        }
      );
    } catch (error) {
      console.error("GET /api/agent/graph error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);
