/**
 * W81-C1 — the transactional finding writer. The ONE place that persists a
 * batch's output, holding every review-hardened write rule together:
 *
 *  - **One interactive transaction** per batch (Prisma `$transaction(fn)` is
 *    bound to a single pooled connection under `@prisma/adapter-pg`), so the
 *    `SET LOCAL statement_timeout`, the `SELECT … FOR UPDATE` precondition
 *    rechecks, the finding inserts, the relevance upserts, and the cursor advance
 *    all commit or roll back together. A crash re-does a bounded batch.
 *  - **`SET LOCAL statement_timeout`** — never a bare `SET` (which would leak the
 *    worker's aggressive timeout onto later request-path queries on the recycled
 *    pooled connection — GLM R2).
 *  - **FOR UPDATE precondition recheck** — closes the TOCTOU vs B1/ingest/editor.
 *    The lock filter also enforces FK tenant-consistency (cross-tenant id → 0
 *    locked rows → candidate dropped).
 *  - **Partial-unique ON CONFLICT** — inserts target
 *    `uq_triage_findings_fingerprint_active` (the `WHERE status IN (...)`
 *    predicate is restated) so a live finding dedupes but a recurrence after
 *    DISMISS/RESOLVE can be re-flagged.
 *  - **Escalation at write time** — severity ≥ threshold ⇒ status ESCALATED
 *    (+ escalatedAt), unless the candidate is DEFERRED (Ollama-down).
 *  - **Cursor advance in the SAME tx** — even when the batch produced no finding,
 *    so scanned-but-clean rows are not re-scanned forever.
 */

import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import type { TriageConfig } from "./config";
import type {
  CandidateFinding,
  Keyset,
  Precondition,
  RelevanceUpsert,
  TriagePassT,
} from "./types";

/** Minimal interactive-tx surface used here (raw SQL only). */
interface RawTx {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
}

export interface WriteBatchResult {
  inserted: number;
  escalated: number;
  deferred: number;
  droppedByPrecondition: number;
  relevanceWritten: number;
  contestedPages: number;
}

const NON_TERMINAL = "('OPEN','ESCALATED','DEFERRED')";

/**
 * Recheck (and row-lock) a candidate's precondition inside the write tx. Returns
 * false when the world moved under us (claim superseded, page deleted, cross-
 * tenant id) so the candidate must be dropped.
 */
async function preconditionHolds(
  tx: RawTx,
  tenantId: string,
  pre: Precondition
): Promise<boolean> {
  switch (pre.type) {
    case "none":
      return true;
    case "claimsActive": {
      if (pre.claimIds.length === 0) return true;
      const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT "id" FROM "claims"
         WHERE "id" = ANY($1) AND "tenant_id" = $2 AND "status" = 'ACTIVE'
         FOR UPDATE`,
        pre.claimIds,
        tenantId
      );
      return rows.length === pre.claimIds.length;
    }
    case "pagesLive": {
      if (pre.pageIds.length === 0) return true;
      const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT "id" FROM "pages"
         WHERE "id" = ANY($1) AND "tenant_id" = $2 AND "deleted_at" IS NULL
         FOR UPDATE`,
        pre.pageIds,
        tenantId
      );
      return rows.length === pre.pageIds.length;
    }
    case "sourcePageLive": {
      const page = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT "id" FROM "pages"
         WHERE "id" = $1 AND "tenant_id" = $2 AND "deleted_at" IS NULL
         FOR UPDATE`,
        pre.pageId,
        tenantId
      );
      if (page.length !== 1) return false;
      const src = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT "id" FROM "sources" WHERE "id" = $1 AND "tenant_id" = $2`,
        pre.sourceId,
        tenantId
      );
      return src.length === 1;
    }
  }
}

function clampEvidence(evidence: unknown, maxChars: number): string {
  let json: string;
  try {
    json = JSON.stringify(evidence ?? {});
  } catch {
    json = "{}";
  }
  if (json.length > maxChars) {
    json = JSON.stringify({ truncated: true, bytes: json.length });
  }
  return json;
}

/**
 * Persist one batch atomically: preconditions → finding inserts → relevance
 * upserts → cursor advance.
 */
export async function writeFindingBatch(params: {
  tenantId: string;
  pass: TriagePassT;
  candidates: CandidateFinding[];
  relevance: RelevanceUpsert[];
  nextCursor: Keyset | null;
  config: TriageConfig;
}): Promise<WriteBatchResult> {
  const { tenantId, pass, candidates, relevance, nextCursor, config } = params;
  const result: WriteBatchResult = {
    inserted: 0,
    escalated: 0,
    deferred: 0,
    droppedByPrecondition: 0,
    relevanceWritten: 0,
    contestedPages: 0,
  };

  // Pages a STALE candidate (that passed its precondition) implicates — C1, as
  // the single owner of `knowledgeStatus`, marks them contested in THIS tx and
  // consumes B1's `pendingContested` signal atomically.
  const contestedPageIds = new Set<string>();

  await prisma.$transaction(async (txClient) => {
    const tx = txClient as unknown as RawTx;
    // SET LOCAL — scoped to THIS transaction only; never leaks onto the pool.
    await tx.$executeRawUnsafe(
      `SET LOCAL statement_timeout = ${Math.max(1, Math.floor(config.statementTimeoutMs))}`
    );

    for (const c of candidates) {
      if (!(await preconditionHolds(tx, tenantId, c.precondition))) {
        result.droppedByPrecondition++;
        continue;
      }
      if (c.kind === "STALE" && c.pageId) contestedPageIds.add(c.pageId);

      const now = new Date();
      let status = "OPEN";
      let escalatedAt: Date | null = null;
      let nextAttemptAt: Date | null = null;
      let deferReason: string | null = null;
      let attempts = 0;

      if (c.deferred) {
        status = "DEFERRED";
        deferReason = c.deferred.reason;
        nextAttemptAt = c.deferred.nextAttemptAt;
        attempts = c.deferred.attempts;
      } else if (c.severity >= config.escalateSeverity) {
        status = "ESCALATED";
        escalatedAt = now;
      }

      const inserted = await tx.$executeRawUnsafe(
        `INSERT INTO "triage_findings"
           ("id","tenant_id","kind","status","severity","confidence",
            "page_id","related_page_id","claim_id","related_claim_id","source_id",
            "fingerprint","evidence","model_digest","defer_reason","attempts",
            "next_attempt_at","escalated_at","created_at","updated_at")
         VALUES
           ($1,$2,$3::"TriageKind",$4::"TriageStatus",$5,$6,
            $7,$8,$9,$10,$11,
            $12,$13::jsonb,$14,$15,$16,
            $17,$18,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
         ON CONFLICT ("fingerprint") WHERE "status" IN ${NON_TERMINAL}
         DO NOTHING`,
        randomUUID(),
        tenantId,
        c.kind,
        status,
        c.severity,
        c.confidence,
        c.pageId ?? null,
        c.relatedPageId ?? null,
        c.claimId ?? null,
        c.relatedClaimId ?? null,
        c.sourceId ?? null,
        c.fingerprint,
        clampEvidence(c.evidence, config.maxEvidenceChars),
        c.modelDigest ?? null,
        deferReason,
        attempts,
        nextAttemptAt,
        escalatedAt
      );

      if (inserted > 0) {
        result.inserted++;
        if (status === "ESCALATED") result.escalated++;
        if (status === "DEFERRED") result.deferred++;
      }
    }

    // (b) SourceRelevance upserts — idempotent on (tenant, source, page).
    for (const r of relevance) {
      await tx.$executeRawUnsafe(
        `INSERT INTO "source_relevance"
           ("id","tenant_id","source_id","page_id","score","model_digest",
            "tagged_at","created_at","updated_at")
         VALUES ($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
         ON CONFLICT ("tenant_id","source_id","page_id")
         DO UPDATE SET "score" = EXCLUDED."score",
                       "model_digest" = EXCLUDED."model_digest",
                       "tagged_at" = CURRENT_TIMESTAMP,
                       "updated_at" = CURRENT_TIMESTAMP`,
        randomUUID(),
        tenantId,
        r.sourceId,
        r.pageId,
        r.score,
        r.modelDigest
      );
      result.relevanceWritten++;
    }

    // Single-owner `knowledgeStatus=contested` write (C1). ALWAYS via jsonb_set
    // on C1's OWN subkey (never a full-column Prisma JSON write — would clobber
    // concurrent writers to sibling subkeys) and NEVER bumps `updated_at` (a raw
    // UPDATE leaves Prisma's @updatedAt untouched, so pageTree.ts's
    // `updatedAt > summaryUpdatedAt` stale-summary heuristic is not tripped).
    // The same statement drops B1's `pendingContested` deferred signal.
    for (const pageId of contestedPageIds) {
      const n = await tx.$executeRawUnsafe(
        `UPDATE "pages"
         SET "properties" = jsonb_set(
           COALESCE("properties", '{}'::jsonb) - 'pendingContested',
           '{knowledgeStatus}', '"contested"'::jsonb, true)
         WHERE "id" = $1 AND "tenant_id" = $2 AND "deleted_at" IS NULL`,
        pageId,
        tenantId
      );
      if (n > 0) result.contestedPages++;
    }

    // Cursor advance IN THE SAME TX (crash re-does a bounded batch).
    if (nextCursor) {
      await tx.$executeRawUnsafe(
        `INSERT INTO "triage_cursors" ("id","tenant_id","pass","cursor_at","cursor_id","updated_at")
         VALUES ($1,$2,$3::"TriagePass",$4,$5,CURRENT_TIMESTAMP)
         ON CONFLICT ("tenant_id","pass")
         DO UPDATE SET "cursor_at" = EXCLUDED."cursor_at",
                       "cursor_id" = EXCLUDED."cursor_id",
                       "updated_at" = CURRENT_TIMESTAMP`,
        randomUUID(),
        tenantId,
        pass,
        nextCursor.cursorAt,
        nextCursor.cursorId
      );
    }
  });

  return result;
}

/**
 * Read a pass's keyset watermark. `(epoch, "")` when unset — the first run scans
 * from the beginning.
 */
export async function readCursor(
  tenantId: string,
  pass: TriagePassT
): Promise<Keyset> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{ cursor_at: Date | null; cursor_id: string | null }>
  >(
    `SELECT "cursor_at", "cursor_id" FROM "triage_cursors"
     WHERE "tenant_id" = $1 AND "pass" = $2::"TriagePass"`,
    tenantId,
    pass
  );
  const row = rows[0];
  if (!row || !row.cursor_at || !row.cursor_id) {
    return { cursorAt: new Date(0), cursorId: "" };
  }
  return { cursorAt: row.cursor_at, cursorId: row.cursor_id };
}
