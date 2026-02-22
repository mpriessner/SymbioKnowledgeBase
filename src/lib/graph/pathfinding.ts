import type { GraphEdge } from "@/types/graph";

/**
 * Find shortest path between two nodes using BFS.
 * Returns array of node IDs in the path, or empty array if no path exists.
 */
export function findShortestPath(
  sourceId: string,
  targetId: string,
  edges: GraphEdge[]
): string[] {
  if (sourceId === targetId) return [sourceId];

  // Build adjacency list (undirected for pathfinding)
  const adjacency = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, new Set());
    if (!adjacency.has(edge.target)) adjacency.set(edge.target, new Set());
    adjacency.get(edge.source)!.add(edge.target);
    adjacency.get(edge.target)!.add(edge.source);
  }

  // BFS
  const visited = new Set<string>([sourceId]);
  const parent = new Map<string, string>();
  const queue: string[] = [sourceId];

  while (queue.length > 0) {
    const current = queue.shift()!;

    const neighbors = adjacency.get(current);
    if (!neighbors) continue;

    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      parent.set(neighbor, current);

      if (neighbor === targetId) {
        // Reconstruct path
        const path: string[] = [targetId];
        let node = targetId;
        while (parent.has(node)) {
          node = parent.get(node)!;
          path.unshift(node);
        }
        return path;
      }

      queue.push(neighbor);
    }
  }

  return []; // No path found
}

/**
 * Get edges along a path (for highlighting).
 */
export function getPathEdges(
  path: string[],
  edges: GraphEdge[]
): Set<string> {
  const pathEdgeKeys = new Set<string>();
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    // Check both directions
    for (const edge of edges) {
      if (
        (edge.source === a && edge.target === b) ||
        (edge.source === b && edge.target === a)
      ) {
        pathEdgeKeys.add(`${edge.source}->${edge.target}`);
      }
    }
  }
  return pathEdgeKeys;
}
