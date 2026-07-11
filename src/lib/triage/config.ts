/**
 * W81-C1 — triage worker tuning. All knobs are env-overridable so the escalation
 * economics (the primary regression risk) can be tuned WITHOUT a code change, and
 * so a config change measurably alters escalation volume (AC5). Defaults are
 * deliberately CONSERVATIVE on escalation (recall-over-precision surfacing at the
 * cheap tier; only genuinely severe findings cross to the frontier).
 */

export interface TriageConfig {
  /** Per-run wall-clock budget (ms). Cooperative — the current batch finishes. */
  runBudgetMs: number;
  /** Per-run cap on findings written (row budget). */
  maxFindings: number;
  /** Rows scanned per keyset batch, per pass. */
  batchSize: number;
  /** Pause between batches (ms) to yield DB to the request path. */
  batchPauseMs: number;
  /** SET LOCAL statement_timeout for scan transactions (ms). */
  statementTimeoutMs: number;
  /** severity ≥ this ⇒ finding is ESCALATED (the "urgent" gate). */
  escalateSeverity: number;
  /** pgvector cosine-distance ceiling for a near-duplicate candidate (0..2). */
  dedupMaxDistance: number;
  /** pgvector cosine-distance ceiling for a contradiction candidate neighbor. */
  contradictionMaxDistance: number;
  /** Neighbors retrieved per anchor in the embedding passes. */
  vectorNeighbors: number;
  /** Model relevance score ≥ this ⇒ a SourceRelevance row is written. */
  relevanceThreshold: number;
  /** DEFERRED backoff base (ms) and max retries before giving up. */
  deferBackoffMs: number;
  deferMaxRetries: number;
  /** Cap on serialized evidence JSON (chars) so a finding never stores a body. */
  maxEvidenceChars: number;
}

function num(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const v = env[key];
  if (v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function triageConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env
): TriageConfig {
  return {
    runBudgetMs: num(env, "TRIAGE_RUN_BUDGET_MS", 60_000),
    maxFindings: num(env, "TRIAGE_MAX_FINDINGS", 500),
    batchSize: num(env, "TRIAGE_BATCH_SIZE", 50),
    batchPauseMs: num(env, "TRIAGE_BATCH_PAUSE_MS", 100),
    statementTimeoutMs: num(env, "TRIAGE_STATEMENT_TIMEOUT_MS", 15_000),
    escalateSeverity: num(env, "TRIAGE_ESCALATE_SEVERITY", 0.8),
    dedupMaxDistance: num(env, "TRIAGE_DEDUP_MAX_DISTANCE", 0.15),
    contradictionMaxDistance: num(env, "TRIAGE_CONTRADICTION_MAX_DISTANCE", 0.35),
    vectorNeighbors: num(env, "TRIAGE_VECTOR_NEIGHBORS", 5),
    relevanceThreshold: num(env, "TRIAGE_RELEVANCE_THRESHOLD", 0.5),
    deferBackoffMs: num(env, "TRIAGE_DEFER_BACKOFF_MS", 300_000),
    deferMaxRetries: num(env, "TRIAGE_DEFER_MAX_RETRIES", 12),
    maxEvidenceChars: num(env, "TRIAGE_MAX_EVIDENCE_CHARS", 4_000),
  };
}

export const DEFAULT_TRIAGE_CONFIG = triageConfigFromEnv(
  {} as NodeJS.ProcessEnv
);
