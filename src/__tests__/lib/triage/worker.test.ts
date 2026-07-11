import { describe, test, expect, beforeEach, vi } from "vitest";
import { triageConfigFromEnv } from "@/lib/triage/config";
import type { TriageModel } from "@/lib/llm/ollamaClient";

/**
 * Unit tests for the bounded sweep orchestration:
 *  - cooperative budget exit (finish/commit, then stop — status BUDGET_EXHAUSTED),
 *  - clean drain to COMPLETED when there is no work,
 *  - deterministic passes run even with the model down (modelReady=false).
 */

const h = vi.hoisted(() => ({
  query: [] as Array<{ sql: string; params: unknown[] }>,
  exec: [] as Array<{ sql: string; params: unknown[] }>,
  txExec: [] as string[],
}));

vi.mock("@/lib/db", () => {
  const tx = {
    $executeRawUnsafe: (sql: string) => {
      h.txExec.push(sql);
      return Promise.resolve(0);
    },
    $queryRawUnsafe: () => Promise.resolve([]),
  };
  const prisma = {
    $queryRawUnsafe: (sql: string, ...params: unknown[]) => {
      h.query.push({ sql, params });
      if (sql.includes('INSERT INTO "triage_runs"')) {
        return Promise.resolve([{ id: "run1" }]);
      }
      return Promise.resolve([]);
    },
    $executeRawUnsafe: (sql: string, ...params: unknown[]) => {
      h.exec.push({ sql, params });
      return Promise.resolve(1);
    },
    $transaction: (cb: (t: typeof tx) => unknown) => Promise.resolve(cb(tx)),
  };
  return { prisma };
});

const { runTriageSweep } = await import("@/lib/triage/worker");

const model: TriageModel = {
  modelDigest: "sha256:x",
  checkReadiness: async () => ({ ready: false, modelDigest: null }),
  generate: async () => "",
};

beforeEach(() => {
  h.query = [];
  h.exec = [];
  h.txExec = [];
});

describe("cooperative budget exit", () => {
  test("wall-clock over budget ⇒ BUDGET_EXHAUSTED, no batch truncated", async () => {
    // now(): first call = run-start (0); every later call jumps past the budget.
    let n = 0;
    const now = () => (n++ === 0 ? 0 : 10_000_000);
    const report = await runTriageSweep("t1", 100, {
      config: triageConfigFromEnv({ TRIAGE_RUN_BUDGET_MS: "1000" } as never),
      model,
      modelReady: false,
      now,
    });
    expect(report.status).toBe("BUDGET_EXHAUSTED");
    // The run row was finalized BUDGET_EXHAUSTED.
    const fin = h.exec.find(
      (e) => e.sql.includes('UPDATE "triage_runs"') && e.params.includes("BUDGET_EXHAUSTED")
    );
    expect(fin).toBeTruthy();
  });
});

describe("clean drain", () => {
  test("no work ⇒ COMPLETED; deterministic passes still ran with model down", async () => {
    const report = await runTriageSweep("t1", 100, {
      config: triageConfigFromEnv({ TRIAGE_BATCH_PAUSE_MS: "0" } as never),
      model,
      modelReady: false,
      now: () => 0,
    });
    expect(report.status).toBe("COMPLETED");
    expect(report.modelReady).toBe(false);
    // Each pass committed a (empty) batch → SET LOCAL statement_timeout issued.
    expect(h.txExec.some((s) => s.includes("SET LOCAL statement_timeout"))).toBe(true);
  });
});
