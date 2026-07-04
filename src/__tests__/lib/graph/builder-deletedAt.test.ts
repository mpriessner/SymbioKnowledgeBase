import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildGraphData } from "@/lib/graph/builder";

vi.mock("@/lib/db", () => ({
  prisma: {
    page: { findMany: vi.fn().mockResolvedValue([]) },
    pageLink: { findMany: vi.fn().mockResolvedValue([]) },
    block: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

import { prisma } from "@/lib/db";

const mockPageFindMany = vi.mocked(prisma.page.findMany);
const mockBlockFindMany = vi.mocked(prisma.block.findMany);
const mockPageLinkFindMany = vi.mocked(prisma.pageLink.findMany);

describe("graph builder excludes soft-deleted pages", () => {
  const tenantId = "test-tenant";

  beforeEach(() => {
    vi.clearAllMocks();
    mockPageFindMany.mockResolvedValue([] as never);
    mockBlockFindMany.mockResolvedValue([] as never);
    mockPageLinkFindMany.mockResolvedValue([] as never);
  });

  it("global graph filters pages and blocks by deletedAt", async () => {
    await buildGraphData(tenantId);

    // Pages query excludes soft-deleted rows.
    expect(mockPageFindMany.mock.calls[0][0]).toMatchObject({
      where: { tenantId, deletedAt: null },
    });
    // Block aggregation skips blocks of soft-deleted pages.
    expect(mockBlockFindMany.mock.calls[0][0]).toMatchObject({
      where: { tenantId, page: { deletedAt: null } },
    });
  });

  it("global graph drops edges pointing at a soft-deleted page", async () => {
    // p2 is soft-deleted → absent from the pages result, so the p1→p2 edge
    // must be dropped by the node-membership filter.
    mockPageFindMany.mockResolvedValueOnce([
      { id: "p1", title: "Alive", icon: null, oneLiner: null, updatedAt: new Date() },
    ] as never);
    mockPageLinkFindMany.mockResolvedValueOnce([
      { sourcePageId: "p1", targetPageId: "p2" },
    ] as never);

    const result = await buildGraphData(tenantId);

    expect(result.nodes.map((n) => n.id)).toEqual(["p1"]);
    expect(result.edges).toHaveLength(0);
  });

  it("local graph filters discovered pages and blocks by deletedAt", async () => {
    mockPageLinkFindMany.mockResolvedValue([
      { sourcePageId: "center", targetPageId: "hop1" },
    ] as never);
    mockPageFindMany.mockImplementation((async (args: {
      where?: { id?: { in?: string[] } };
    }) => {
      const ids = args?.where?.id?.in || [];
      return ids.map((id: string) => ({
        id,
        title: id,
        icon: null,
        oneLiner: null,
        updatedAt: new Date(),
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any);

    await buildGraphData(tenantId, "center", 1);

    // Discovered-pages query carries the deletedAt filter.
    expect(mockPageFindMany.mock.calls[0][0]).toMatchObject({
      where: { tenantId, deletedAt: null },
    });
    // Block aggregation carries the page.deletedAt relation filter.
    expect(mockBlockFindMany.mock.calls[0][0]).toMatchObject({
      where: { tenantId, page: { deletedAt: null } },
    });
  });
});
