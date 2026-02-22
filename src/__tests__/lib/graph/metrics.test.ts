import { describe, it, expect } from "vitest";
import { computeGraphMetrics } from "@/lib/graph/metrics";
import type { GraphNode, GraphEdge } from "@/types/graph";

const makeNode = (id: string): GraphNode => ({
  id,
  label: `Page ${id}`,
  icon: null,
  linkCount: 0,
  updatedAt: "2026-01-01T00:00:00Z",
});

describe("computeGraphMetrics", () => {
  it("should return zeros for empty graph", () => {
    const result = computeGraphMetrics([], []);
    expect(result.clusterCount).toBe(0);
    expect(result.orphanCount).toBe(0);
  });

  it("should count all nodes as orphans when no edges", () => {
    const nodes = [makeNode("a"), makeNode("b"), makeNode("c")];
    const result = computeGraphMetrics(nodes, []);
    expect(result.clusterCount).toBe(3);
    expect(result.orphanCount).toBe(3);
  });

  it("should find one cluster with connected nodes", () => {
    const nodes = [makeNode("a"), makeNode("b"), makeNode("c")];
    const edges: GraphEdge[] = [
      { source: "a", target: "b" },
      { source: "b", target: "c" },
    ];
    const result = computeGraphMetrics(nodes, edges);
    expect(result.clusterCount).toBe(1);
    expect(result.orphanCount).toBe(0);
  });

  it("should count multiple clusters correctly", () => {
    const nodes = [
      makeNode("a"),
      makeNode("b"),
      makeNode("c"),
      makeNode("d"),
      makeNode("e"),
    ];
    const edges: GraphEdge[] = [
      { source: "a", target: "b" },
      { source: "c", target: "d" },
    ];
    // Clusters: {a,b}, {c,d}, {e}
    const result = computeGraphMetrics(nodes, edges);
    expect(result.clusterCount).toBe(3);
    expect(result.orphanCount).toBe(1);
  });
});
