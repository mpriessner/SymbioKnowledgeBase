import { describe, test, expect, beforeEach, vi } from "vitest";
import { triageConfigFromEnv } from "@/lib/triage/config";
import type { TriageModel } from "@/lib/llm/ollamaClient";

/**
 * Unit tests for the four passes' SCAN logic against a routed prisma mock:
 *  - per-pass keyset resume (cursor params in, nextCursor + hasMore out),
 *  - Ollama-down resilience: model passes DEFER (not skip, not crash),
 *  - deterministic staleness collision detection.
 */

const h = vi.hoisted(() => ({
  routes: [] as Array<{ match: string; rows: unknown[] }>,
  calls: [] as Array<{ sql: string; params: unknown[] }>,
}));

function route(sql: string): unknown[] {
  for (const r of h.routes) if (sql.includes(r.match)) return r.rows;
  return [];
}

vi.mock("@/lib/db", () => {
  const prisma = {
    $queryRawUnsafe: (sql: string, ...params: unknown[]) => {
      h.calls.push({ sql, params });
      return Promise.resolve(route(sql));
    },
  };
  return { prisma };
});

const { scanStaleness } = await import("@/lib/triage/staleness");
const { scanTagging } = await import("@/lib/triage/tagging");
const { scanContradictions } = await import("@/lib/triage/contradictionCandidates");

const config = triageConfigFromEnv({ TRIAGE_BATCH_SIZE: "2" } as never);

// A model that must NEVER be called when modelReady=false.
const forbiddenModel: TriageModel = {
  modelDigest: "sha256:test",
  checkReadiness: async () => ({ ready: true, modelDigest: "sha256:test" }),
  generate: async () => {
    throw new Error("model must not be called when Ollama is down");
  },
};

beforeEach(() => {
  h.routes = [];
  h.calls = [];
});

describe("staleness — keyset resume + deterministic collision", () => {
  test("passes the cursor into the anchor query and advances to the last row", async () => {
    const at = new Date("2026-06-01T00:00:00Z");
    h.routes = [
      {
        match: 'FROM "claims" c\n     JOIN "pages"',
        rows: [
          { id: "c1", page_id: "p1", tx_created: new Date("2026-06-02") },
          { id: "c2", page_id: "p1", tx_created: new Date("2026-06-03") },
        ],
      },
      {
        // page-claims load: a live collision (same subject/relation, 2 objects).
        match: 'c."page_id" = ANY($2)',
        rows: [
          { id: "c1", page_id: "p1", text: "The yield was 72%.", t_valid: new Date("2026-05-01") },
          { id: "c2", page_id: "p1", text: "The yield was 87%.", t_valid: new Date("2026-06-01") },
        ],
      },
    ];

    const res = await scanStaleness("t1", { cursorAt: at, cursorId: "c0" }, config);

    const anchorCall = h.calls.find((c) => c.sql.includes('FROM "claims" c'));
    expect(anchorCall?.params[1]).toEqual(at);
    expect(anchorCall?.params[2]).toBe("c0");
    // nextCursor = last anchor row.
    expect(res.nextCursor).toEqual({ cursorAt: new Date("2026-06-03"), cursorId: "c2" });
    // batchSize=2 and 2 rows scanned ⇒ hasMore.
    expect(res.hasMore).toBe(true);
    // One STALE collision finding (page-scoped, no LLM).
    expect(res.candidates).toHaveLength(1);
    expect(res.candidates[0].kind).toBe("STALE");
    expect(res.candidates[0].pageId).toBe("p1");
    expect(res.candidates[0].precondition).toEqual({
      type: "claimsActive",
      claimIds: ["c1", "c2"],
    });
  });

  test("no collision when a scoped key has a single object", async () => {
    h.routes = [
      {
        match: 'FROM "claims" c\n     JOIN "pages"',
        rows: [{ id: "c1", page_id: "p1", tx_created: new Date("2026-06-02") }],
      },
      {
        match: 'c."page_id" = ANY($2)',
        rows: [
          { id: "c1", page_id: "p1", text: "The yield was 87%.", t_valid: new Date("2026-05-01") },
        ],
      },
    ];
    const res = await scanStaleness("t1", { cursorAt: new Date(0), cursorId: "" }, config);
    expect(res.candidates).toHaveLength(0);
    expect(res.hasMore).toBe(false); // 1 < batchSize 2
  });
});

describe("tagging — Ollama-down defers (never skips or crashes)", () => {
  test("modelReady=false ⇒ one DEFERRED finding per source, model untouched", async () => {
    h.routes = [
      {
        match: 'FROM "sources"',
        rows: [
          { id: "s1", title: "T", raw_text: "body", ingested_at: new Date("2026-06-02") },
        ],
      },
      {
        match: "source_chunks",
        rows: [{ pageId: "p1", title: "Concept", oneLiner: null }],
      },
    ];
    const res = await scanTagging(
      "t1",
      { cursorAt: new Date(0), cursorId: "" },
      config,
      forbiddenModel,
      false
    );
    expect(res.candidates).toHaveLength(1);
    expect(res.candidates[0].deferred?.reason).toBe("ollama-unavailable");
    expect(res.candidates[0].sourceId).toBe("s1");
    expect(res.relevance).toHaveLength(0);
  });
});

describe("contradiction — Ollama-down defers with claimsActive precondition", () => {
  test("modelReady=false ⇒ DEFERRED candidate on the canonical claim pair", async () => {
    h.routes = [
      {
        match: 'FROM "claims" c\n     JOIN "pages"',
        rows: [{ id: "z9", page_id: "p1", text: "A", tx_created: new Date("2026-06-02") }],
      },
      {
        match: "GROUP BY cl2",
        rows: [{ claimId: "a1", text: "B", dist: 0.1 }],
      },
    ];
    const res = await scanContradictions(
      "t1",
      { cursorAt: new Date(0), cursorId: "" },
      config,
      forbiddenModel,
      false
    );
    expect(res.candidates).toHaveLength(1);
    const c = res.candidates[0];
    expect(c.deferred?.reason).toBe("ollama-unavailable");
    // canonicalized pair (a1 < z9).
    expect(c.claimId).toBe("a1");
    expect(c.relatedClaimId).toBe("z9");
    expect(c.precondition).toEqual({ type: "claimsActive", claimIds: ["a1", "z9"] });
  });
});
