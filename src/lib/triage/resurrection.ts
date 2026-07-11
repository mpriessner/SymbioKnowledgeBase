/**
 * W81-C1 — DEFERRED resurrection. Model passes wrote DEFERRED findings while
 * Ollama was down; this replays the DUE ones (bounded by budget) BEFORE any fresh
 * model work each run (GLM R2), so backlog drains first. Each retry either:
 *   - succeeds → the finding transitions to its real state (CONTRADICTION_CANDIDATE
 *     updated in place; TAGGING writes real SourceRelevance + per-page findings and
 *     RESOLVES the per-source placeholder), OR
 *   - fails again → bounded exponential backoff; after `deferMaxRetries` the item
 *     is DISMISSED (surfaced in the digest, not retried forever).
 * Ollama still down ⇒ resurrection is a no-op (leaves items DEFERRED).
 */

import { prisma } from "@/lib/db";
import type { TriageModel } from "@/lib/llm/ollamaClient";
import { OllamaUnavailableError } from "@/lib/llm/ollamaClient";
import type { TriageConfig } from "./config";
import { isExhausted, nextAttemptAt, type DeferRetry } from "./defer";
import {
  parseContradictionVerdict,
  contradictionSeverity,
} from "./modelParse";
import { CONTRADICTION_SYSTEM } from "./contradictionCandidates";
import {
  RELEVANCE_SYSTEM,
  candidatePagesForSource,
} from "./tagging";
import { parseRelevanceScore } from "./modelParse";
import { computeFingerprint } from "./fingerprint";
import { writeFindingBatch } from "./findingWriter";
import type { CandidateFinding } from "./types";

interface DeferredRow {
  id: string;
  kind: string;
  claim_id: string | null;
  related_claim_id: string | null;
  source_id: string | null;
  attempts: number;
  evidence: unknown;
}

export interface ResurrectionResult {
  processed: number;
  transitioned: number;
  redeferred: number;
  dismissed: number;
}

function retryPayload(evidence: unknown): DeferRetry | null {
  if (
    evidence &&
    typeof evidence === "object" &&
    "retry" in evidence &&
    (evidence as { retry?: unknown }).retry
  ) {
    return (evidence as { retry: DeferRetry }).retry;
  }
  return null;
}

async function bumpOrDismiss(
  tenantId: string,
  id: string,
  attempts: number,
  config: TriageConfig,
  result: ResurrectionResult
): Promise<void> {
  const next = attempts + 1;
  if (isExhausted(next, config)) {
    await prisma.$executeRawUnsafe(
      `UPDATE "triage_findings"
       SET "status" = 'DISMISSED', "attempts" = $3, "defer_reason" = 'max-retries-exhausted',
           "next_attempt_at" = NULL, "resolved_at" = CURRENT_TIMESTAMP, "updated_at" = CURRENT_TIMESTAMP
       WHERE "id" = $1 AND "tenant_id" = $2 AND "status" = 'DEFERRED'`,
      id,
      tenantId,
      next
    );
    result.dismissed++;
  } else {
    await prisma.$executeRawUnsafe(
      `UPDATE "triage_findings"
       SET "attempts" = $3, "next_attempt_at" = $4, "updated_at" = CURRENT_TIMESTAMP
       WHERE "id" = $1 AND "tenant_id" = $2 AND "status" = 'DEFERRED'`,
      id,
      tenantId,
      next,
      nextAttemptAt(next, config)
    );
    result.redeferred++;
  }
}

export async function processDeferred(
  tenantId: string,
  config: TriageConfig,
  model: TriageModel,
  budget: number
): Promise<ResurrectionResult> {
  const result: ResurrectionResult = {
    processed: 0,
    transitioned: 0,
    redeferred: 0,
    dismissed: 0,
  };

  const due = await prisma.$queryRawUnsafe<DeferredRow[]>(
    `SELECT "id","kind","claim_id","related_claim_id","source_id","attempts","evidence"
     FROM "triage_findings"
     WHERE "tenant_id" = $1 AND "status" = 'DEFERRED'
       AND ("next_attempt_at" IS NULL OR "next_attempt_at" <= CURRENT_TIMESTAMP)
     ORDER BY "next_attempt_at" ASC NULLS FIRST
     LIMIT $2`,
    tenantId,
    Math.max(1, budget)
  );

  for (const row of due) {
    result.processed++;
    const retry = retryPayload(row.evidence);

    try {
      if (row.kind === "CONTRADICTION_CANDIDATE" && row.claim_id && row.related_claim_id) {
        // Both claims must still be ACTIVE, else the candidate is moot.
        const claims = await prisma.$queryRawUnsafe<
          Array<{ id: string; text: string }>
        >(
          `SELECT "id","text" FROM "claims"
           WHERE "id" = ANY($2) AND "tenant_id" = $1 AND "status" = 'ACTIVE'`,
          tenantId,
          [row.claim_id, row.related_claim_id]
        );
        if (claims.length < 2) {
          await prisma.$executeRawUnsafe(
            `UPDATE "triage_findings"
             SET "status" = 'DISMISSED', "defer_reason" = 'claim-no-longer-active',
                 "next_attempt_at" = NULL, "resolved_at" = CURRENT_TIMESTAMP, "updated_at" = CURRENT_TIMESTAMP
             WHERE "id" = $1 AND "tenant_id" = $2 AND "status" = 'DEFERRED'`,
            row.id,
            tenantId
          );
          result.dismissed++;
          continue;
        }
        const a = claims.find((c) => c.id === row.claim_id)!;
        const b = claims.find((c) => c.id === row.related_claim_id)!;
        const reply = await model.generate(
          `A: ${a.text}\nB: ${b.text}\n\nDo A and B contradict? (yes/no/maybe):`,
          CONTRADICTION_SYSTEM
        );
        const verdict = parseContradictionVerdict(reply);
        const severity = contradictionSeverity(verdict);
        if (severity === 0) {
          await prisma.$executeRawUnsafe(
            `UPDATE "triage_findings"
             SET "status" = 'DISMISSED', "defer_reason" = NULL, "next_attempt_at" = NULL,
                 "model_digest" = $3, "resolved_at" = CURRENT_TIMESTAMP, "updated_at" = CURRENT_TIMESTAMP
             WHERE "id" = $1 AND "tenant_id" = $2 AND "status" = 'DEFERRED'`,
            row.id,
            tenantId,
            model.modelDigest ?? "unknown"
          );
          result.transitioned++;
          continue;
        }
        const status = severity >= config.escalateSeverity ? "ESCALATED" : "OPEN";
        await prisma.$executeRawUnsafe(
          `UPDATE "triage_findings"
           SET "status" = $3::"TriageStatus", "severity" = $4, "confidence" = $5,
               "model_digest" = $6, "defer_reason" = NULL, "next_attempt_at" = NULL,
               "evidence" = $7::jsonb,
               "escalated_at" = CASE WHEN $3 = 'ESCALATED' THEN CURRENT_TIMESTAMP ELSE NULL END,
               "updated_at" = CURRENT_TIMESTAMP
           WHERE "id" = $1 AND "tenant_id" = $2 AND "status" = 'DEFERRED'`,
          row.id,
          tenantId,
          status,
          severity,
          verdict === "yes" ? 0.8 : 0.5,
          model.modelDigest ?? "unknown",
          JSON.stringify({ verdict, resurrected: true })
        );
        result.transitioned++;
      } else if (row.kind === "SOURCE_TAGGED" && (row.source_id || retry?.sourceId)) {
        const sourceId = row.source_id ?? retry!.sourceId!;
        const srcRows = await prisma.$queryRawUnsafe<
          Array<{ id: string; title: string; raw_text: string }>
        >(
          `SELECT "id","title",LEFT("raw_text",1200) AS "raw_text"
           FROM "sources" WHERE "id" = $1 AND "tenant_id" = $2`,
          sourceId,
          tenantId
        );
        if (srcRows.length === 0) {
          await prisma.$executeRawUnsafe(
            `UPDATE "triage_findings"
             SET "status" = 'DISMISSED', "defer_reason" = 'source-gone',
                 "next_attempt_at" = NULL, "resolved_at" = CURRENT_TIMESTAMP, "updated_at" = CURRENT_TIMESTAMP
             WHERE "id" = $1 AND "tenant_id" = $2 AND "status" = 'DEFERRED'`,
            row.id,
            tenantId
          );
          result.dismissed++;
          continue;
        }
        const src = srcRows[0];
        const pages = await candidatePagesForSource(
          tenantId,
          sourceId,
          config.vectorNeighbors
        );
        const candidates: CandidateFinding[] = [];
        const relevance = [];
        for (const page of pages) {
          const reply = await model.generate(
            `SOURCE: ${src.title}\n${src.raw_text}\n\nCONCEPT PAGE: ${page.title}` +
              (page.oneLiner ? ` — ${page.oneLiner}` : "") +
              `\n\nRelevance (0 to 1):`,
            RELEVANCE_SYSTEM
          );
          const score = parseRelevanceScore(reply);
          if (score < config.relevanceThreshold) continue;
          relevance.push({
            sourceId,
            pageId: page.pageId,
            score,
            modelDigest: model.modelDigest ?? "unknown",
          });
          candidates.push({
            kind: "SOURCE_TAGGED",
            severity: Math.min(score * 0.5, 0.4),
            confidence: score,
            sourceId,
            pageId: page.pageId,
            fingerprint: computeFingerprint({
              kind: "SOURCE_TAGGED",
              participants: [sourceId, page.pageId],
            }),
            evidence: { score, title: page.title, resurrected: true },
            modelDigest: model.modelDigest ?? "unknown",
            precondition: {
              type: "sourcePageLive",
              sourceId,
              pageId: page.pageId,
            },
          });
        }
        await writeFindingBatch({
          tenantId,
          pass: "TAGGING",
          candidates,
          relevance,
          nextCursor: null,
          config,
        });
        // Resolve the per-source placeholder (its fingerprint frees up).
        await prisma.$executeRawUnsafe(
          `UPDATE "triage_findings"
           SET "status" = 'RESOLVED', "defer_reason" = NULL, "next_attempt_at" = NULL,
               "model_digest" = $3, "resolved_at" = CURRENT_TIMESTAMP, "updated_at" = CURRENT_TIMESTAMP
           WHERE "id" = $1 AND "tenant_id" = $2 AND "status" = 'DEFERRED'`,
          row.id,
          tenantId,
          model.modelDigest ?? "unknown"
        );
        result.transitioned++;
      } else {
        // Unknown/legacy deferred shape → dismiss so it can't wedge the queue.
        await bumpOrDismiss(tenantId, row.id, config.deferMaxRetries, config, result);
      }
    } catch (err) {
      if (err instanceof OllamaUnavailableError) {
        await bumpOrDismiss(tenantId, row.id, row.attempts, config, result);
        continue;
      }
      throw err;
    }
  }

  return result;
}
