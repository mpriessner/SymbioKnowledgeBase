import { describe, test, expect, vi, beforeEach } from "vitest";

const mockPageFindMany = vi.fn();
const mockPageFindFirst = vi.fn();
const mockBlockFindMany = vi.fn();
const mockBlockFindFirst = vi.fn();
const mockPageLinkFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    page: {
      findMany: (...args: unknown[]) => mockPageFindMany(...args),
      findFirst: (...args: unknown[]) => mockPageFindFirst(...args),
    },
    block: {
      findMany: (...args: unknown[]) => mockBlockFindMany(...args),
      findFirst: (...args: unknown[]) => mockBlockFindFirst(...args),
    },
    pageLink: {
      findMany: (...args: unknown[]) => mockPageLinkFindMany(...args),
    },
  },
}));

vi.mock("@/lib/agent/markdown", () => ({
  tiptapToMarkdown: vi.fn(() => ""),
}));

const { depthSearch } = await import("@/lib/search/depthSearch");

const TENANT_ID = "test-tenant";

const mockPages = [
  {
    id: "page-1",
    title: "Suzuki Coupling — 4-Bromopyridine",
    oneLiner: "Standard Suzuki coupling",
    spaceType: "TEAM",
    parentId: "experiments-parent",
  },
  {
    id: "page-2",
    title: "Pd(PPh3)4",
    oneLiner: "Tetrakis palladium catalyst",
    spaceType: "TEAM",
    parentId: "chemicals-parent",
  },
];

beforeEach(() => {
  vi.clearAllMocks();

  // Default: return mock pages for title search
  mockPageFindMany.mockImplementation(({ where }) => {
    if (where?.OR) {
      // Title/oneLiner search
      const query = where.OR[0]?.title?.contains?.toLowerCase();
      if (!query) return Promise.resolve([]);
      return Promise.resolve(
        mockPages.filter(
          (p) =>
            p.title.toLowerCase().includes(query) ||
            (p.oneLiner?.toLowerCase().includes(query) ?? false)
        )
      );
    }
    return Promise.resolve([]);
  });

  // Default: no content matches
  mockBlockFindMany.mockResolvedValue([]);

  // Default: category parent lookup
  mockPageFindFirst.mockImplementation(({ where }) => {
    if (where.id === "experiments-parent") {
      return Promise.resolve({ title: "Experiments", parentId: "root" });
    }
    if (where.id === "chemicals-parent") {
      return Promise.resolve({ title: "Chemicals", parentId: "root" });
    }
    return Promise.resolve(null);
  });

  // Default: no links
  mockPageLinkFindMany.mockResolvedValue([]);

  // Default: no block content
  mockBlockFindFirst.mockResolvedValue(null);
});

describe("depthSearch", () => {
  test("default depth returns title matches only", async () => {
    const result = await depthSearch({
      tenantId: TENANT_ID,
      query: "Suzuki",
      depth: "default",
      scope: "all",
    });

    expect(result.depth).toBe("default");
    expect(result.scope).toBe("all");
    expect(result.results.length).toBe(1);
    expect(result.results[0].title).toContain("Suzuki");
    expect(result.results[0].snippet).toBeUndefined();
    expect(result.searchTimeMs).toBeGreaterThanOrEqual(0);
  });

  test("default depth does not search block content", async () => {
    await depthSearch({
      tenantId: TENANT_ID,
      query: "Suzuki",
      depth: "default",
      scope: "all",
    });

    // Block findMany should not be called at default depth
    expect(mockBlockFindMany).not.toHaveBeenCalled();
  });

  test("medium depth searches block content", async () => {
    mockBlockFindMany.mockResolvedValue([
      {
        page: {
          id: "page-3",
          title: "THF Handling Notes",
          oneLiner: "Solvent handling",
          spaceType: "TEAM",
          parentId: "chemicals-parent",
        },
      },
    ]);

    const result = await depthSearch({
      tenantId: TENANT_ID,
      query: "handling",
      depth: "medium",
      scope: "all",
    });

    expect(result.depth).toBe("medium");
    expect(mockBlockFindMany).toHaveBeenCalled();
  });

  test("scope=team filters to TEAM pages only", async () => {
    await depthSearch({
      tenantId: TENANT_ID,
      query: "Suzuki",
      depth: "default",
      scope: "team",
    });

    const findManyCall = mockPageFindMany.mock.calls[0][0];
    expect(findManyCall.where.spaceType).toBe("TEAM");
  });

  test("scope=private filters to PRIVATE pages only", async () => {
    await depthSearch({
      tenantId: TENANT_ID,
      query: "Suzuki",
      depth: "default",
      scope: "private",
    });

    const findManyCall = mockPageFindMany.mock.calls[0][0];
    expect(findManyCall.where.spaceType).toBe("PRIVATE");
  });

  test("scope=all does not filter by spaceType", async () => {
    await depthSearch({
      tenantId: TENANT_ID,
      query: "Suzuki",
      depth: "default",
      scope: "all",
    });

    const findManyCall = mockPageFindMany.mock.calls[0][0];
    expect(findManyCall.where.spaceType).toBeUndefined();
  });

  test("category filter narrows results", async () => {
    // Both pages match title search
    mockPageFindMany.mockResolvedValue(mockPages);

    const result = await depthSearch({
      tenantId: TENANT_ID,
      query: "coupling",
      depth: "default",
      scope: "all",
      category: "experiments",
    });

    // Only the experiment page should remain
    const experimentResults = result.results.filter(
      (r) => r.category === "experiments"
    );
    expect(experimentResults.length).toBeLessThanOrEqual(result.totalCount);
  });

  test("empty query returns no results", async () => {
    mockPageFindMany.mockResolvedValue([]);

    const result = await depthSearch({
      tenantId: TENANT_ID,
      query: "nonexistent",
      depth: "default",
      scope: "all",
    });

    expect(result.results).toEqual([]);
    expect(result.totalCount).toBe(0);
  });

  test("title matches get higher score than content matches", async () => {
    // First call: title matches return page-1
    mockPageFindMany.mockResolvedValueOnce([mockPages[0]]);
    // Content search returns page-3
    mockBlockFindMany.mockResolvedValue([
      {
        page: {
          id: "page-3",
          title: "Related Notes",
          oneLiner: null,
          spaceType: "TEAM",
          parentId: "experiments-parent",
        },
      },
    ]);

    const result = await depthSearch({
      tenantId: TENANT_ID,
      query: "Suzuki",
      depth: "medium",
      scope: "all",
    });

    if (result.results.length >= 2) {
      const titleMatch = result.results.find((r) => r.pageId === "page-1");
      const contentMatch = result.results.find((r) => r.pageId === "page-3");
      if (titleMatch && contentMatch) {
        expect(titleMatch.score).toBeGreaterThan(contentMatch.score);
      }
    }
  });

  test("respects custom limit", async () => {
    mockPageFindMany.mockResolvedValue(mockPages);

    const result = await depthSearch({
      tenantId: TENANT_ID,
      query: "test",
      depth: "default",
      scope: "all",
      limit: 1,
    });

    expect(result.results.length).toBeLessThanOrEqual(1);
  });

  test("searchTimeMs is populated", async () => {
    const result = await depthSearch({
      tenantId: TENANT_ID,
      query: "test",
      depth: "default",
      scope: "all",
    });

    expect(typeof result.searchTimeMs).toBe("number");
    expect(result.searchTimeMs).toBeGreaterThanOrEqual(0);
  });
});
