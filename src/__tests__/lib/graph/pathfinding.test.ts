import { describe, it, expect } from "vitest";
import { findShortestPath, getPathEdges } from "@/lib/graph/pathfinding";
import type { GraphEdge } from "@/types/graph";

describe("findShortestPath", () => {
  const edges: GraphEdge[] = [
    { source: "a", target: "b" },
    { source: "b", target: "c" },
    { source: "c", target: "d" },
    { source: "a", target: "d" }, // shortcut
  ];

  it("should find direct path", () => {
    const path = findShortestPath("a", "b", edges);
    expect(path).toEqual(["a", "b"]);
  });

  it("should find shortest path (not longest)", () => {
    const path = findShortestPath("a", "d", edges);
    expect(path).toEqual(["a", "d"]); // direct shortcut
  });

  it("should return single node for same source/target", () => {
    const path = findShortestPath("a", "a", edges);
    expect(path).toEqual(["a"]);
  });

  it("should return empty array when no path exists", () => {
    const path = findShortestPath("a", "z", edges);
    expect(path).toEqual([]);
  });
});

describe("getPathEdges", () => {
  it("should return edge keys along the path", () => {
    const edges: GraphEdge[] = [
      { source: "a", target: "b" },
      { source: "b", target: "c" },
    ];
    const path = ["a", "b", "c"];
    const result = getPathEdges(path, edges);
    expect(result.has("a->b")).toBe(true);
    expect(result.has("b->c")).toBe(true);
  });
});
