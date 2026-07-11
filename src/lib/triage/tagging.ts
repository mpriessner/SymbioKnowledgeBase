/**
 * W81-C1 pass (b) — SOURCE-TO-CONCEPT tagging (local 7B, classification not
 * synthesis). Scans NEW `Source`s by the `(ingested_at, id)` keyset. For each,
 * shortlists candidate concept pages via pgvector: the source's chunks' nearest
 * OTHER chunks → the claims that cite them → those claims' pages (reuses A1
 * embeddings + A2 evidence). The cheap model then scores each (source, page)
 * relevance 0..1; scores ≥ threshold write an idempotent `SourceRelevance` row
 * and a low-severity `SOURCE_TAGGED` finding (the hand-off list to the frontier).
 *
 * Ollama down/missing-model ⇒ the pass does NOT skip and does NOT advance past
 * undone work silently: it writes ONE DEFERRED finding per source carrying the
 * candidate pages, retried with bounded backoff (resurrection).
 */

import { prisma } from "@/lib/db";
import type { TriageModel } from "@/lib/llm/ollamaClient";
import { OllamaUnavailableError } from "@/lib/llm/ollamaClient";
import type { TriageConfig } from "./config";
import { computeFingerprint } from "./fingerprint";
import { keysetClause } from "./keyset";
import { parseRelevanceScore } from "./modelParse";
import { nextAttemptAt } from "./defer";
import type { CandidateFinding, Keyset, PassResult } from "./types";

interface SourceRow {
  id: string;
  title: string;
  raw_text: string;
  ingested_at: Date;
}

/** Candidate concept pages for a source, via embedding neighbors → claims → pages. */
export async function candidatePagesForSource(
  tenantId: string,
  sourceId: string,
  neighbors: number
): Promise<Array<{ pageId: string; title: string; oneLiner: string | null }>> {
  return prisma.$queryRawUnsafe<
    Array<{ pageId: string; title: string; oneLiner: string | null }>
  >(
    `SELECT DISTINCT cl."page_id" AS "pageId", p."title" AS "title", p."one_liner" AS "oneLiner"
     FROM "source_chunks" sc
     JOIN LATERAL (
       SELECT osc."id"
       FROM "source_chunks" osc
       WHERE osc."tenant_id" = sc."tenant_id"
         AND osc."source_id" <> sc."source_id"
         AND osc."embedding" IS NOT NULL
       ORDER BY osc."embedding" <-> sc."embedding"
       LIMIT $3
     ) nn ON true
     JOIN "claim_evidence" ce ON ce."chunk_id" = nn."id" AND ce."tenant_id" = $1
     JOIN "claims" cl ON cl."id" = ce."claim_id" AND cl."tenant_id" = $1 AND cl."status" = 'ACTIVE'
     JOIN "pages" p ON p."id" = cl."page_id" AND p."tenant_id" = $1 AND p."deleted_at" IS NULL
     WHERE sc."tenant_id" = $1 AND sc."source_id" = $2 AND sc."embedding" IS NOT NULL
     LIMIT $3`,
    tenantId,
    sourceId,
    neighbors
  );
}

export const RELEVANCE_SYSTEM =
  "You classify whether a new source document is relevant to an existing " +
  "knowledge-base concept page. Reply with ONLY a number from 0 to 1 (relevance).";

export async function scanTagging(
  tenantId: string,
  cursor: Keyset,
  config: TriageConfig,
  model: TriageModel,
  modelReady: boolean
): Promise<PassResult> {
  const ks = keysetClause('"ingested_at"', '"id"', "$2", "$3");
  const sources = await prisma.$queryRawUnsafe<SourceRow[]>(
    `SELECT "id", "title", LEFT("raw_text", 1200) AS "raw_text", "ingested_at"
     FROM "sources"
     WHERE "tenant_id" = $1 AND ${ks.predicate}
     ORDER BY ${ks.order}
     LIMIT $4`,
    tenantId,
    cursor.cursorAt,
    cursor.cursorId,
    config.batchSize
  );

  const nextCursor: Keyset | null =
    sources.length > 0
      ? {
          cursorAt: sources[sources.length - 1].ingested_at,
          cursorId: sources[sources.length - 1].id,
        }
      : null;

  const candidates: CandidateFinding[] = [];
  const relevance: PassResult["relevance"] = [];

  for (const src of sources) {
    const candidatePages = await candidatePagesForSource(
      tenantId,
      src.id,
      config.vectorNeighbors
    );
    if (candidatePages.length === 0) continue;

    if (!modelReady) {
      // DEFER the whole source (bounded backoff + replay payload).
      candidates.push({
        kind: "SOURCE_TAGGED",
        severity: 0,
        confidence: 0,
        sourceId: src.id,
        fingerprint: computeFingerprint({
          kind: "SOURCE_TAGGED",
          participants: [src.id],
        }),
        evidence: {
          retry: {
            pass: "TAGGING",
            sourceId: src.id,
            candidatePageIds: candidatePages.map((p) => p.pageId),
          },
        },
        modelDigest: null,
        deferred: {
          reason: "ollama-unavailable",
          nextAttemptAt: nextAttemptAt(0, config),
          attempts: 0,
        },
        precondition: { type: "none" },
      });
      continue;
    }

    for (const page of candidatePages) {
      let score: number;
      try {
        const reply = await model.generate(
          `SOURCE: ${src.title}\n${src.raw_text}\n\nCONCEPT PAGE: ${page.title}` +
            (page.oneLiner ? ` — ${page.oneLiner}` : "") +
            `\n\nRelevance (0 to 1):`,
          RELEVANCE_SYSTEM
        );
        score = parseRelevanceScore(reply);
      } catch (err) {
        if (err instanceof OllamaUnavailableError) {
          // Model dropped mid-batch → DEFER the rest of this source and stop.
          candidates.push({
            kind: "SOURCE_TAGGED",
            severity: 0,
            confidence: 0,
            sourceId: src.id,
            fingerprint: computeFingerprint({
              kind: "SOURCE_TAGGED",
              participants: [src.id],
            }),
            evidence: {
              retry: {
                pass: "TAGGING",
                sourceId: src.id,
                candidatePageIds: candidatePages.map((p) => p.pageId),
              },
            },
            modelDigest: null,
            deferred: {
              reason: "ollama-unavailable-midbatch",
              nextAttemptAt: nextAttemptAt(0, config),
              attempts: 0,
            },
            precondition: { type: "none" },
          });
          break;
        }
        throw err;
      }

      if (score < config.relevanceThreshold) continue;

      relevance.push({
        sourceId: src.id,
        pageId: page.pageId,
        score,
        modelDigest: model.modelDigest ?? "unknown",
      });
      candidates.push({
        kind: "SOURCE_TAGGED",
        // Tagging is a hand-off signal, not urgent — never escalates.
        severity: Math.min(score * 0.5, 0.4),
        confidence: score,
        sourceId: src.id,
        pageId: page.pageId,
        fingerprint: computeFingerprint({
          kind: "SOURCE_TAGGED",
          participants: [src.id, page.pageId],
        }),
        evidence: { score, title: page.title },
        modelDigest: model.modelDigest ?? "unknown",
        precondition: { type: "sourcePageLive", sourceId: src.id, pageId: page.pageId },
      });
    }
  }

  return {
    scanned: sources.length,
    candidates,
    relevance,
    nextCursor,
    hasMore: sources.length === config.batchSize,
  };
}
