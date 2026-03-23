import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

const mockPageFindMany = vi.fn();
const mockPageFindFirst = vi.fn();
const mockPageUpdate = vi.fn();
const mockPageLinkFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    page: {
      findMany: (...args: unknown[]) => mockPageFindMany(...args),
      findFirst: (...args: unknown[]) => mockPageFindFirst(...args),
      update: (...args: unknown[]) => mockPageUpdate(...args),
    },
    pageLink: {
      findMany: (...args: unknown[]) => mockPageLinkFindMany(...args),
    },
  },
}));

vi.mock("@/lib/agent/markdown", () => ({
  tiptapToMarkdown: vi.fn(() => ""),
  markdownToTiptap: vi.fn((md) => ({ _mockMarkdown: md })),
}));

const {
  scheduleAggregationRefresh,
  clearPendingRefreshes,
  getPendingCount,
  findAffectedAggregationPages,
  refreshAggregationPages,
  immediateRefresh,
} = await import("@/lib/chemistryKb/aggregationRefresh");

const TENANT_ID = "test-tenant";

beforeEach(() => {
  vi.clearAllMocks();
  clearPendingRefreshes();
  vi.useFakeTimers();
});

afterEach(() => {
  clearPendingRefreshes();
  vi.useRealTimers();
});

describe("scheduleAggregationRefresh", () => {
  test("accumulates page IDs in pending set", () => {
    scheduleAggregationRefresh(TENANT_ID, ["page-1", "page-2"], "promotion");

    expect(getPendingCount(TENANT_ID)).toBe(2);
  });

  test("deduplicates page IDs", () => {
    scheduleAggregationRefresh(TENANT_ID, ["page-1"], "promotion");
    scheduleAggregationRefresh(TENANT_ID, ["page-1", "page-2"], "capture");

    expect(getPendingCount(TENANT_ID)).toBe(2);
  });

  test("different tenants have separate pending sets", () => {
    scheduleAggregationRefresh("tenant-a", ["page-1"], "promotion");
    scheduleAggregationRefresh("tenant-b", ["page-2"], "promotion");

    expect(getPendingCount("tenant-a")).toBe(1);
    expect(getPendingCount("tenant-b")).toBe(1);
  });

  test("clearPendingRefreshes resets all state", () => {
    scheduleAggregationRefresh(TENANT_ID, ["page-1"], "promotion");
    expect(getPendingCount(TENANT_ID)).toBe(1);

    clearPendingRefreshes();
    expect(getPendingCount(TENANT_ID)).toBe(0);
  });
});

describe("findAffectedAggregationPages", () => {
  test("finds parent pages of changed TEAM pages", async () => {
    mockPageFindMany.mockResolvedValueOnce([
      { id: "page-1", parentId: "category-1", spaceType: "TEAM" },
    ]);
    mockPageFindFirst.mockResolvedValueOnce({
      parentId: "root-kb",
    });
    mockPageLinkFindMany.mockResolvedValueOnce([]);

    const affected = await findAffectedAggregationPages(TENANT_ID, ["page-1"]);

    expect(affected).toContain("category-1");
    expect(affected).toContain("root-kb");
    expect(affected).not.toContain("page-1");
  });

  test("ignores PRIVATE space pages", async () => {
    mockPageFindMany.mockResolvedValueOnce([
      { id: "private-1", parentId: "private-cat", spaceType: "PRIVATE" },
    ]);

    const affected = await findAffectedAggregationPages(TENANT_ID, [
      "private-1",
    ]);

    expect(affected).toEqual([]);
  });

  test("includes linked page targets", async () => {
    mockPageFindMany.mockResolvedValueOnce([
      { id: "page-1", parentId: "cat-1", spaceType: "TEAM" },
    ]);
    mockPageFindFirst.mockResolvedValueOnce({ parentId: null });
    mockPageLinkFindMany.mockResolvedValueOnce([
      { targetPageId: "linked-1" },
      { targetPageId: "linked-2" },
    ]);

    const affected = await findAffectedAggregationPages(TENANT_ID, ["page-1"]);

    expect(affected).toContain("linked-1");
    expect(affected).toContain("linked-2");
  });
});

describe("refreshAggregationPages", () => {
  test("updates oneLiner with child count", async () => {
    // Page found in TEAM space
    mockPageFindFirst
      .mockResolvedValueOnce({
        id: "cat-1",
        title: "Suzuki Coupling",
        parentId: "reaction-types",
      })
      .mockResolvedValueOnce({ title: "Reaction Types" });

    // Children of the category
    mockPageFindMany.mockResolvedValueOnce([
      { id: "exp-1", title: "Experiment 1" },
      { id: "exp-2", title: "Experiment 2" },
    ]);

    mockPageUpdate.mockResolvedValueOnce({});

    const result = await refreshAggregationPages(TENANT_ID, ["cat-1"]);

    expect(result.refreshed).toBe(1);
    expect(mockPageUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "cat-1" },
        data: expect.objectContaining({
          oneLiner: "2 reaction types documented",
        }),
      })
    );
  });

  test("skips pages not in TEAM space", async () => {
    mockPageFindFirst.mockResolvedValueOnce(null);

    const result = await refreshAggregationPages(TENANT_ID, ["non-team-page"]);

    expect(result.refreshed).toBe(0);
    expect(mockPageUpdate).not.toHaveBeenCalled();
  });

  test("skips pages with no children", async () => {
    mockPageFindFirst
      .mockResolvedValueOnce({
        id: "leaf-page",
        title: "Leaf",
        parentId: "cat-1",
      })
      .mockResolvedValueOnce({ title: "Category" });

    mockPageFindMany.mockResolvedValueOnce([]);

    const result = await refreshAggregationPages(TENANT_ID, ["leaf-page"]);

    expect(result.refreshed).toBe(0);
    expect(mockPageUpdate).not.toHaveBeenCalled();
  });

  test("returns duration in milliseconds", async () => {
    mockPageFindFirst.mockResolvedValue(null);

    const result = await refreshAggregationPages(TENANT_ID, []);

    expect(typeof result.duration).toBe("number");
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });
});

describe("immediateRefresh", () => {
  test("finds affected pages and refreshes them", async () => {
    // findAffectedAggregationPages
    mockPageFindMany
      .mockResolvedValueOnce([
        { id: "page-1", parentId: "cat-1", spaceType: "TEAM" },
      ])
      // refreshAggregationPages children query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: "child-1", title: "Child" },
      ]);

    mockPageFindFirst
      .mockResolvedValueOnce({ parentId: null }) // grandparent lookup
      .mockResolvedValueOnce(null) // page-1 not found as TEAM in refresh
      .mockResolvedValueOnce({
        id: "cat-1",
        title: "Category",
        parentId: "root",
      }) // cat-1 found
      .mockResolvedValueOnce({ title: "Root" }); // parent of cat-1

    mockPageLinkFindMany.mockResolvedValueOnce([]);
    mockPageUpdate.mockResolvedValue({});

    const result = await immediateRefresh(TENANT_ID, ["page-1"], "manual");

    expect(typeof result.refreshed).toBe("number");
    expect(typeof result.duration).toBe("number");
  });
});
