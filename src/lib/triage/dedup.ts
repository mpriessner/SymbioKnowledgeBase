/**
 * W81-C1 pass (c) — DEDUP / near-duplicate. DETERMINISTIC (no model): pgvector
 * near-duplicate detection across concept pages. Anchored on ACTIVE claims by the
 * `(tx_created, id)` keyset (the SCANNED anchor entity — resume is by this keyset,
 * NEVER by similarity order, which has no stable ordering — GLM R2). For each
 * anchor claim, its cited chunks' nearest OTHER chunks within a distance ceiling
 * map to claims → pages; a neighbor on a DIFFERENT page yields a
 * `POSSIBLE_DUPLICATE` finding on the CANONICALIZED `(min,max)` page pair so
 * `(A,B)` and `(B,A)` can never become two findings. Never auto-merges.
 */

import { prisma } from "@/lib/db";
import type { TriageConfig } from "./config";
import { canonicalPair, computeFingerprint } from "./fingerprint";
import { keysetClause } from "./keyset";
import type { CandidateFinding, Keyset, PassResult } from "./types";

interface AnchorRow {
  id: string;
  page_id: string;
  tx_created: Date;
}

interface NeighborRow {
  pageId: string;
  dist: number;
}

export async function neighborPagesForClaim(
  tenantId: string,
  claimId: string,
  anchorPageId: string,
  neighbors: number,
  maxDistance: number
): Promise<NeighborRow[]> {
  return prisma.$queryRawUnsafe<NeighborRow[]>(
    `SELECT cl2."page_id" AS "pageId", MIN(sc2."embedding" <-> sc1."embedding") AS "dist"
     FROM "claim_evidence" ce1
     JOIN "source_chunks" sc1 ON sc1."id" = ce1."chunk_id"
       AND sc1."tenant_id" = $1 AND sc1."embedding" IS NOT NULL
     JOIN LATERAL (
       SELECT osc."id", osc."embedding"
       FROM "source_chunks" osc
       WHERE osc."tenant_id" = $1 AND osc."embedding" IS NOT NULL
       ORDER BY osc."embedding" <-> sc1."embedding"
       LIMIT $4
     ) sc2 ON true
     JOIN "claim_evidence" ce2 ON ce2."chunk_id" = sc2."id" AND ce2."tenant_id" = $1
     JOIN "claims" cl2 ON cl2."id" = ce2."claim_id"
       AND cl2."tenant_id" = $1 AND cl2."status" = 'ACTIVE'
     JOIN "pages" p2 ON p2."id" = cl2."page_id"
       AND p2."tenant_id" = $1 AND p2."deleted_at" IS NULL
     WHERE ce1."claim_id" = $2 AND ce1."tenant_id" = $1 AND cl2."page_id" <> $3
     GROUP BY cl2."page_id"
     HAVING MIN(sc2."embedding" <-> sc1."embedding") <= $5
     ORDER BY "dist" ASC`,
    tenantId,
    claimId,
    anchorPageId,
    neighbors,
    maxDistance
  );
}

export async function scanDedup(
  tenantId: string,
  cursor: Keyset,
  config: TriageConfig
): Promise<PassResult> {
  const ks = keysetClause("c.tx_created", "c.id", "$2", "$3");
  const anchors = await prisma.$queryRawUnsafe<AnchorRow[]>(
    `SELECT c."id", c."page_id", c."tx_created"
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
  const seen = new Set<string>(); // dedupe pair fingerprints within the batch

  for (const anchor of anchors) {
    const neighbors = await neighborPagesForClaim(
      tenantId,
      anchor.id,
      anchor.page_id,
      config.vectorNeighbors,
      config.dedupMaxDistance
    );
    for (const n of neighbors) {
      const [a, b] = canonicalPair(anchor.page_id, n.pageId);
      const fingerprint = computeFingerprint({
        kind: "POSSIBLE_DUPLICATE",
        participants: [a, b],
      });
      if (seen.has(fingerprint)) continue;
      seen.add(fingerprint);
      // Closer distance → higher severity, but dedup is advisory (never urgent).
      const severity = Math.max(0, Math.min(0.5, 0.5 - n.dist));
      candidates.push({
        kind: "POSSIBLE_DUPLICATE",
        severity,
        confidence: Math.max(0, 1 - n.dist),
        pageId: a,
        relatedPageId: b,
        fingerprint,
        evidence: { distance: n.dist },
        modelDigest: null,
        precondition: { type: "pagesLive", pageIds: [a, b] },
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
