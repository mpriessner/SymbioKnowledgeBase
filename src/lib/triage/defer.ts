/**
 * W81-C1 — bounded DEFERRED backoff. Model passes (b)/(d) write DEFERRED findings
 * when Ollama is down; a per-tenant retry storm is avoided with exponential
 * backoff capped at a ceiling, plus a hard max-retries after which the item is
 * DISMISSED (surfaced in the digest, not retried forever). Resurrection is
 * processed BEFORE fresh model work each run (GLM R2).
 */

import type { TriageConfig } from "./config";

/** The retry payload a DEFERRED finding stores in its evidence to be replayable. */
export interface DeferRetry {
  pass: "TAGGING" | "CONTRADICTION";
  sourceId?: string;
  claimId?: string;
  relatedClaimId?: string;
  candidatePageIds?: string[];
}

/** Next attempt time with exponential backoff capped at 8× the base. */
export function nextAttemptAt(
  attempts: number,
  config: TriageConfig,
  now: Date = new Date()
): Date {
  const factor = Math.min(2 ** attempts, 8);
  return new Date(now.getTime() + config.deferBackoffMs * factor);
}

/** Whether a DEFERRED finding has exhausted its retries and should be DISMISSED. */
export function isExhausted(attempts: number, config: TriageConfig): boolean {
  return attempts >= config.deferMaxRetries;
}
