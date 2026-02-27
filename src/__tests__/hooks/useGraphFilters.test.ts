import { describe, it, expect } from "vitest";
import type { GraphData } from "@/types/graph";

// Test the filter logic directly (same logic as in the hook)
describe("Graph filtering logic", () => {
  const testData: GraphData = {
    nodes: [
      {
        id: "1",
        label: "Page A",
        icon: null,
        oneLiner: null,
        linkCount: 5,
        updatedAt: "2026-01-15T00:00:00Z",
      },
      {
        id: "2",
        label: "Page B",
        icon: null,
        oneLiner: null,
        linkCount: 1,
        updatedAt: "2026-02-10T00:00:00Z",
      },
      {
        id: "3",
        label: "Page C",
        icon: null,
        oneLiner: null,
        linkCount: 0,
        updatedAt: "2026-03-01T00:00:00Z",
      },
    ],
    edges: [
      { source: "1", target: "2" },
      { source: "1", target: "3" },
    ],
  };

  it("should filter nodes by minimum link count", () => {
    const filtered = testData.nodes.filter((n) => n.linkCount >= 2);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("1");
  });

  it("should filter nodes by date range (after)", () => {
    const afterDate = new Date("2026-02-01").getTime();
    const filtered = testData.nodes.filter(
      (n) => new Date(n.updatedAt).getTime() >= afterDate
    );
    expect(filtered).toHaveLength(2);
    expect(filtered.map((n) => n.id)).toEqual(["2", "3"]);
  });

  it("should filter nodes by date range (before)", () => {
    const beforeDate = new Date("2026-02-15").getTime();
    const filtered = testData.nodes.filter(
      (n) => new Date(n.updatedAt).getTime() <= beforeDate
    );
    expect(filtered).toHaveLength(2);
    expect(filtered.map((n) => n.id)).toEqual(["1", "2"]);
  });

  it("should remove orphaned edges after node filtering", () => {
    const nodeIds = new Set(["1"]); // Only Page A survives
    const filteredEdges = testData.edges.filter(
      (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
    );
    expect(filteredEdges).toHaveLength(0);
  });

  it("should keep edges when both endpoints survive", () => {
    const nodeIds = new Set(["1", "2"]); // Pages A and B survive
    const filteredEdges = testData.edges.filter(
      (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
    );
    expect(filteredEdges).toHaveLength(1);
    expect(filteredEdges[0]).toEqual({ source: "1", target: "2" });
  });

  it("should return all data when no filters applied", () => {
    const minLinkCount = 0;
    const filtered = testData.nodes.filter(
      (n) => n.linkCount >= minLinkCount
    );
    expect(filtered).toHaveLength(3);
  });
});
