import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { buildGraphData } from "@/lib/graph/builder";
import { GraphQuerySchema } from "@/types/graph";
import type { TenantContext } from "@/types/auth";

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

    return successResponse(graphData, {
      nodeCount: graphData.nodes.length,
      edgeCount: graphData.edges.length,
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
