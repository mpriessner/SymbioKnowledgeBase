import { describe, test, expect, beforeEach, vi } from "vitest";
import { triageConfigFromEnv } from "@/lib/triage/config";
import type { TriageModel } from "@/lib/llm/ollamaClient";
import { OllamaUnavailableError } from "@/lib/llm/ollamaClient";

/**
 * Unit tests for DEFERRED resurrection: a due contradiction placeholder
 * transitions in place on a "yes" verdict; a repeated Ollama failure backs off
 * (bounded) and DISMISSES only after max retries.
 */

const h = vi.hoisted(() => ({
  routes: [] as Array<{ match: string; rows: unknown[] }>,
  exec: [] as Array<{ sql: string; params: unknown[] }>,
}));

function route(sql: string): unknown[] {
  for (const r of h.routes) if (sql.includes(r.match)) return r.rows;
  return [];
}

vi.mock("@/lib/db", () => {
  const prisma = {
    $queryRawUnsafe: (sql: string) => Promise.resolve(route(sql)),
    $executeRawUnsafe: (sql: string, ...params: unknown[]) => {
      h.exec.push({ sql, params });
      return Promise.resolve(1);
    },
  };
  return { prisma };
});

const { processDeferred } = await import("@/lib/triage/resurrection");

const config = triageConfigFromEnv({
  TRIAGE_ESCALATE_SEVERITY: "0.8",
  TRIAGE_DEFER_MAX_RETRIES: "3",
} as never);

function model(gen: () => Promise<string>): TriageModel {
  return {
    modelDigest: "sha256:x",
    checkReadiness: async () => ({ ready: true, modelDigest: "sha256:x" }),
    generate: gen,
  };
}

const dueContradiction = {
  id: "f1",
  kind: "CONTRADICTION_CANDIDATE",
  claim_id: "a",
  related_claim_id: "b",
  source_id: null,
  attempts: 0,
  evidence: { retry: { pass: "CONTRADICTION", claimId: "a", relatedClaimId: "b" } },
};

beforeEach(() => {
  h.routes = [];
  h.exec = [];
});

describe("resurrection — contradiction transition", () => {
  test("yes verdict transitions the placeholder to ESCALATED in place", async () => {
    h.routes = [
      { match: `"status" = 'DEFERRED'`, rows: [dueContradiction] },
      {
        match: 'FROM "claims"',
        rows: [
          { id: "a", text: "A" },
          { id: "b", text: "B" },
        ],
      },
    ];
    const r = await processDeferred("t1", config, model(async () => "yes"), 10);
    expect(r.transitioned).toBe(1);
    const upd = h.exec.find(
      (e) => e.sql.includes('UPDATE "triage_findings"') && e.params.includes("ESCALATED")
    );
    expect(upd).toBeTruthy();
  });

  test("claims no longer both ACTIVE ⇒ dismissed as moot", async () => {
    h.routes = [
      { match: `"status" = 'DEFERRED'`, rows: [dueContradiction] },
      { match: 'FROM "claims"', rows: [{ id: "a", text: "A" }] }, // only 1 active
    ];
    const r = await processDeferred("t1", config, model(async () => "yes"), 10);
    expect(r.dismissed).toBe(1);
    expect(r.transitioned).toBe(0);
  });
});

describe("resurrection — bounded backoff on repeated Ollama failure", () => {
  test("below max retries ⇒ re-deferred with a later next_attempt_at", async () => {
    h.routes = [
      { match: `"status" = 'DEFERRED'`, rows: [{ ...dueContradiction, attempts: 0 }] },
      { match: 'FROM "claims"', rows: [{ id: "a", text: "A" }, { id: "b", text: "B" }] },
    ];
    const r = await processDeferred(
      "t1",
      config,
      model(async () => {
        throw new OllamaUnavailableError("down");
      }),
      10
    );
    expect(r.redeferred).toBe(1);
    expect(r.dismissed).toBe(0);
    const upd = h.exec.find((e) => e.sql.includes("next_attempt_at"));
    expect(upd).toBeTruthy();
  });

  test("at max retries ⇒ DISMISSED (not retried forever)", async () => {
    h.routes = [
      { match: `"status" = 'DEFERRED'`, rows: [{ ...dueContradiction, attempts: 2 }] },
      { match: 'FROM "claims"', rows: [{ id: "a", text: "A" }, { id: "b", text: "B" }] },
    ];
    const r = await processDeferred(
      "t1",
      config,
      model(async () => {
        throw new OllamaUnavailableError("down");
      }),
      10
    );
    expect(r.dismissed).toBe(1);
    const upd = h.exec.find((e) => e.sql.includes("max-retries-exhausted"));
    expect(upd).toBeTruthy();
  });
});
