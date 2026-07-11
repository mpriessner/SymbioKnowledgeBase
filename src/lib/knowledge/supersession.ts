/**
 * W81-B1 — inline, deterministic, contradiction-driven claim supersession.
 *
 * Runs AFTER W81-A2's apply transaction has COMMITTED (so claims + CONTRADICTS
 * edges are visible), inline on each enrichment ingest. It performs ONLY
 * high-precision, deterministic supersession; anything ambiguous is left for the
 * W81-C1 triage worker (which owns candidate flagging + the page `contested`
 * mark). B1 has NO finding store and NO LLM in this path.
 *
 * The mechanics, each a review-hardened rule (a bug otherwise):
 *  - COLLISION: exact scoped key `(subject, relation, scope{...,units})` from
 *    `subjectRelation.ts` — NO pgvector, NO similarity. `validPeriod` is NOT in
 *    the key; a collision is same key + DIFFERENT object.
 *  - TRUST GATE: the older claim must carry a CONTRADICTS ClaimEvidence edge with
 *    validationState ∈ {EXACT, FUZZY} and confidence ≥ threshold. UNVERIFIED
 *    never supersedes.
 *  - TEMPORAL SAFETY: strict `newer.tValid > older.tValid`. A historical
 *    late-arrival (older date, ingested now) is FLAGGED, not applied. If either
 *    claim's datePrecision = UNKNOWN, defer (don't auto-supersede).
 *  - DERIVED EFFECTIVE STATUS: a future-effective newer fact keeps the older
 *    claim ACTIVE and only sets a FUTURE tInvalid; it is marked
 *    SUPERSEDED/txExpired ONLY when newer.tValid ≤ now().
 *  - CONCURRENCY: a conditional UPDATE (`WHERE status='ACTIVE' AND tInvalid IS
 *    NULL`) so two jobs can't both win; advisory locks acquired in SORTED scoped
 *    key order to avoid cross-key deadlock. Never UPDATE-in-place the fact text;
 *    never delete. A unique `ClaimSupersession` row per (old, new, reason).
 *  - CONTESTED is C1's to write: B1 emits a durable deferred signal
 *    (`properties.pendingContested` via jsonb_set, no updatedAt bump) only when
 *    the superseded fact is NOT already reflected in the page body; when it IS
 *    reflected it clears the signal (transition back to fresh).
 */

import { prisma } from "@/lib/db";
import { normalizeText } from "@/lib/provenance/quoteMatch";
import {
  extractScopedTriple,
  scopedKeyString,
  type ExtractedTriple,
} from "./subjectRelation";

/** Extractor + evidence confidence bar for an auto-applied supersession. */
export const SUPERSEDE_CONFIDENCE_THRESHOLD = 0.8;
/** The single reason string that keys the idempotent ClaimSupersession row. */
export const SUPERSESSION_REASON = "inline-contradiction";

export interface AppliedSupersession {
  oldClaimId: string;
  newClaimId: string;
  /** false = future-effective (older kept ACTIVE with a future tInvalid). */
  effectiveNow: boolean;
  tInvalid: string;
}

export interface FlaggedCandidate {
  oldClaimId: string;
  newClaimId: string;
  reason:
    | "late-arrival"
    | "unknown-precision"
    | "low-confidence"
    | "no-trust-gate";
}

export interface SupersessionResult {
  applied: AppliedSupersession[];
  flagged: FlaggedCandidate[];
  contestedPageIds: string[];
}

export interface ClaimRow {
  id: string;
  pageId: string;
  text: string;
  tValid: Date;
  datePrecision: "EXACT" | "APPROX" | "UNKNOWN";
  status: "ACTIVE" | "SUPERSEDED";
  triple: ExtractedTriple | null;
}

/** Duck-typed P2002 (unique violation) — matches the repo convention. */
function isP2002(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "P2002"
  );
}

/**
 * Whether the older claim carries a qualifying CONTRADICTS trust-gate edge:
 * validationState ∈ {EXACT, FUZZY} and confidence ≥ threshold. UNVERIFIED edges
 * (hallucinated / unlocatable quotes) never count.
 */
async function hasTrustGate(
  tenantId: string,
  oldClaimId: string
): Promise<boolean> {
  const ev = await prisma.claimEvidence.findFirst({
    where: {
      tenantId,
      claimId: oldClaimId,
      relation: "CONTRADICTS",
      validationState: { in: ["EXACT", "FUZZY"] },
      confidence: { gte: SUPERSEDE_CONFIDENCE_THRESHOLD },
    },
    select: { id: true },
  });
  return ev !== null;
}

/**
 * Compute the collision candidates for a page: pairs of ACTIVE claims sharing an
 * exact scoped key but asserting DIFFERENT objects, both extracted with high
 * confidence. Returns, per older claim, its single newest qualifying superseder.
 */
export function computeCollisions(claims: ClaimRow[]): {
  pairs: Array<{ older: ClaimRow; newer: ClaimRow }>;
  ambiguous: Array<{ a: ClaimRow; b: ClaimRow }>;
} {
  const byKey = new Map<string, ClaimRow[]>();
  for (const c of claims) {
    if (c.status !== "ACTIVE" || !c.triple) continue;
    if (c.triple.confidence < SUPERSEDE_CONFIDENCE_THRESHOLD) continue;
    const k = scopedKeyString(c.triple.key);
    const arr = byKey.get(k) ?? [];
    arr.push(c);
    byKey.set(k, arr);
  }

  const pairs: Array<{ older: ClaimRow; newer: ClaimRow }> = [];
  const ambiguous: Array<{ a: ClaimRow; b: ClaimRow }> = [];
  for (const group of byKey.values()) {
    if (group.length < 2) continue;
    for (const older of group) {
      // The newest claim in the group that strictly post-dates `older` and
      // asserts a different object is the superseder candidate.
      let winner: ClaimRow | null = null;
      for (const cand of group) {
        if (cand.id === older.id) continue;
        if (cand.triple!.object === older.triple!.object) continue;
        // Equal tValid + different object = ambiguous ordering (e.g. a historical
        // late-arrival ingested the same instant): FLAG, never auto-supersede.
        if (cand.tValid.getTime() === older.tValid.getTime()) {
          if (older.id < cand.id) ambiguous.push({ a: older, b: cand }); // dedupe pair
          continue;
        }
        if (cand.tValid.getTime() < older.tValid.getTime()) continue; // strict >
        if (winner === null || cand.tValid.getTime() > winner.tValid.getTime()) {
          winner = cand;
        }
      }
      if (winner) pairs.push({ older, newer: winner });
    }
  }
  return { pairs, ambiguous };
}

/**
 * Emit / clear the durable `pendingContested` deferred signal on a page.
 * ALWAYS via `$executeRaw` + `jsonb_set` on the OWN subkey (never a full-column
 * Prisma JSON write — that clobbers sibling subkeys), and NEVER bumps
 * `updated_at` (which would trip pageTree.ts's `updatedAt > summaryUpdatedAt`
 * stale-summary heuristic). B1 only sets the deferred marker — C1 owns the real
 * `knowledgeStatus` transition.
 */
async function markPendingContested(
  tenantId: string,
  pageId: string,
  supersededClaimIds: string[]
): Promise<void> {
  const payload = JSON.stringify({
    at: new Date().toISOString(),
    supersededClaimIds,
    source: "w81-b1-inline",
  });
  await prisma.$executeRaw`
    UPDATE "pages"
    SET "properties" = jsonb_set(
      COALESCE("properties", '{}'::jsonb),
      '{pendingContested}',
      ${payload}::jsonb,
      true
    )
    WHERE "id" = ${pageId} AND "tenant_id" = ${tenantId}
  `;
}

/** Clear the deferred signal (transition back to fresh) — jsonb minus the key. */
async function clearPendingContested(
  tenantId: string,
  pageId: string
): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "pages"
    SET "properties" = COALESCE("properties", '{}'::jsonb) - 'pendingContested'
    WHERE "id" = ${pageId}
      AND "tenant_id" = ${tenantId}
      AND "properties" ? 'pendingContested'
  `;
}

/**
 * Body-verified contested guard (Codex R1): because a71-13 does complete-body
 * replacement, if the superseding claim's text already renders in the page's
 * current body, the page is NOT contested. Returns true when the page IS
 * contested (the superseded fact is not reflected by the newer claim in the body).
 */
async function isContested(
  tenantId: string,
  pageId: string,
  newerClaimText: string
): Promise<boolean> {
  const latest = await prisma.documentVersion.findFirst({
    where: { pageId, tenantId },
    orderBy: { version: "desc" },
    select: { plainText: true },
  });
  if (!latest) return true; // no body to reflect it → treat as contested
  const body = normalizeText(latest.plainText).toLowerCase();
  // Strip trailing sentence punctuation so "...87%." matches "...87% after ...".
  const needle = normalizeText(newerClaimText).toLowerCase().replace(/[.,;:]+$/g, "");
  // The new fact IS in the body ⇒ synthesis already reflects it ⇒ not contested.
  return !body.includes(needle);
}

/**
 * Apply inline supersession for the given pages of a single tenant. Best-effort:
 * the caller wraps this so a supersession failure never fails the ingest job.
 */
export async function runInlineSupersession(
  tenantId: string,
  pageIds: string[]
): Promise<SupersessionResult> {
  const result: SupersessionResult = {
    applied: [],
    flagged: [],
    contestedPageIds: [],
  };
  const uniquePageIds = Array.from(new Set(pageIds));
  if (uniquePageIds.length === 0) return result;

  // Pre-read: gather ACTIVE, non-deleted claims for the affected pages and their
  // scoped triples, to discover the collision keys we must lock.
  const rawClaims = await prisma.claim.findMany({
    where: {
      tenantId,
      pageId: { in: uniquePageIds },
      status: "ACTIVE",
      page: { deletedAt: null },
    },
    select: {
      id: true,
      pageId: true,
      text: true,
      tValid: true,
      datePrecision: true,
      status: true,
    },
  });
  const claims: ClaimRow[] = rawClaims.map((c) => ({
    ...c,
    triple: extractScopedTriple(c.text),
  }));

  // Group claims per page; collisions are scoped to a single concept page (keeps
  // precision high — a superseder and its target live on the same page).
  const byPage = new Map<string, ClaimRow[]>();
  for (const c of claims) {
    const arr = byPage.get(c.pageId) ?? [];
    arr.push(c);
    byPage.set(c.pageId, arr);
  }

  // The full set of scoped keys involved, SORTED — advisory locks are acquired
  // in this order across the whole ingest to avoid cross-key deadlock (GLM R2).
  const lockKeys = new Set<string>();
  for (const c of claims) {
    if (c.triple && c.triple.confidence >= SUPERSEDE_CONFIDENCE_THRESHOLD) {
      lockKeys.add(scopedKeyString(c.triple.key));
    }
  }
  const sortedLockKeys = Array.from(lockKeys).sort();
  if (sortedLockKeys.length === 0) return result;

  const contested = new Set<string>();
  const contestedClaimsByPage = new Map<string, string[]>();

  await prisma.$transaction(async (tx) => {
    // Acquire advisory locks in sorted order (per tenant + key) before any
    // conditional update, so concurrent ingests serialize deterministically.
    for (const key of sortedLockKeys) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId}), hashtext(${key}))`;
    }

    for (const [pageId, pageClaims] of byPage) {
      const { pairs, ambiguous } = computeCollisions(pageClaims);
      // Equal-time collisions can't be ordered deterministically → defer to C1.
      for (const { a, b } of ambiguous) {
        result.flagged.push({
          oldClaimId: a.id,
          newClaimId: b.id,
          reason: "late-arrival",
        });
      }
      for (const { older, newer } of pairs) {
        // Temporal safety: UNKNOWN precision on EITHER side ⇒ defer to C1.
        if (older.datePrecision === "UNKNOWN" || newer.datePrecision === "UNKNOWN") {
          result.flagged.push({
            oldClaimId: older.id,
            newClaimId: newer.id,
            reason: "unknown-precision",
          });
          continue;
        }
        // Trust gate: the older claim needs a qualifying CONTRADICTS edge.
        if (!(await hasTrustGate(tenantId, older.id))) {
          result.flagged.push({
            oldClaimId: older.id,
            newClaimId: newer.id,
            reason: "no-trust-gate",
          });
          continue;
        }

        const now = Date.now();
        const effectiveNow = newer.tValid.getTime() <= now;
        // Conditional transition — only an ACTIVE, not-yet-invalidated claim can
        // be superseded, so two concurrent jobs can never both win.
        let count: number;
        if (effectiveNow) {
          const updated = await tx.claim.updateMany({
            where: { id: older.id, tenantId, status: "ACTIVE", tInvalid: null },
            data: {
              status: "SUPERSEDED",
              tInvalid: newer.tValid,
              txExpired: new Date(),
              supersededByClaimId: newer.id,
              supersedeReason: SUPERSESSION_REASON,
            },
          });
          count = updated.count;
        } else {
          // Future-effective: keep ACTIVE, only set the future tInvalid. It flips
          // to SUPERSEDED later (scheduled flip / derived read) when tValid passes.
          const updated = await tx.claim.updateMany({
            where: { id: older.id, tenantId, status: "ACTIVE", tInvalid: null },
            data: {
              tInvalid: newer.tValid,
              supersededByClaimId: newer.id,
              supersedeReason: SUPERSESSION_REASON,
            },
          });
          count = updated.count;
        }
        if (count === 0) continue; // lost the race / already invalidated

        // Idempotent audit row (unique on old/new/reason).
        try {
          await tx.claimSupersession.create({
            data: {
              tenantId,
              oldClaimId: older.id,
              newClaimId: newer.id,
              reason: SUPERSESSION_REASON,
              tInvalidApplied: newer.tValid,
              effectiveNow,
            },
          });
        } catch (err) {
          if (!isP2002(err)) throw err;
        }

        result.applied.push({
          oldClaimId: older.id,
          newClaimId: newer.id,
          effectiveNow,
          tInvalid: newer.tValid.toISOString(),
        });

        // Body-verified contested guard, evaluated only for present-effective
        // flips (a future-effective fact is not yet in force).
        if (effectiveNow) {
          const stillContested = await isContested(tenantId, pageId, newer.text);
          if (stillContested) {
            contested.add(pageId);
            const list = contestedClaimsByPage.get(pageId) ?? [];
            list.push(older.id);
            contestedClaimsByPage.set(pageId, list);
          }
        }
      }
    }
  });

  // Emit / clear the deferred pendingContested signal per page (post-commit; the
  // signal is advisory for C1 and must not be part of the supersession tx).
  for (const pageId of uniquePageIds) {
    if (contested.has(pageId)) {
      await markPendingContested(
        tenantId,
        pageId,
        contestedClaimsByPage.get(pageId) ?? []
      );
      result.contestedPageIds.push(pageId);
    } else {
      // Transition back to fresh when the body already reflects the new fact.
      await clearPendingContested(tenantId, pageId).catch(() => {});
    }
  }

  return result;
}
