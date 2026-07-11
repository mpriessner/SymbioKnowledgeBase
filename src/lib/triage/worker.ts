/**
 * W81-C1 — the bounded triage sweep (NOT a `while(true)` daemon). Mirrors
 * `scripts/agent-sweep.ts`: one time/row-budgeted, externally-scheduled run that
 * exits COOPERATIVELY — it finishes and commits the current batch (keeping the
 * cursor-advance-in-same-tx invariant), then returns; the caller releases the
 * advisory lock and `$disconnect`s. It never truncates mid-batch.
 *
 * Order per run (GLM R2):
 *   1. readiness check (configured model loaded?) → pins the model digest,
 *   2. DEFERRED resurrection FIRST (drain backlog before fresh model work),
 *   3. the four passes, each keyset-resumed and batched, with a pause between
 *      batches and NO DB tx/connection held across an Ollama call.
 * Deterministic passes (staleness, dedup) run even when Ollama is down; model
 * passes (tagging, contradiction) then write DEFERRED work instead of crashing.
 *
 * Concurrency is guarded by the per-tenant advisory lock (see advisoryLock.ts);
 * this function assumes it is already held (the CLI wraps it in `withTenantLock`).
 */

import { prisma } from "@/lib/db";
import {
  OllamaClient,
  ollamaConfigFromEnv,
  type TriageModel,
} from "@/lib/llm/ollamaClient";
import { triageConfigFromEnv, type TriageConfig } from "./config";
import { readCursor, writeFindingBatch } from "./findingWriter";
import { scanStaleness } from "./staleness";
import { scanDedup } from "./dedup";
import { scanTagging } from "./tagging";
import { scanContradictions } from "./contradictionCandidates";
import { processDeferred } from "./resurrection";
import type { PassResult, TriagePassT } from "./types";

export interface TriageRunReport {
  runId: string;
  tenantId: string;
  status: "COMPLETED" | "BUDGET_EXHAUSTED" | "FAILED";
  modelReady: boolean;
  modelDigest: string | null;
  stats: Record<string, unknown>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface SweepDeps {
  config?: TriageConfig;
  model?: TriageModel;
  /** Injected readiness result (tests); else derived from the model. */
  modelReady?: boolean;
  /** Wall-clock source (tests). */
  now?: () => number;
}

export async function runTriageSweep(
  tenantId: string,
  budget: number,
  deps: SweepDeps = {}
): Promise<TriageRunReport> {
  const config = deps.config ?? triageConfigFromEnv();
  const now = deps.now ?? (() => Date.now());
  const model =
    deps.model ?? new OllamaClient(ollamaConfigFromEnv());

  // 1. Readiness — configured model LOADED, not just port-reachable.
  let modelReady = deps.modelReady ?? false;
  let modelDigest: string | null = model.modelDigest ?? null;
  if (deps.modelReady === undefined) {
    const readiness = await model.checkReadiness();
    modelReady = readiness.ready;
    modelDigest = readiness.modelDigest;
  }

  const started = now();
  const runRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `INSERT INTO "triage_runs" ("id","tenant_id","status","budget","model_digest","stats","started_at")
     VALUES (gen_random_uuid()::text, $1, 'RUNNING', $2, $3, '{}'::jsonb, CURRENT_TIMESTAMP)
     RETURNING "id"`,
    tenantId,
    budget,
    modelDigest
  );
  const runId = runRows[0].id;

  const stats: Record<string, number> = {
    stalenessScanned: 0,
    dedupScanned: 0,
    taggingScanned: 0,
    contradictionScanned: 0,
    inserted: 0,
    escalated: 0,
    deferred: 0,
    contestedPages: 0,
    relevanceWritten: 0,
    droppedByPrecondition: 0,
    resurrectionTransitioned: 0,
    resurrectionRedeferred: 0,
    resurrectionDismissed: 0,
  };

  const budgetHit = () =>
    now() - started >= config.runBudgetMs || stats.inserted >= config.maxFindings;

  let status: TriageRunReport["status"] = "COMPLETED";

  try {
    // 2. Resurrection FIRST (only meaningful when the model is back up).
    if (modelReady && !budgetHit()) {
      const r = await processDeferred(
        tenantId,
        config,
        model,
        Math.min(budget, config.maxFindings)
      );
      stats.resurrectionTransitioned += r.transitioned;
      stats.resurrectionRedeferred += r.redeferred;
      stats.resurrectionDismissed += r.dismissed;
    }

    // 3. The four passes, each drained in keyset-resumed batches until no more
    //    rows OR the cooperative budget is hit (never truncating a batch).
    const scanners: Array<{
      pass: TriagePassT;
      scannedKey: keyof typeof stats;
      scan: () => Promise<PassResult>;
    }> = [
      {
        pass: "STALENESS",
        scannedKey: "stalenessScanned",
        scan: async () =>
          scanStaleness(tenantId, await readCursor(tenantId, "STALENESS"), config),
      },
      {
        pass: "DEDUP",
        scannedKey: "dedupScanned",
        scan: async () =>
          scanDedup(tenantId, await readCursor(tenantId, "DEDUP"), config),
      },
      {
        pass: "TAGGING",
        scannedKey: "taggingScanned",
        scan: async () =>
          scanTagging(
            tenantId,
            await readCursor(tenantId, "TAGGING"),
            config,
            model,
            modelReady
          ),
      },
      {
        pass: "CONTRADICTION",
        scannedKey: "contradictionScanned",
        scan: async () =>
          scanContradictions(
            tenantId,
            await readCursor(tenantId, "CONTRADICTION"),
            config,
            model,
            modelReady
          ),
      },
    ];

    for (const s of scanners) {
      // Drain this pass; each iteration is a bounded, committed batch.
      for (;;) {
        if (budgetHit()) {
          status = "BUDGET_EXHAUSTED";
          break;
        }
        const result = await s.scan();
        stats[s.scannedKey] += result.scanned;
        const w = await writeFindingBatch({
          tenantId,
          pass: s.pass,
          candidates: result.candidates,
          relevance: result.relevance,
          nextCursor: result.nextCursor,
          config,
        });
        stats.inserted += w.inserted;
        stats.escalated += w.escalated;
        stats.deferred += w.deferred;
        stats.contestedPages += w.contestedPages;
        stats.relevanceWritten += w.relevanceWritten;
        stats.droppedByPrecondition += w.droppedByPrecondition;

        if (!result.hasMore) break;
        if (config.batchPauseMs > 0) await sleep(config.batchPauseMs);
      }
      if (status === "BUDGET_EXHAUSTED") break;
    }
  } catch (err) {
    status = "FAILED";
    stats.error = 0;
    await finalizeRun(runId, tenantId, "FAILED", {
      ...stats,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  await finalizeRun(runId, tenantId, status, stats);

  return { runId, tenantId, status, modelReady, modelDigest, stats };
}

async function finalizeRun(
  runId: string,
  tenantId: string,
  status: string,
  stats: Record<string, unknown>
): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE "triage_runs"
     SET "status" = $3::"TriageRunStatus", "stats" = $4::jsonb, "completed_at" = CURRENT_TIMESTAMP
     WHERE "id" = $1 AND "tenant_id" = $2`,
    runId,
    tenantId,
    status,
    JSON.stringify(stats)
  );
}
