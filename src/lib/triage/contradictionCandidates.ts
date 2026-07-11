/**
 * W81-C1 pass (d) — CONTRADICTION candidates. Embedding-retrieve semantically-near
 * claim pairs, then the cheap model answers ONLY "do these disagree? yes/no/maybe"
 * — it surfaces canonicalized candidates, it does NOT resolve them (that is C2's
 * frontier job; B1's ambiguous deferrals also land here). Anchored on ACTIVE
 * claims by the `(tx_created, id)` keyset; embedding retrieval finds near claims,
 * pairs are CANONICALIZED `(min,max)` claim ids so `(A,B)`/`(B,A)` collapse.
 *
 * Ollama down/missing-model ⇒ per-pair DEFERRED findings (bounded backoff +
 * replay payload), never a skip and never a crash.
 */

import { prisma } from "@/lib/db";
import type { TriageModel } from "@/lib/llm/ollamaClient";
import { OllamaUnavailableError } from "@/lib/llm/ollamaClient";
import type { TriageConfig } from "./config";
import { canonicalPair, computeFingerprint } from "./fingerprint";
import { keysetClause } from "./keyset";
import {
  contradictionSeverity,
  parseContradictionVerdict,
} from "./modelParse";
import { nextAttemptAt } from "./defer";
import type { CandidateFinding, Keyset, PassResult } from "./types";

interface AnchorRow {
  id: string;
  page_id: string;
  text: string;
  tx_created: Date;
}

interface NeighborClaimRow {
  claimId: string;
  text: string;
  dist: number;
}

export async function nearClaimsForClaim(
  tenantId: string,
  claimId: string,
  neighbors: number,
  maxDistance: number
): Promise<NeighborClaimRow[]> {
  return prisma.$queryRawUnsafe<NeighborClaimRow[]>(
    `SELECT cl2."id" AS "claimId", cl2."text" AS "text",
            MIN(sc2."embedding" <-> sc1."embedding") AS "dist"
     FROM "claim_evidence" ce1
     JOIN "source_chunks" sc1 ON sc1."id" = ce1."chunk_id"
       AND sc1."tenant_id" = $1 AND sc1."embedding" IS NOT NULL
     JOIN LATERAL (
       SELECT osc."id", osc."embedding"
       FROM "source_chunks" osc
       WHERE osc."tenant_id" = $1 AND osc."embedding" IS NOT NULL
       ORDER BY osc."embedding" <-> sc1."embedding"
       LIMIT $3
     ) sc2 ON true
     JOIN "claim_evidence" ce2 ON ce2."chunk_id" = sc2."id" AND ce2."tenant_id" = $1
     JOIN "claims" cl2 ON cl2."id" = ce2."claim_id"
       AND cl2."tenant_id" = $1 AND cl2."status" = 'ACTIVE' AND cl2."id" <> $2
     WHERE ce1."claim_id" = $2 AND ce1."tenant_id" = $1
     GROUP BY cl2."id", cl2."text"
     HAVING MIN(sc2."embedding" <-> sc1."embedding") <= $4
     ORDER BY "dist" ASC`,
    tenantId,
    claimId,
    neighbors,
    maxDistance
  );
}

export const CONTRADICTION_SYSTEM =
  "You compare two factual statements. Reply with ONLY one word: yes (they " +
  "contradict), no (they agree or are unrelated), or maybe (unclear).";

export async function scanContradictions(
  tenantId: string,
  cursor: Keyset,
  config: TriageConfig,
  model: TriageModel,
  modelReady: boolean
): Promise<PassResult> {
  const ks = keysetClause("c.tx_created", "c.id", "$2", "$3");
  const anchors = await prisma.$queryRawUnsafe<AnchorRow[]>(
    `SELECT c."id", c."page_id", c."text", c."tx_created"
     FROM "claims" c
     JOIN "pages" p ON p."id" = c."page_id" AND p."tenant_id" = c."tenant_id"
     WHERE c."tenant_id" = $1 AND c."status" = 'ACTIVE' AND p."deleted_at" IS NULL
       AND ${ks.predicate}
     ORDER BY ${ks.order}
     LIMIT $4`,
    tenantId,
    cursor.cursorAt,
    cursor.cursorId,
    config.batchSize
  );

  const nextCursor: Keyset | null =
    anchors.length > 0
      ? {
          cursorAt: anchors[anchors.length - 1].tx_created,
          cursorId: anchors[anchors.length - 1].id,
        }
      : null;

  const candidates: CandidateFinding[] = [];
  const seen = new Set<string>();

  for (const anchor of anchors) {
    const near = await nearClaimsForClaim(
      tenantId,
      anchor.id,
      config.vectorNeighbors,
      config.contradictionMaxDistance
    );
    for (const n of near) {
      const [a, b] = canonicalPair(anchor.id, n.claimId);
      const fingerprint = computeFingerprint({
        kind: "CONTRADICTION_CANDIDATE",
        participants: [a, b],
      });
      if (seen.has(fingerprint)) continue;
      seen.add(fingerprint);

      if (!modelReady) {
        candidates.push({
          kind: "CONTRADICTION_CANDIDATE",
          severity: 0,
          confidence: 0,
          claimId: a,
          relatedClaimId: b,
          fingerprint,
          evidence: {
            retry: { pass: "CONTRADICTION", claimId: a, relatedClaimId: b },
          },
          modelDigest: null,
          deferred: {
            reason: "ollama-unavailable",
            nextAttemptAt: nextAttemptAt(0, config),
            attempts: 0,
          },
          precondition: { type: "claimsActive", claimIds: [a, b] },
        });
        continue;
      }

      let verdict;
      try {
        const reply = await model.generate(
          `A: ${anchor.text}\nB: ${n.text}\n\nDo A and B contradict? (yes/no/maybe):`,
          CONTRADICTION_SYSTEM
        );
        verdict = parseContradictionVerdict(reply);
      } catch (err) {
        if (err instanceof OllamaUnavailableError) {
          candidates.push({
            kind: "CONTRADICTION_CANDIDATE",
            severity: 0,
            confidence: 0,
            claimId: a,
            relatedClaimId: b,
            fingerprint,
            evidence: {
              retry: { pass: "CONTRADICTION", claimId: a, relatedClaimId: b },
            },
            modelDigest: null,
            deferred: {
              reason: "ollama-unavailable-midbatch",
              nextAttemptAt: nextAttemptAt(0, config),
              attempts: 0,
            },
            precondition: { type: "claimsActive", claimIds: [a, b] },
          });
          continue;
        }
        throw err;
      }

      const severity = contradictionSeverity(verdict);
      if (severity === 0) continue; // "no" — not a candidate

      candidates.push({
        kind: "CONTRADICTION_CANDIDATE",
        severity,
        confidence: verdict === "yes" ? 0.8 : 0.5,
        claimId: a,
        relatedClaimId: b,
        fingerprint,
        evidence: { verdict, distance: n.dist },
        modelDigest: model.modelDigest ?? "unknown",
        // Both claims must still be ACTIVE at write time (B1 may have superseded
        // one in the gap → drop the candidate).
        precondition: { type: "claimsActive", claimIds: [a, b] },
      });
    }
  }

  return {
    scanned: anchors.length,
    candidates,
    relevance: [],
    nextCursor,
    hasMore: anchors.length === config.batchSize,
  };
}
