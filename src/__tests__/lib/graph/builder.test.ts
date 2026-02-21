import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildGraphData } from "@/lib/graph/builder";

// Mock prisma
vi.mock("@/lib/db", () => ({
  prisma: {
    page: {
      findMany: vi.fn(),
    },
    pageLink: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";

const mockPageFindMany = vi.mocked(prisma.page.findMany);
const mockPageLinkFindMany = vi.mocked(prisma.pageLink.findMany);

describe("buildGraphData", () => {
  const tenantId = "test-tenant";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("global graph", () => {
    it("should return all pages as nodes", async () => {
      mockPageFindMany.mockResolvedValue([
        {
          id: "p1",
          title: "Page 1",
          icon: null,
          updatedAt: new Date("2026-01-15"),
        },
        {
          id: "p2",
          title: "Page 2",
          icon: null,
          updatedAt: new Date("2026-02-10"),
        },
      ] as Awaited<ReturnType<typeof prisma.page.findMany>>);
      mockPageLinkFindMany.mockResolvedValue([]);

      const result = await buildGraphData(tenantId);

      expect(result.nodes).toHaveLength(2);
      expect(result.nodes[0].label).toBe("Page 1");
      expect(result.nodes[1].label).toBe("Page 2");
    });

    it("should return all links as edges", async () => {
      mockPageFindMany.mockResolvedValue([
        {
          id: "p1",
          title: "Page 1",
          icon: null,
          updatedAt: new Date(),
        },
        {
          id: "p2",
          title: "Page 2",
          icon: null,
          updatedAt: new Date(),
        },
      ] as Awaited<ReturnType<typeof prisma.page.findMany>>);
      mockPageLinkFindMany.mockResolvedValue([
        { sourcePageId: "p1", targetPageId: "p2" },
      ] as Awaited<ReturnType<typeof prisma.pageLink.findMany>>);

      const result = await buildGraphData(tenantId);

      expect(result.edges).toHaveLength(1);
      expect(result.edges[0]).toEqual({ source: "p1", target: "p2" });
    });

    it("should compute correct linkCount per node", async () => {
      mockPageFindMany.mockResolvedValue([
        {
          id: "p1",
          title: "Page 1",
          icon: null,
          updatedAt: new Date(),
        },
        {
          id: "p2",
          title: "Page 2",
          icon: null,
          updatedAt: new Date(),
        },
      ] as Awaited<ReturnType<typeof prisma.page.findMany>>);
      mockPageLinkFindMany.mockResolvedValue([
        { sourcePageId: "p1", targetPageId: "p2" },
      ] as Awaited<ReturnType<typeof prisma.pageLink.findMany>>);

      const result = await buildGraphData(tenantId);

      const p1Node = result.nodes.find((n) => n.id === "p1");
      const p2Node = result.nodes.find((n) => n.id === "p2");

      expect(p1Node?.linkCount).toBe(1);
      expect(p2Node?.linkCount).toBe(1);
    });

    it("should include orphan pages with linkCount 0", async () => {
      mockPageFindMany.mockResolvedValue([
        {
          id: "p1",
          title: "Connected",
          icon: null,
          updatedAt: new Date(),
        },
        {
          id: "orphan",
          title: "Orphan",
          icon: null,
          updatedAt: new Date(),
        },
      ] as Awaited<ReturnType<typeof prisma.page.findMany>>);
      mockPageLinkFindMany.mockResolvedValue([]);

      const result = await buildGraphData(tenantId);

      expect(result.nodes).toHaveLength(2);
      const orphan = result.nodes.find((n) => n.id === "orphan");
      expect(orphan?.linkCount).toBe(0);
    });
  });

  describe("local graph (BFS)", () => {
    it("should discover nodes within specified depth", async () => {
      mockPageLinkFindMany.mockResolvedValue([
        { sourcePageId: "center", targetPageId: "hop1a" },
        { sourcePageId: "center", targetPageId: "hop1b" },
        { sourcePageId: "hop1a", targetPageId: "hop2" },
        { sourcePageId: "hop2", targetPageId: "hop3" },
      ] as Awaited<ReturnType<typeof prisma.pageLink.findMany>>);

      mockPageFindMany.mockImplementation(
        async (args: { where?: { id?: { in?: string[] } } }) => {
          const ids = args?.where?.id?.in || [];
          return ids.map((id: string) => ({
            id,
            title: `Page ${id}`,
            icon: null,
            updatedAt: new Date(),
          }));
        }
      );

      // Depth 1: center + hop1a + hop1b
      const result1 = await buildGraphData(tenantId, "center", 1);
      expect(result1.nodes.map((n) => n.id).sort()).toEqual(
        ["center", "hop1a", "hop1b"].sort()
      );

      // Depth 2: adds hop2
      const result2 = await buildGraphData(tenantId, "center", 2);
      expect(result2.nodes.map((n) => n.id)).toContain("hop2");
      expect(result2.nodes.map((n) => n.id)).not.toContain("hop3");
    });

    it("should only include edges between discovered nodes", async () => {
      mockPageLinkFindMany.mockResolvedValue([
        { sourcePageId: "center", targetPageId: "hop1" },
        { sourcePageId: "hop1", targetPageId: "hop2" },
      ] as Awaited<ReturnType<typeof prisma.pageLink.findMany>>);

      mockPageFindMany.mockImplementation(
        async (args: { where?: { id?: { in?: string[] } } }) => {
          const ids = args?.where?.id?.in || [];
          return ids.map((id: string) => ({
            id,
            title: id,
            icon: null,
            updatedAt: new Date(),
          }));
        }
      );

      const result = await buildGraphData(tenantId, "center", 1);

      // Only center → hop1 edge (hop1 → hop2 excluded because hop2 not discovered)
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0]).toEqual({
        source: "center",
        target: "hop1",
      });
    });

    it("should handle bidirectional traversal", async () => {
      // hop1 links TO center (center is the target, not source)
      mockPageLinkFindMany.mockResolvedValue([
        { sourcePageId: "hop1", targetPageId: "center" },
      ] as Awaited<ReturnType<typeof prisma.pageLink.findMany>>);

      mockPageFindMany.mockImplementation(
        async (args: { where?: { id?: { in?: string[] } } }) => {
          const ids = args?.where?.id?.in || [];
          return ids.map((id: string) => ({
            id,
            title: id,
            icon: null,
            updatedAt: new Date(),
          }));
        }
      );

      const result = await buildGraphData(tenantId, "center", 1);

      // hop1 should still be discovered via bidirectional BFS
      expect(result.nodes.map((n) => n.id)).toContain("hop1");
    });
  });
});
