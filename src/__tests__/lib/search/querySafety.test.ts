import { describe, test, expect, vi, beforeEach } from "vitest";

// Capture the Prisma.Sql objects passed to $queryRaw so we can assert that user
// input becomes a BOUND parameter, never concatenated into the SQL text (S12).
const queryRawCalls: Array<{ text: string; values: unknown[] }> = [];

vi.mock("@/lib/db", () => ({
  prisma: {
    // $queryRaw is called BOTH ways: as $queryRaw(Prisma.sql`...`) (one Sql arg)
    // and as a tagged template $queryRaw`...` ((strings, ...values)). Handle both
    // so we can assert user input is a bound value, not inlined SQL text.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $queryRaw: vi.fn((first: any, ...rest: unknown[]) => {
      if (first && typeof first === "object" && !Array.isArray(first) && "values" in first) {
        // Prisma.Sql object form.
        queryRawCalls.push({
          text: (first.sql ?? first.text ?? "") as string,
          values: (first.values ?? []) as unknown[],
        });
      } else {
        // Tagged-template form: first = TemplateStringsArray, rest = values.
        const strings = first as string[];
        queryRawCalls.push({ text: strings.join(" ? "), values: rest });
      }
      return Promise.resolve([]);
    }),
  },
}));

const { enhancedSearchBlocks, searchBlocks } = await import("@/lib/search/query");

const TENANT = "tenant-abc";
const INJECTION = "'; DROP TABLE pages; --";

beforeEach(() => {
  queryRawCalls.length = 0;
});

describe("search SQL composition is parameterized (audit S12)", () => {
  test("enhancedSearchBlocks binds a SQL-metacharacter query, never inlines it", async () => {
    // ftsSearch returns total 0 (empty), so the keyword fallback runs too.
    const res = await enhancedSearchBlocks(INJECTION, TENANT);
    expect(res).toEqual({ results: [], total: 0 });
    expect(queryRawCalls.length).toBeGreaterThan(0);

    for (const call of queryRawCalls) {
      // The raw query text must NOT contain the injection literal — it must be
      // a bound value instead.
      expect(call.text).not.toContain("DROP TABLE");
      // The injection (or its ILIKE-wrapped form) appears only in the values.
      const valuesStr = JSON.stringify(call.values);
      expect(valuesStr).toContain("DROP TABLE");
    }
  });

  test("searchBlocks binds the query text as a parameter", async () => {
    await searchBlocks(INJECTION, TENANT);
    expect(queryRawCalls.length).toBe(1);
    const call = queryRawCalls[0];
    expect(call.text).not.toContain("DROP TABLE");
    expect(JSON.stringify(call.values)).toContain("DROP TABLE");
  });

  test("empty query short-circuits without any SQL", async () => {
    const res = await enhancedSearchBlocks("   ", TENANT);
    expect(res).toEqual({ results: [], total: 0 });
    expect(queryRawCalls.length).toBe(0);
  });
});
