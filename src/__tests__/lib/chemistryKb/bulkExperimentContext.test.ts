import { describe, test, expect, vi, beforeEach } from "vitest";

const mockPageFindFirst = vi.fn();
const mockPageFindMany = vi.fn();
const mockBlockFindFirst = vi.fn();
const mockPageLinkFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    page: {
      findFirst: (...args: unknown[]) => mockPageFindFirst(...args),
      findMany: (...args: unknown[]) => mockPageFindMany(...args),
    },
    block: {
      findFirst: (...args: unknown[]) => mockBlockFindFirst(...args),
    },
    pageLink: {
      findMany: (...args: unknown[]) => mockPageLinkFindMany(...args),
    },
  },
}));

vi.mock("@/lib/agent/markdown", () => ({
  tiptapToMarkdown: vi.fn((content) => {
    if (content && typeof content === "object" && "_mockMarkdown" in content) {
      return content._mockMarkdown;
    }
    return "";
  }),
}));

const { assembleBulkContext } = await import(
  "@/lib/chemistryKb/bulkExperimentContext"
);

const TENANT_ID = "test-tenant";

beforeEach(() => {
  vi.clearAllMocks();

  // Default: no pages found
  mockPageFindFirst.mockResolvedValue(null);
  mockPageLinkFindMany.mockResolvedValue([]);
  mockPageFindMany.mockResolvedValue([]);
  mockBlockFindFirst.mockResolvedValue(null);
});

describe("assembleBulkContext", () => {
  test("returns contexts for multiple experiments", async () => {
    // First experiment found
    mockPageFindFirst
      .mockResolvedValueOnce({
        id: "exp-1-page",
        title: "EXP-001: Test A",
        oneLiner: "Test A",
      })
      // Second experiment found
      .mockResolvedValueOnce({
        id: "exp-2-page",
        title: "EXP-002: Test B",
        oneLiner: "Test B",
      });

    const result = await assembleBulkContext(
      TENANT_ID,
      [
        { experimentId: "EXP-001", depth: "default" },
        { experimentId: "EXP-002", depth: "default" },
      ],
      45000
    );

    expect(result.experimentCount).toBe(2);
    expect(result.experiments).toHaveLength(2);
    expect(result.experiments[0].experimentId).toBe("EXP-001");
    expect(result.experiments[1].experimentId).toBe("EXP-002");
    expect(result.maxTotalSize).toBe(45000);
  });

  test("returns error for not-found experiments without failing others", async () => {
    // First found, second not found
    mockPageFindFirst
      .mockResolvedValueOnce({
        id: "exp-1-page",
        title: "EXP-001: Test A",
        oneLiner: "Test A",
      })
      .mockResolvedValueOnce(null);

    const result = await assembleBulkContext(
      TENANT_ID,
      [
        { experimentId: "EXP-001", depth: "default" },
        { experimentId: "EXP-MISSING", depth: "default" },
      ],
      45000
    );

    expect(result.experiments).toHaveLength(2);
    expect(result.experiments[0].context).toBeDefined();
    expect(result.experiments[0].error).toBeUndefined();
    expect(result.experiments[1].error).toBe("not found");
    expect(result.experiments[1].context).toBeUndefined();
  });

  test("all experiments not found returns all errors", async () => {
    mockPageFindFirst.mockResolvedValue(null);

    const result = await assembleBulkContext(
      TENANT_ID,
      [
        { experimentId: "MISSING-1", depth: "default" },
        { experimentId: "MISSING-2", depth: "default" },
      ],
      45000
    );

    expect(result.experiments).toHaveLength(2);
    expect(result.experiments[0].error).toBe("not found");
    expect(result.experiments[1].error).toBe("not found");
    expect(result.totalSize).toBe(0);
  });

  test("primary experiment gets 60% budget allocation", async () => {
    mockPageFindFirst
      .mockResolvedValueOnce({
        id: "p1",
        title: "EXP-001",
        oneLiner: "A",
      })
      .mockResolvedValueOnce({
        id: "p2",
        title: "EXP-002",
        oneLiner: "B",
      });

    const result = await assembleBulkContext(
      TENANT_ID,
      [
        { experimentId: "EXP-001", depth: "default" },
        { experimentId: "EXP-002", depth: "default" },
      ],
      10000
    );

    // Primary should get 60% = 6000
    expect(result.experiments[0].allocated).toBe(6000);
    // Secondary should get 40% = 4000
    expect(result.experiments[1].allocated).toBe(4000);
  });

  test("single experiment gets full budget", async () => {
    mockPageFindFirst.mockResolvedValueOnce({
      id: "p1",
      title: "EXP-001",
      oneLiner: "A",
    });

    const result = await assembleBulkContext(
      TENANT_ID,
      [{ experimentId: "EXP-001", depth: "default" }],
      30000
    );

    expect(result.experiments[0].allocated).toBe(30000);
  });

  test("three experiments split budget correctly", async () => {
    mockPageFindFirst
      .mockResolvedValueOnce({ id: "p1", title: "E1", oneLiner: "A" })
      .mockResolvedValueOnce({ id: "p2", title: "E2", oneLiner: "B" })
      .mockResolvedValueOnce({ id: "p3", title: "E3", oneLiner: "C" });

    const result = await assembleBulkContext(
      TENANT_ID,
      [
        { experimentId: "E1", depth: "default" },
        { experimentId: "E2", depth: "default" },
        { experimentId: "E3", depth: "default" },
      ],
      10000
    );

    // Primary: 6000, Secondary: 2000 each
    expect(result.experiments[0].allocated).toBe(6000);
    expect(result.experiments[1].allocated).toBe(2000);
    expect(result.experiments[2].allocated).toBe(2000);
  });

  test("used size is capped at allocated budget", async () => {
    mockPageFindFirst.mockResolvedValueOnce({
      id: "p1",
      title: "EXP-001",
      oneLiner: "A",
    });

    // Very small budget
    const result = await assembleBulkContext(
      TENANT_ID,
      [{ experimentId: "EXP-001", depth: "default" }],
      1000
    );

    expect(result.experiments[0].used).toBeLessThanOrEqual(1000);
  });

  test("totalSize sums all used sizes", async () => {
    mockPageFindFirst
      .mockResolvedValueOnce({ id: "p1", title: "E1", oneLiner: "A" })
      .mockResolvedValueOnce(null);

    const result = await assembleBulkContext(
      TENANT_ID,
      [
        { experimentId: "E1", depth: "default" },
        { experimentId: "E2", depth: "default" },
      ],
      45000
    );

    const sumUsed = result.experiments.reduce((s, e) => s + e.used, 0);
    expect(result.totalSize).toBe(sumUsed);
  });

  test("extracts shared chemicals across experiments", async () => {
    // Two experiments that both link to THF
    let findFirstCallCount = 0;
    mockPageFindFirst.mockImplementation(() => {
      findFirstCallCount++;
      // Calls 1 & 2 are the experiment page lookups
      if (findFirstCallCount === 1)
        return Promise.resolve({ id: "exp-1", title: "EXP-001: Suzuki A", oneLiner: "A" });
      if (findFirstCallCount === 2)
        return Promise.resolve({ id: "exp-2", title: "EXP-002: Suzuki B", oneLiner: "B" });
      return Promise.resolve(null);
    });

    // Links for exp-1: THF + Pd(PPh3)4; links for exp-2: THF + K2CO3
    let linkCallCount = 0;
    mockPageLinkFindMany.mockImplementation(() => {
      linkCallCount++;
      // Calls are: exp-1 chemicals, exp-1 reactionTypes, exp-1 researchers,
      //            exp-2 chemicals, exp-2 reactionTypes, exp-2 researchers
      if (linkCallCount === 1) {
        return Promise.resolve([
          { targetPage: { id: "chem-thf", title: "THF", oneLiner: "Solvent", parentId: "cat-chem" } },
          { targetPage: { id: "chem-pd", title: "Pd(PPh3)4", oneLiner: "Catalyst", parentId: "cat-chem" } },
        ]);
      }
      if (linkCallCount === 4) {
        return Promise.resolve([
          { targetPage: { id: "chem-thf", title: "THF", oneLiner: "Solvent", parentId: "cat-chem" } },
          { targetPage: { id: "chem-k2co3", title: "K2CO3", oneLiner: "Base", parentId: "cat-chem" } },
        ]);
      }
      return Promise.resolve([]);
    });

    // Mock parent page for category filtering
    mockPageFindMany.mockImplementation((args: { where?: { id?: { in?: string[] } } }) => {
      if (args?.where?.id?.in) {
        return Promise.resolve(
          args.where.id.in.map((id: string) =>
            id === "cat-chem" ? { id: "cat-chem", title: "Chemicals" } : { id, title: "Other" }
          )
        );
      }
      return Promise.resolve([]);
    });

    const result = await assembleBulkContext(
      TENANT_ID,
      [
        { experimentId: "EXP-001", depth: "default" },
        { experimentId: "EXP-002", depth: "default" },
      ],
      45000
    );

    expect(result.sharedContext).toBeDefined();
    expect(result.sharedContext!.chemicals).toHaveLength(1);
    expect(result.sharedContext!.chemicals[0].name).toBe("THF");
    expect(result.sharedContext!.chemicals[0].usedBy).toEqual(["EXP-001", "EXP-002"]);
  });

  test("no shared context when experiments have no overlap", async () => {
    // Two experiments with completely different chemicals
    let findFirstCallCount = 0;
    mockPageFindFirst.mockImplementation(() => {
      findFirstCallCount++;
      if (findFirstCallCount === 1)
        return Promise.resolve({ id: "exp-1", title: "EXP-001", oneLiner: "A" });
      if (findFirstCallCount === 2)
        return Promise.resolve({ id: "exp-2", title: "EXP-002", oneLiner: "B" });
      return Promise.resolve(null);
    });

    // No shared links
    mockPageLinkFindMany.mockResolvedValue([]);

    const result = await assembleBulkContext(
      TENANT_ID,
      [
        { experimentId: "EXP-001", depth: "default" },
        { experimentId: "EXP-002", depth: "default" },
      ],
      45000
    );

    expect(result.sharedContext).toBeUndefined();
  });

  test("single experiment has no shared context", async () => {
    mockPageFindFirst.mockResolvedValueOnce({
      id: "p1",
      title: "EXP-001",
      oneLiner: "A",
    });

    const result = await assembleBulkContext(
      TENANT_ID,
      [{ experimentId: "EXP-001", depth: "default" }],
      30000
    );

    expect(result.sharedContext).toBeUndefined();
  });
});
