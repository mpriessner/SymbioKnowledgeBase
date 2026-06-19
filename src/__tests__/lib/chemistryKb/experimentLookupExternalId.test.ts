import { describe, test, expect, vi, beforeEach } from "vitest";

/**
 * Data-loss regression: the experiment finder used to match by
 * `title.startsWith(elnId)`, so a sync for `EXP-1` could resolve to the page
 * for `EXP-12` and overwrite the wrong experiment's knowledge. The finder now
 * keys on the exact `Page.externalId`, with a constrained title fallback only
 * for legacy rows that predate externalId.
 */

const mockFindFirst = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    page: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
  },
}));

vi.mock("@/lib/chemistryKb/setupHierarchy", () => ({
  setupChemistryKbHierarchy: vi.fn().mockResolvedValue({
    experimentsId: "experiments-folder",
    archiveId: "archive-folder",
    teamspaceId: "ts-1",
  }),
}));

const { findExperimentByElnId } = await import(
  "@/lib/chemistryKb/experimentLookup"
);

const TENANT = "tenant-1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("findExperimentByElnId — exact externalId idempotency key", () => {
  test("looks up by exact externalId first (not a title prefix)", async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: "page-exp-1",
      title: "EXP-1: Aldol",
      parentId: null,
    });

    const result = await findExperimentByElnId(TENANT, "EXP-1");

    expect(result?.id).toBe("page-exp-1");
    // First query must be the exact externalId lookup.
    const firstCallWhere = mockFindFirst.mock.calls[0][0].where;
    expect(firstCallWhere).toMatchObject({
      tenantId: TENANT,
      externalId: "EXP-1",
    });
    // A startsWith title clause must NOT be how we primarily match.
    expect(firstCallWhere.title).toBeUndefined();
  });

  test("EXP-1 does not match the EXP-12 row via the externalId lookup", async () => {
    // externalId lookup misses (no exact EXP-1), and the legacy fallback also
    // misses because its title clause is constrained to exact / 'EXP-1:' /
    // 'EXP-1 ' — never a bare startsWith that 'EXP-12: ...' would satisfy.
    mockFindFirst.mockResolvedValue(null);

    const result = await findExperimentByElnId(TENANT, "EXP-1");

    expect(result).toBeNull();

    // The legacy fallback query (2nd call) only targets externalId-null rows
    // and uses constrained title matchers, not an open prefix.
    const fallbackWhere = mockFindFirst.mock.calls[1][0].where;
    expect(fallbackWhere.externalId).toBeNull();
    const titleClauses = JSON.stringify(fallbackWhere.OR);
    expect(titleClauses).toContain("EXP-1:");
    expect(titleClauses).toContain("EXP-1 ");
    // Must not contain a bare unconstrained startsWith of just "EXP-1".
    expect(fallbackWhere.OR).toEqual([
      { title: "EXP-1" },
      { title: { startsWith: "EXP-1:" } },
      { title: { startsWith: "EXP-1 " } },
    ]);
  });

  test("falls back to a constrained title match for legacy rows", async () => {
    mockFindFirst
      .mockResolvedValueOnce(null) // externalId miss
      .mockResolvedValueOnce({
        id: "legacy-page",
        title: "EXP-7: Legacy",
        parentId: null,
      });

    const result = await findExperimentByElnId(TENANT, "EXP-7");

    expect(result?.id).toBe("legacy-page");
    expect(mockFindFirst).toHaveBeenCalledTimes(2);
  });
});
