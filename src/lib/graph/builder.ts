import { prisma } from "@/lib/db";
import type { GraphData, GraphNode, GraphEdge } from "@/types/graph";

/**
 * Builds graph data for the knowledge graph visualization.
 *
 * Two modes:
 * 1. Global graph (no pageId): returns ALL pages and links for the tenant
 * 2. Local graph (with pageId + depth): returns N-hop BFS expansion from the specified page
 */
export async function buildGraphData(
  tenantId: string,
  pageId?: string,
  depth: number = 2
): Promise<GraphData> {
  if (pageId) {
    return buildLocalGraph(tenantId, pageId, depth);
  }
  return buildGlobalGraph(tenantId);
}

/**
 * Builds the global graph: all pages and all links for the tenant.
 */
async function buildGlobalGraph(tenantId: string): Promise<GraphData> {
  const [pages, links] = await Promise.all([
    prisma.page.findMany({
      where: { tenantId },
      select: {
        id: true,
        title: true,
        icon: true,
        updatedAt: true,
      },
    }),
    prisma.pageLink.findMany({
      where: { tenantId },
      select: {
        sourcePageId: true,
        targetPageId: true,
      },
    }),
  ]);

  // Compute link counts per page (incoming + outgoing)
  const linkCounts = new Map<string, number>();
  for (const link of links) {
    linkCounts.set(
      link.sourcePageId,
      (linkCounts.get(link.sourcePageId) || 0) + 1
    );
    linkCounts.set(
      link.targetPageId,
      (linkCounts.get(link.targetPageId) || 0) + 1
    );
  }

  // Build nodes
  const nodes: GraphNode[] = pages.map((page) => ({
    id: page.id,
    label: page.title,
    icon: page.icon,
    linkCount: linkCounts.get(page.id) || 0,
    updatedAt: page.updatedAt.toISOString(),
  }));

  // Build edges (only include edges where both source and target exist)
  const pageIds = new Set(pages.map((p) => p.id));
  const edges: GraphEdge[] = links
    .filter(
      (link) =>
        pageIds.has(link.sourcePageId) && pageIds.has(link.targetPageId)
    )
    .map((link) => ({
      source: link.sourcePageId,
      target: link.targetPageId,
    }));

  return { nodes, edges };
}

/**
 * Builds a local graph: N-hop BFS expansion from the specified page.
 */
async function buildLocalGraph(
  tenantId: string,
  centerPageId: string,
  depth: number
): Promise<GraphData> {
  // Fetch all links for the tenant (for BFS traversal)
  const allLinks = await prisma.pageLink.findMany({
    where: { tenantId },
    select: {
      sourcePageId: true,
      targetPageId: true,
    },
  });

  // Build adjacency list (bidirectional for BFS)
  const adjacency = new Map<string, Set<string>>();
  for (const link of allLinks) {
    if (!adjacency.has(link.sourcePageId)) {
      adjacency.set(link.sourcePageId, new Set());
    }
    if (!adjacency.has(link.targetPageId)) {
      adjacency.set(link.targetPageId, new Set());
    }
    adjacency.get(link.sourcePageId)!.add(link.targetPageId);
    adjacency.get(link.targetPageId)!.add(link.sourcePageId);
  }

  // BFS from center page
  const discoveredPageIds = new Set<string>([centerPageId]);
  let frontier = [centerPageId];

  for (let d = 0; d < depth; d++) {
    const nextFrontier: string[] = [];

    for (const pageId of frontier) {
      const neighbors = adjacency.get(pageId);
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!discoveredPageIds.has(neighbor)) {
            discoveredPageIds.add(neighbor);
            nextFrontier.push(neighbor);
          }
        }
      }
    }

    frontier = nextFrontier;
    if (frontier.length === 0) break;
  }

  // Fetch page details for discovered pages
  const pages = await prisma.page.findMany({
    where: {
      id: { in: Array.from(discoveredPageIds) },
      tenantId,
    },
    select: {
      id: true,
      title: true,
      icon: true,
      updatedAt: true,
    },
  });

  const pageIdSet = new Set(pages.map((p) => p.id));

  // Compute link counts for discovered pages
  const linkCounts = new Map<string, number>();
  for (const link of allLinks) {
    if (pageIdSet.has(link.sourcePageId)) {
      linkCounts.set(
        link.sourcePageId,
        (linkCounts.get(link.sourcePageId) || 0) + 1
      );
    }
    if (pageIdSet.has(link.targetPageId)) {
      linkCounts.set(
        link.targetPageId,
        (linkCounts.get(link.targetPageId) || 0) + 1
      );
    }
  }

  // Build nodes
  const nodes: GraphNode[] = pages.map((page) => ({
    id: page.id,
    label: page.title,
    icon: page.icon,
    linkCount: linkCounts.get(page.id) || 0,
    updatedAt: page.updatedAt.toISOString(),
  }));

  // Build edges (only between discovered pages)
  const edges: GraphEdge[] = allLinks
    .filter(
      (link) =>
        discoveredPageIds.has(link.sourcePageId) &&
        discoveredPageIds.has(link.targetPageId)
    )
    .map((link) => ({
      source: link.sourcePageId,
      target: link.targetPageId,
    }));

  return { nodes, edges };
}
