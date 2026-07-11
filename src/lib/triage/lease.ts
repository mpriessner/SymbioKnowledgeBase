/**
 * W81-C1 — at-most-once escalation lease. `ESCALATED` ≠ C2 running: a C2 consumer
 * CLAIMS a finding with an ATOMIC lease so one finding drives exactly one frontier
 * job (duplicate triage output can't fan into duplicate expensive-model calls —
 * Codex R1). The claim is a single `UPDATE … WHERE status='ESCALATED' AND
 * leased_at IS NULL … RETURNING` — the row-level lock on the matched rows plus the
 * `leased_at IS NULL` guard make two concurrent claimers mutually exclusive.
 *
 * This is the primitive C2 (out of scope here) builds on; C1 ships it + the read
 * API so the hand-off contract is testable now.
 */

import { prisma } from "@/lib/db";

export interface LeasedFinding {
  id: string;
  kind: string;
  severity: number;
  confidence: number;
  pageId: string | null;
  relatedPageId: string | null;
  claimId: string | null;
  relatedClaimId: string | null;
  sourceId: string | null;
  evidence: unknown;
  modelDigest: string | null;
}

/**
 * Atomically claim up to `limit` ESCALATED, unleased findings for `owner`. The
 * inner ordered/locked SELECT (`FOR UPDATE SKIP LOCKED`) prevents two claimers
 * from contending on the same rows; the outer UPDATE stamps the lease. Returns the
 * claimed rows (empty when nothing is available).
 */
export async function claimEscalatedFindings(
  tenantId: string,
  owner: string,
  limit = 1
): Promise<LeasedFinding[]> {
  return prisma.$queryRawUnsafe<LeasedFinding[]>(
    `UPDATE "triage_findings" t
     SET "leased_at" = CURRENT_TIMESTAMP, "lease_owner" = $2, "updated_at" = CURRENT_TIMESTAMP
     WHERE t."id" IN (
       SELECT "id" FROM "triage_findings"
       WHERE "tenant_id" = $1 AND "status" = 'ESCALATED' AND "leased_at" IS NULL
       ORDER BY "severity" DESC, "escalated_at" ASC
       LIMIT $3
       FOR UPDATE SKIP LOCKED
     )
     RETURNING t."id", t."kind"::text AS "kind", t."severity", t."confidence",
               t."page_id" AS "pageId", t."related_page_id" AS "relatedPageId",
               t."claim_id" AS "claimId", t."related_claim_id" AS "relatedClaimId",
               t."source_id" AS "sourceId", t."evidence", t."model_digest" AS "modelDigest"`,
    tenantId,
    owner,
    Math.max(1, limit)
  );
}

/**
 * Mark a leased finding RESOLVED once C2 has fully consumed it (its frontier job
 * finished). Tenant + lease-owner scoped so a stale/foreign owner cannot resolve.
 */
export async function resolveLeasedFinding(
  tenantId: string,
  findingId: string,
  owner: string
): Promise<boolean> {
  const n = await prisma.$executeRawUnsafe(
    `UPDATE "triage_findings"
     SET "status" = 'RESOLVED', "resolved_at" = CURRENT_TIMESTAMP, "updated_at" = CURRENT_TIMESTAMP
     WHERE "id" = $1 AND "tenant_id" = $2 AND "lease_owner" = $3 AND "status" = 'ESCALATED'`,
    findingId,
    tenantId,
    owner
  );
  return n > 0;
}
