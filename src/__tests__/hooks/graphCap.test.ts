import { describe, it, expect } from "vitest";
import { capGraphToTopNodes } from "@/app/api/graph/route";
import type { GraphData, GraphNode } from "@/types/graph";

function node(id: string, linkCount: number): GraphNode {
  return {
    id,
    label: id,
    icon: null,
    oneLiner: null,
    linkCount,
    updatedAt: "2026-01-01T00:00:00.000Z",
    contentLength: 0,
  };
}

describe("capGraphToTopNodes", () => {
  it("returns the graph unchanged when under the cap", () => {
    const graph: GraphData = {
      nodes: [node("a", 1), node("b", 2)],
      edges: [{ source: "a", target: "b" }],
    };
    const result = capGraphToTopNodes(graph, 500);
    expect(result).toBe(graph);
  });

  it("keeps the top-N nodes by connection count", () => {
    const graph: GraphData = {
      nodes: [node("low", 1), node("high", 10), node("mid", 5)],
      edges: [],
    };
    const result = capGraphToTopNodes(graph, 2);
    expect(result.nodes.map((n) => n.id)).toEqual(["high", "mid"]);
  });

  it("prunes edges whose endpoints were dropped", () => {
    const graph: GraphData = {
      nodes: [node("keep1", 10), node("keep2", 9), node("drop", 1)],
      edges: [
        { source: "keep1", target: "keep2" }, // both kept
        { source: "keep1", target: "drop" }, // endpoint dropped
        { source: "drop", target: "keep2" }, // endpoint dropped
      ],
    };
    const result = capGraphToTopNodes(graph, 2);
    expect(result.nodes.map((n) => n.id).sort()).toEqual(["keep1", "keep2"]);
    expect(result.edges).toEqual([{ source: "keep1", target: "keep2" }]);
  });
});
