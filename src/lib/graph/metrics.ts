import type { GraphNode, GraphEdge } from "@/types/graph";

/**
 * Compute graph metrics: cluster count and orphan count.
 * Uses union-find to count connected components.
 */
export function computeGraphMetrics(
  nodes: GraphNode[],
  edges: GraphEdge[]
): { clusterCount: number; orphanCount: number } {
  if (nodes.length === 0) return { clusterCount: 0, orphanCount: 0 };

  // Union-Find
  const parent = new Map<string, string>();
  const rank = new Map<string, number>();

  for (const node of nodes) {
    parent.set(node.id, node.id);
    rank.set(node.id, 0);
  }

  function find(x: string): string {
    let root = x;
    while (parent.get(root) !== root) {
      root = parent.get(root)!;
    }
    // Path compression
    let current = x;
    while (current !== root) {
      const next = parent.get(current)!;
      parent.set(current, root);
      current = next;
    }
    return root;
  }

  function union(a: string, b: string): void {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA === rootB) return;
    const rankA = rank.get(rootA)!;
    const rankB = rank.get(rootB)!;
    if (rankA < rankB) {
      parent.set(rootA, rootB);
    } else if (rankA > rankB) {
      parent.set(rootB, rootA);
    } else {
      parent.set(rootB, rootA);
      rank.set(rootA, rankA + 1);
    }
  }

  // Build connected components
  const nodeIds = new Set(nodes.map((n) => n.id));
  for (const edge of edges) {
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      union(edge.source, edge.target);
    }
  }

  // Count clusters and orphans
  const componentSizes = new Map<string, number>();
  for (const node of nodes) {
    const root = find(node.id);
    componentSizes.set(root, (componentSizes.get(root) || 0) + 1);
  }

  let orphanCount = 0;
  for (const size of componentSizes.values()) {
    if (size === 1) orphanCount++;
  }

  return {
    clusterCount: componentSizes.size,
    orphanCount,
  };
}
