import { describe, it, expect } from "vitest";
import {
  getNodeColor,
  getNodeRadius,
  getEdgeWidth,
  graphColors,
} from "@/lib/graph/colorPalette";
import type { GraphNode, GraphEdge } from "@/types/graph";

describe("Graph Color Palette", () => {
  const makeNode = (
    overrides: Partial<GraphNode> = {}
  ): GraphNode => ({
    id: "1",
    label: "Test Page",
    icon: null,
    oneLiner: null,
    linkCount: 5,
    updatedAt: "2026-01-01T00:00:00Z",
    contentLength: 0,
    ...overrides,
  });

  describe("getNodeColor", () => {
    it("should return blue for page nodes in light mode", () => {
      const node = makeNode({ linkCount: 5 });
      expect(getNodeColor(node, "light")).toBe(graphColors.light.page);
    });

    it("should return gray for orphan nodes", () => {
      const node = makeNode({ linkCount: 0 });
      expect(getNodeColor(node, "light")).toBe(graphColors.light.orphan);
    });

    it("should return center color when node is center", () => {
      const node = makeNode({ id: "center-id" });
      expect(getNodeColor(node, "light", "center-id")).toBe(
        graphColors.light.center
      );
    });

    it("should use dark mode colors", () => {
      const node = makeNode({ linkCount: 3 });
      expect(getNodeColor(node, "dark")).toBe(graphColors.dark.page);
    });
  });

  describe("getNodeRadius", () => {
    it("should return base radius for 0 links", () => {
      expect(getNodeRadius(0, 4)).toBe(4);
    });

    it("should scale with sqrt", () => {
      // sqrt(8+1) * 4 = 3 * 4 = 12
      expect(getNodeRadius(8, 4)).toBe(12);
    });

    it("should cap at 20px", () => {
      expect(getNodeRadius(1000, 4)).toBe(20);
    });
  });

  describe("getEdgeWidth", () => {
    it("should return 1 for regular edge", () => {
      const edges: GraphEdge[] = [{ source: "a", target: "b" }];
      expect(getEdgeWidth(edges[0], edges)).toBe(1);
    });

    it("should return 2 for bidirectional edge", () => {
      const edges: GraphEdge[] = [
        { source: "a", target: "b" },
        { source: "b", target: "a" },
      ];
      expect(getEdgeWidth(edges[0], edges)).toBe(2);
    });
  });
});
