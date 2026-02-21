import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma
vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    page: {
      findMany: vi.fn(),
    },
  },
}));

import { searchBlocks, searchPagesByTitle } from "@/lib/search/query";
import { prisma } from "@/lib/db";

const mockedQueryRaw = vi.mocked(prisma.$queryRaw);
const mockedPageFindMany = vi.mocked(prisma.page.findMany);

describe("searchBlocks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return empty results for empty query", async () => {
    const results = await searchBlocks("", "tenant-1");
    expect(results.total).toBe(0);
    expect(results.results).toHaveLength(0);
    expect(mockedQueryRaw).not.toHaveBeenCalled();
  });

  it("should return empty results for whitespace-only query", async () => {
    const results = await searchBlocks("   ", "tenant-1");
    expect(results.total).toBe(0);
    expect(results.results).toHaveLength(0);
  });

  it("should call prisma.$queryRaw for valid queries", async () => {
    mockedQueryRaw.mockResolvedValue([
      {
        page_id: "page-1",
        page_title: "Test Page",
        page_icon: null,
        block_id: "block-1",
        snippet: "<mark>test</mark> content",
        rank: 0.5,
      },
    ]);

    const results = await searchBlocks("test", "tenant-1");

    expect(mockedQueryRaw).toHaveBeenCalled();
    expect(results.total).toBe(1);
    expect(results.results[0].pageId).toBe("page-1");
    expect(results.results[0].pageTitle).toBe("Test Page");
    expect(results.results[0].blockId).toBe("block-1");
    expect(results.results[0].snippet).toContain("<mark>");
    expect(results.results[0].rank).toBe(0.5);
  });

  it("should sort results by rank descending", async () => {
    mockedQueryRaw.mockResolvedValue([
      {
        page_id: "page-1",
        page_title: "Low Rank",
        page_icon: null,
        block_id: "block-1",
        snippet: "low",
        rank: 0.1,
      },
      {
        page_id: "page-2",
        page_title: "High Rank",
        page_icon: null,
        block_id: "block-2",
        snippet: "high",
        rank: 0.9,
      },
    ]);

    const results = await searchBlocks("test", "tenant-1");

    expect(results.results[0].pageTitle).toBe("High Rank");
    expect(results.results[1].pageTitle).toBe("Low Rank");
  });

  it("should apply limit and offset", async () => {
    mockedQueryRaw.mockResolvedValue([
      {
        page_id: "page-1",
        page_title: "First",
        page_icon: null,
        block_id: "block-1",
        snippet: "first",
        rank: 0.9,
      },
      {
        page_id: "page-2",
        page_title: "Second",
        page_icon: null,
        block_id: "block-2",
        snippet: "second",
        rank: 0.5,
      },
    ]);

    const results = await searchBlocks("test", "tenant-1", 1, 0);
    expect(results.results).toHaveLength(1);
    expect(results.total).toBe(2);
  });

  it("should strip angle brackets from query", async () => {
    mockedQueryRaw.mockResolvedValue([]);
    const results = await searchBlocks("<script>alert</script>", "tenant-1");
    expect(results.total).toBe(0);
    expect(mockedQueryRaw).toHaveBeenCalled();
  });
});

describe("searchPagesByTitle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return empty array for empty query", async () => {
    const results = await searchPagesByTitle("", "tenant-1");
    expect(results).toHaveLength(0);
    expect(mockedPageFindMany).not.toHaveBeenCalled();
  });

  it("should call prisma.page.findMany with correct params", async () => {
    mockedPageFindMany.mockResolvedValue([
      { id: "page-1", title: "Test Page", icon: null } as never,
    ]);

    const results = await searchPagesByTitle("test", "tenant-1", 5);

    expect(mockedPageFindMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        title: {
          contains: "test",
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        title: true,
        icon: true,
      },
      take: 5,
      orderBy: {
        updatedAt: "desc",
      },
    });
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Test Page");
  });
});
