import { describe, test, expect, beforeEach, vi } from "vitest";
import { triageConfigFromEnv } from "@/lib/triage/config";
import type { CandidateFinding } from "@/lib/triage/types";

/**
 * Unit tests for the transactional finding writer against a hand-built prisma
 * mock. Proves the review-hardened WRITE rules without a live DB:
 *  - SET LOCAL statement_timeout (never a bare SET),
 *  - FOR UPDATE precondition recheck drops a candidate when the world moved,
 *  - partial-unique ON CONFLICT ... WHERE status IN (OPEN,ESCALATED,DEFERRED),
 *  - escalation gate + DEFERRED write,
 *  - single-owner jsonb_set contested write (no updated_at bump),
 *  - SourceRelevance upsert idempotency,
 *  - cursor advance in the SAME tx.
 */

const h = vi.hoisted(() => ({
  exec: [] as Array<{ sql: string; params: unknown[] }>,
  query: [] as Array<{ sql: string; params: unknown[] }>,
  // Controls what a precondition SELECT ... FOR UPDATE returns.
  preconditionRows: [] as unknown[],
  insertReturns: 1 as number,
}));

vi.mock("@/lib/db", () => {
  const tx = {
    $executeRawUnsafe: (sql: string, ...params: unknown[]) => {
      h.exec.push({ sql, params });
      return Promise.resolve(h.insertReturns);
    },
    $queryRawUnsafe: (sql: string, ...params: unknown[]) => {
      h.query.push({ sql, params });
      return Promise.resolve(h.preconditionRows);
    },
  };
  const prisma = {
    $transaction: (cb: (t: typeof tx) => unknown) => Promise.resolve(cb(tx)),
  };
  return { prisma };
});

const { writeFindingBatch } = await import("@/lib/triage/findingWriter");

const config = triageConfigFromEnv({ TRIAGE_ESCALATE_SEVERITY: "0.8" } as never);

function findExec(substr: string) {
  return h.exec.filter((e) => e.sql.includes(substr));
}

beforeEach(() => {
  h.exec = [];
  h.query = [];
  h.preconditionRows = [];
  h.insertReturns = 1;
});

describe("writeFindingBatch — SET LOCAL + partial unique", () => {
  test("issues SET LOCAL statement_timeout, never a bare SET", async () => {
    await writeFindingBatch({
      tenantId: "t1",
      pass: "DEDUP",
      candidates: [],
      relevance: [],
      nextCursor: null,
      config,
    });
    const setLocal = findExec("SET LOCAL statement_timeout");
    expect(setLocal).toHaveLength(1);
    // No bare `SET statement_timeout` (would leak onto the pooled connection).
    expect(h.exec.some((e) => /(^|\s)SET statement_timeout/.test(e.sql))).toBe(false);
  });

  test("insert targets the partial-unique index predicate", async () => {
    const c: CandidateFinding = {
      kind: "POSSIBLE_DUPLICATE",
      severity: 0.2,
      confidence: 0.5,
      pageId: "a",
      relatedPageId: "b",
      fingerprint: "fp1",
      evidence: {},
      precondition: { type: "none" },
    };
    const r = await writeFindingBatch({
      tenantId: "t1",
      pass: "DEDUP",
      candidates: [c],
      relevance: [],
      nextCursor: null,
      config,
    });
    const insert = findExec('INSERT INTO "triage_findings"')[0];
    expect(insert.sql).toContain(
      `ON CONFLICT ("fingerprint") WHERE "status" IN ('OPEN','ESCALATED','DEFERRED')`
    );
    expect(r.inserted).toBe(1);
  });
});

describe("writeFindingBatch — escalation + defer", () => {
  test("severity ≥ threshold ⇒ status ESCALATED param", async () => {
    const c: CandidateFinding = {
      kind: "CONTRADICTION_CANDIDATE",
      severity: 0.85,
      confidence: 0.8,
      claimId: "a",
      relatedClaimId: "b",
      fingerprint: "fp2",
      evidence: {},
      precondition: { type: "none" },
    };
    const r = await writeFindingBatch({
      tenantId: "t1",
      pass: "CONTRADICTION",
      candidates: [c],
      relevance: [],
      nextCursor: null,
      config,
    });
    const insert = findExec('INSERT INTO "triage_findings"')[0];
    // status is the 4th positional param ($4).
    expect(insert.params[3]).toBe("ESCALATED");
    expect(r.escalated).toBe(1);
  });

  test("deferred candidate writes status DEFERRED + nextAttemptAt", async () => {
    const next = new Date("2026-07-11T01:00:00Z");
    const c: CandidateFinding = {
      kind: "SOURCE_TAGGED",
      severity: 0,
      confidence: 0,
      sourceId: "s1",
      fingerprint: "fp3",
      evidence: {},
      precondition: { type: "none" },
      deferred: { reason: "ollama-unavailable", nextAttemptAt: next, attempts: 0 },
    };
    const r = await writeFindingBatch({
      tenantId: "t1",
      pass: "TAGGING",
      candidates: [c],
      relevance: [],
      nextCursor: null,
      config,
    });
    const insert = findExec('INSERT INTO "triage_findings"')[0];
    expect(insert.params[3]).toBe("DEFERRED");
    expect(insert.params[16]).toEqual(next); // next_attempt_at param
    expect(r.deferred).toBe(1);
  });
});

describe("writeFindingBatch — FOR UPDATE precondition recheck", () => {
  test("claimsActive: fewer locked rows than required ⇒ candidate dropped", async () => {
    h.preconditionRows = [{ id: "a" }]; // only 1 of 2 still ACTIVE
    const c: CandidateFinding = {
      kind: "CONTRADICTION_CANDIDATE",
      severity: 0.85,
      confidence: 0.8,
      claimId: "a",
      relatedClaimId: "b",
      fingerprint: "fp4",
      evidence: {},
      precondition: { type: "claimsActive", claimIds: ["a", "b"] },
    };
    const r = await writeFindingBatch({
      tenantId: "t1",
      pass: "CONTRADICTION",
      candidates: [c],
      relevance: [],
      nextCursor: null,
      config,
    });
    expect(r.droppedByPrecondition).toBe(1);
    expect(r.inserted).toBe(0);
    // The recheck was a FOR UPDATE lock on claims.
    const sel = h.query.find((q) => q.sql.includes("FROM \"claims\""));
    expect(sel?.sql).toContain("FOR UPDATE");
  });
});

describe("writeFindingBatch — contested jsonb_set + relevance + cursor", () => {
  test("STALE candidate triggers single-owner jsonb_set contested (no updated_at)", async () => {
    h.preconditionRows = [{ id: "c1" }];
    const c: CandidateFinding = {
      kind: "STALE",
      severity: 0.6,
      confidence: 0.9,
      pageId: "p1",
      claimId: "c1",
      fingerprint: "fp5",
      evidence: {},
      precondition: { type: "claimsActive", claimIds: ["c1"] },
    };
    const r = await writeFindingBatch({
      tenantId: "t1",
      pass: "STALENESS",
      candidates: [c],
      relevance: [],
      nextCursor: null,
      config,
    });
    const contested = findExec('UPDATE "pages"')[0];
    expect(contested.sql).toContain("jsonb_set");
    expect(contested.sql).toContain("knowledgeStatus");
    expect(contested.sql).toContain('"contested"');
    // Must NOT bump updated_at (would trip the stale-summary heuristic).
    expect(contested.sql).not.toContain("updated_at");
    // Consumes B1's deferred signal in the same statement.
    expect(contested.sql).toContain("pendingContested");
    expect(r.contestedPages).toBe(1);
  });

  test("SourceRelevance upsert is idempotent (ON CONFLICT DO UPDATE)", async () => {
    const r = await writeFindingBatch({
      tenantId: "t1",
      pass: "TAGGING",
      candidates: [],
      relevance: [{ sourceId: "s1", pageId: "p1", score: 0.7, modelDigest: "sha256:x" }],
      nextCursor: null,
      config,
    });
    const up = findExec('INSERT INTO "source_relevance"')[0];
    expect(up.sql).toContain(`ON CONFLICT ("tenant_id","source_id","page_id")`);
    expect(up.sql).toContain("DO UPDATE SET");
    expect(r.relevanceWritten).toBe(1);
  });

  test("cursor advances in the same tx via upsert on (tenant,pass)", async () => {
    await writeFindingBatch({
      tenantId: "t1",
      pass: "DEDUP",
      candidates: [],
      relevance: [],
      nextCursor: { cursorAt: new Date("2026-07-11"), cursorId: "z" },
      config,
    });
    const cur = findExec('INSERT INTO "triage_cursors"')[0];
    expect(cur.sql).toContain(`ON CONFLICT ("tenant_id","pass")`);
    expect(cur.params).toContain("z");
  });
});
