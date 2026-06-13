import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { buildGraphData } from "@/lib/graph/builder";
import { GraphQuerySchema } from "@/types/graph";
import type { GraphData } from "@/types/graph";
import type { TenantContext } from "@/types/auth";

/**
 * Max nodes returned for the GLOBAL graph. The force-directed canvas (2D and
 * especially the 3D/WebGL renderer) degrades badly past a few hundred nodes,
 * and an unbounded payload can freeze the browser tab on large tenants. We cap
 * to the top-N most-connected pages and report the true total so the client
 * can show a "showing N of M" notice. Local/depth mode is intentionally left
 * uncapped — it's already bounded by BFS depth.
 */
const GLOBAL_NODE_CAP = 500;

/**
 * Reduce a graph to its top-N nodes by connection count, pruning any edges
 * whose endpoints were dropped. Pure + side-effect free so it stays testable.
 */
export function capGraphToTopNodes(
  graph: GraphData,
  maxNodes: number
): GraphData {
  if (graph.nodes.length <= maxNodes) return graph;

  // Highest linkCount first; stable enough for a deterministic cap.
  const topNodes = [...graph.nodes]
    .sort((a, b) => b.linkCount - a.linkCount)
    .slice(0, maxNodes);

  const keptIds = new Set(topNodes.map((n) => n.id));
  const edges = graph.edges.filter(
    (e) => keptIds.has(e.source) && keptIds.has(e.target)
  );

  return { nodes: topNodes, edges };
}

/**
 * GET /api/graph
 * GET /api/graph?pageId=uuid&depth=2
 *
 * Returns knowledge graph data: nodes (pages) and edges (wikilinks).
 *
 * Query parameters:
 * - pageId (optional): UUID of center page for local graph mode
 * - depth (optional): BFS expansion depth, 1-5, default 2 (only with pageId)
 */
export const GET = withTenant(async (req: NextRequest, ctx: TenantContext) => {
  const { searchParams } = new URL(req.url);

  // Parse and validate query parameters
  const parseResult = GraphQuerySchema.safeParse({
    pageId: searchParams.get("pageId") || undefined,
    depth: searchParams.get("depth") || undefined,
  });

  if (!parseResult.success) {
    const fieldErrors = parseResult.error.flatten().fieldErrors;
    const details = Object.entries(fieldErrors).flatMap(([field, messages]) =>
      (messages ?? []).map((message) => ({ field, message }))
    );
    return errorResponse("VALIDATION_ERROR", "Invalid parameters", details, 400);
  }

  const { pageId, depth } = parseResult.data;

  try {
    // If pageId is provided, verify the page exists
    if (pageId) {
      const page = await prisma.page.findFirst({
        where: { id: pageId, tenantId: ctx.tenantId },
        select: { id: true },
      });

      if (!page) {
        return errorResponse("NOT_FOUND", "Page not found", undefined, 404);
      }
    }

    // Build graph data
    const graphData = await buildGraphData(ctx.tenantId, pageId, depth);

    // Cap only the global graph; local/depth mode is already bounded by BFS.
    const totalNodes = graphData.nodes.length;
    const responseData = pageId
      ? graphData
      : capGraphToTopNodes(graphData, GLOBAL_NODE_CAP);
    const truncated = responseData.nodes.length < totalNodes;

    return successResponse(responseData, {
      nodeCount: responseData.nodes.length,
      edgeCount: responseData.edges.length,
      totalNodes,
      truncated,
    });
  } catch (error) {
    console.error("Failed to build graph data:", error);
    return errorResponse(
      "INTERNAL_ERROR",
      "Failed to build graph data",
      undefined,
      500
    );
  }
});
