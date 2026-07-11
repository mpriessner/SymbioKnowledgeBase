/**
 * W81-C1 pass (a) — STRUCTURAL staleness. Deterministic, NO LLM call (arXiv
 * research: staleness is structural, not embedding-similarity — a `(subject,
 * relation, scope)` collision with a newer differing object is stale cheaply).
 *
 * Reuses B1's `subjectRelation.ts` scoped-key extractor. Scans ACTIVE claims by
 * the `(tx_created, id)` keyset; for the pages touched, groups their ACTIVE claims
 * by scoped key and flags any group holding ≥2 DISTINCT high-confidence objects —
 * the page is carrying conflicting live facts B1's high-precision inline path did
 * NOT resolve (ambiguous / no-trust-gate / cross-page-batch). Emits a page-scoped
 * STALE finding and asks the writer to set `knowledgeStatus=contested` (C1 is the
 * single owner; it consumes B1's `pendingContested` signal in the same tx).
 *
 * Never edits a page body. Never calls a model.
 */

import { prisma } from "@/lib/db";
import {
  extractScopedTriple,
  scopedKeyString,
} from "@/lib/knowledge/subjectRelation";
import { SUPERSEDE_CONFIDENCE_THRESHOLD } from "@/lib/knowledge/supersession";
import type { TriageConfig } from "./config";
import { computeFingerprint } from "./fingerprint";
import { keysetClause } from "./keyset";
import type { CandidateFinding, Keyset, PassResult } from "./types";

interface AnchorRow {
  id: string;
  page_id: string;
  tx_created: Date;
}

interface PageClaimRow {
  id: string;
  page_id: string;
  text: string;
  t_valid: Date;
}

export async function scanStaleness(
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

  const pageIds = [...new Set(anchors.map((a) => a.page_id))];
  const candidates: CandidateFinding[] = [];

  if (pageIds.length > 0) {
    const pageClaims = await prisma.$queryRawUnsafe<PageClaimRow[]>(
      `SELECT c."id", c."page_id", c."text", c."t_valid"
       FROM "claims" c
       WHERE c."tenant_id" = $1 AND c."status" = 'ACTIVE' AND c."page_id" = ANY($2)`,
      tenantId,
      pageIds
    );

    // Group per page → per scoped key. A key with ≥2 distinct high-confidence
    // objects is a live collision (stale page).
    const byPage = new Map<string, PageClaimRow[]>();
    for (const c of pageClaims) {
      const arr = byPage.get(c.page_id) ?? [];
      arr.push(c);
      byPage.set(c.page_id, arr);
    }

    for (const [pageId, claims] of byPage) {
      const groups = new Map<
        string,
        Array<{ id: string; object: string; tValid: Date }>
      >();
      for (const c of claims) {
        const t = extractScopedTriple(c.text);
        if (!t || t.confidence < SUPERSEDE_CONFIDENCE_THRESHOLD) continue;
        const key = scopedKeyString(t.key);
        const arr = groups.get(key) ?? [];
        arr.push({ id: c.id, object: t.object, tValid: c.t_valid });
        groups.set(key, arr);
      }

      for (const [scopedKey, members] of groups) {
        const distinctObjects = new Set(members.map((m) => m.object));
        if (distinctObjects.size < 2) continue;

        // Order members oldest→newest; the newest differing object is the fact
        // the page should reflect. Reference the extremes for display evidence.
        const sorted = [...members].sort(
          (a, b) => a.tValid.getTime() - b.tValid.getTime()
        );
        const older = sorted[0];
        const newer = sorted[sorted.length - 1];
        const claimIds = members.map((m) => m.id);

        candidates.push({
          kind: "STALE",
          // Deterministic staleness is high-confidence structurally; severity
          // rises with how many distinct live objects collide.
          severity: Math.min(0.6 + 0.1 * (distinctObjects.size - 1), 0.95),
          confidence: 0.9,
          pageId,
          claimId: older.id,
          relatedClaimId: newer.id,
          fingerprint: computeFingerprint({
            kind: "STALE",
            participants: [pageId],
            scopedKey,
          }),
          evidence: {
            scopedKey,
            distinctObjects: [...distinctObjects].slice(0, 8),
            claimIds: claimIds.slice(0, 16),
          },
          modelDigest: null,
          // Both colliding claims must still be ACTIVE at write time — if B1
          // superseded one in the gap, the collision is resolved (drop).
          precondition: { type: "claimsActive", claimIds },
        });
      }
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
