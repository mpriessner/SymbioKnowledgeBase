/**
 * W81-C1 — shared triage types.
 */

export type TriageKindT =
  | "STALE"
  | "SOURCE_TAGGED"
  | "POSSIBLE_DUPLICATE"
  | "CONTRADICTION_CANDIDATE";

export type TriagePassT = "STALENESS" | "TAGGING" | "DEDUP" | "CONTRADICTION";

/**
 * A FOR-UPDATE precondition rechecked in the SAME transaction that writes the
 * finding — closes the TOCTOU where B1/ingest/editor mutate the world in the gap
 * between scan and write (GLM R2). The recheck both LOCKS the row and enforces
 * tenant-consistency (the WHERE filters tenant_id, so a cross-tenant id yields 0
 * rows → the candidate is dropped).
 */
export type Precondition =
  | { type: "none" }
  | { type: "claimsActive"; claimIds: string[] }
  | { type: "pagesLive"; pageIds: string[] }
  | { type: "sourcePageLive"; sourceId: string; pageId: string };

/** Keyset watermark over the pass's scanned anchor entity. */
export interface Keyset {
  cursorAt: Date;
  cursorId: string;
}

/** A finding a pass wants written (before dedup/escalation gating). */
export interface CandidateFinding {
  kind: TriageKindT;
  severity: number;
  confidence: number;
  pageId?: string | null;
  relatedPageId?: string | null;
  claimId?: string | null;
  relatedClaimId?: string | null;
  sourceId?: string | null;
  fingerprint: string;
  evidence: unknown;
  modelDigest?: string | null;
  /** When set, the finding is written DEFERRED (Ollama-down) with this backoff. */
  deferred?: { reason: string; nextAttemptAt: Date; attempts: number };
  /** FOR-UPDATE precondition to recheck at write time. */
  precondition: Precondition;
}

/** A (b) source→concept tag to upsert idempotently. */
export interface RelevanceUpsert {
  sourceId: string;
  pageId: string;
  score: number;
  modelDigest: string;
}

export interface PassResult {
  scanned: number;
  candidates: CandidateFinding[];
  relevance: RelevanceUpsert[];
  /** The new keyset watermark after this batch (null = nothing scanned). */
  nextCursor: Keyset | null;
  /** Whether more rows remain for this pass (drives the worker's loop). */
  hasMore: boolean;
}
