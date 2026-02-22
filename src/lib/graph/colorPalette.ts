import type { GraphNode, GraphEdge } from "@/types/graph";

/**
 * Graph color palettes for light and dark themes.
 */
export const graphColors = {
  light: {
    page: "#529CCA",
    database: "#8B5CF6",
    orphan: "#9CA3AF",
    center: "#EF4444",
    edge: "#D1D5DB",
    edgeBidirectional: "#9CA3AF",
    label: "#37352f",
    labelBg: "rgba(255, 255, 255, 0.9)",
  },
  dark: {
    page: "#60A5FA",
    database: "#A78BFA",
    orphan: "#6B7280",
    center: "#F87171",
    edge: "#4B5563",
    edgeBidirectional: "#6B7280",
    label: "#E5E7EB",
    labelBg: "rgba(30, 30, 30, 0.9)",
  },
};

export type ThemeMode = "light" | "dark";

/**
 * Get node color based on type and connection count.
 */
export function getNodeColor(
  node: GraphNode,
  theme: ThemeMode,
  centerId?: string
): string {
  const palette = graphColors[theme];
  if (centerId && node.id === centerId) return palette.center;
  if (node.linkCount === 0) return palette.orphan;
  return palette.page;
}

/**
 * Calculate node radius based on connection count using sqrt scale.
 * Min: baseRadius, Max: 20px.
 */
export function getNodeRadius(
  linkCount: number,
  baseRadius: number = 4
): number {
  return Math.min(Math.max(Math.sqrt(linkCount + 1) * baseRadius, baseRadius), 20);
}

/**
 * Get edge width - thicker for bidirectional links.
 */
export function getEdgeWidth(
  edge: GraphEdge,
  allEdges: GraphEdge[]
): number {
  const isBidirectional = allEdges.some(
    (e) => e.source === edge.target && e.target === edge.source
  );
  return isBidirectional ? 2 : 1;
}

/**
 * Get edge color based on theme.
 */
export function getEdgeColor(theme: ThemeMode): string {
  return graphColors[theme].edge;
}
