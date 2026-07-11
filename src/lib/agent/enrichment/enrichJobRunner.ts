/**
 * W81-A2 async enrich+citation runner.
 *
 * Executes a durable EnrichJob end-to-end:
 *   (1) ledger dedup short-circuit,
 *   (2) Source+chunks idempotent PRE-STEP (outside the apply tx),
 *   (3) body plan — LLM pass 1 (a71-13's proposePlan),
 *   (4) citation extraction — LLM pass 2 over each already-written body,
 *   (5) single-transaction apply (page+version+claims+evidence+audit+ledger),
 *   (6) DONE with a result summary, or FAILED with the error.
 *
 * The two LLM passes both run BEFORE the apply transaction, so no LLM call is
 * held open inside the tx (the "already-written body" is the pass-1 markdown,
 * not a persisted body). Citation extraction is a SECOND pass, not inline, so
 * body quality is unaffected.
 */

import { prisma } from "@/lib/db";
import type { AgentContext } from "@/lib/agent/auth";
import { scheduleAggregationRefresh } from "@/lib/chemistryKb/aggregationRefresh";
import { ingestSource } from "@/lib/sources/ingestService";
import { computeContentHash, findLedgerEntry } from "./ingestLedger";
import {
  proposePlan,
  defaultBackend,
  type LlmBackend,
} from "./enrichmentAgent";
import { proposeCitations, type ExistingClaimRef } from "./citationAgent";
import {
  resolveConceptsCategory,
  gatherConceptPages,
  buildConceptContext,
  scheduleConceptsIndexRegeneration,
  conceptExternalId,
} from "./conceptsIndex";
import { applyPlanWithCitations } from "./applyPlanWithCitations";
import { completeEnrichJob, failEnrichJob, type EnrichJobRequest } from "./enrichJob";
import type { ConceptAction } from "./schema";

/** Bounded parent-chain walk: is `candidate` within `ancestor`? */
async function isWithinSubtree(
  tenantId: string,
  candidateId: string,
  ancestorId: string
): Promise<boolean> {
  if (candidateId === ancestorId) return true;
  let current: string | null = candidateId;
  for (let depth = 0; depth < 20 && current; depth++) {
    const page: { parentId: string | null } | null = await prisma.page.findFirst({
      where: { id: current, tenantId, deletedAt: null },
      select: { parentId: true },
    });
    if (!page) return false;
    if (page.parentId === ancestorId) return true;
    current = page.parentId;
  }
  return false;
}

export interface RunEnrichJobOptions {
  /** Test seam: inject a deterministic LLM backend for BOTH passes. */
  backend?: LlmBackend;
  /** Enforce "citations required" at the service layer (default true for W81). */
  citationsRequired?: boolean;
}

export async function runEnrichJob(
  ctx: AgentContext,
  jobId: string,
  request: EnrichJobRequest,
  opts: RunEnrichJobOptions = {}
): Promise<void> {
  const backend = opts.backend ?? defaultBackend;
  const citationsRequired = opts.citationsRequired ?? true;
  const tenantId = ctx.tenantId;
  const { rawText, sourceName, targetCategoryId } = request;

  try {
    await prisma.enrichJob.update({
      where: { id: jobId },
      data: { status: "RUNNING" },
    });

    const contentHash = computeContentHash(rawText);

    // (1) Ledger dedup — a byte-identical prior ingest short-circuits.
    const prior = await findLedgerEntry(tenantId, contentHash);
    if (prior) {
      await completeEnrichJob(jobId, {
        alreadyIngested: true,
        ledgerId: prior.id,
        applied: [],
        warnings: [`already ingested (ledger ${prior.id})`],
      });
      return;
    }

    // (2) Source + chunks PRE-STEP (idempotent, OUTSIDE the apply tx).
    const ingested = await ingestSource(ctx, {
      kind: "NOTE",
      title: sourceName,
      rawText,
      correlationId: contentHash.slice(0, 12),
    });
    const sourceId = ingested.sourceId;

    const conceptsCategoryId = await resolveConceptsCategory(tenantId);
    if (!conceptsCategoryId) {
      throw new Error("Concepts category not found — run Chemistry KB hierarchy setup first");
    }

    const allowedParentIds = new Set<string>([conceptsCategoryId]);
    if (targetCategoryId && targetCategoryId !== conceptsCategoryId) {
      const ok = await isWithinSubtree(tenantId, targetCategoryId, conceptsCategoryId);
      if (!ok) {
        throw new Error(
          "targetCategoryId is outside the enrichment-writable Concepts subtree"
        );
      }
      allowedParentIds.add(targetCategoryId);
    }

    // Context for the body pass.
    const concepts = await gatherConceptPages(tenantId, conceptsCategoryId);
    const { index, bodies } = buildConceptContext(concepts);

    // (3) LLM pass 1 — body plan.
    const plan = await proposePlan(rawText, index, bodies, sourceName, backend);

    // Existing ACTIVE claims of the concepts in context (for CONTRADICTS targets).
    const conceptPageIds = concepts
      .map((c) => conceptExternalId(c.slug))
      .filter(Boolean);
    const existingClaimRows =
      conceptPageIds.length > 0
        ? await prisma.claim.findMany({
            where: {
              tenantId,
              status: "ACTIVE",
              page: { externalId: { in: conceptPageIds }, tenantId },
            },
            select: { id: true, text: true },
            take: 200,
          })
        : [];
    const existingClaims: ExistingClaimRef[] = existingClaimRows.map((c) => ({
      claimId: c.id,
      text: c.text,
    }));

    const promptChunks = ingested.chunks.map((c) => ({
      chunkIndex: c.chunkIndex,
      text: c.text,
    }));

    // (4) LLM pass 2 — citation extraction per concept body.
    const actionsWithClaims: ConceptAction[] = [];
    const passWarnings: string[] = [];
    for (const action of plan.actions) {
      try {
        const cited = await proposeCitations(
          action.body_markdown,
          promptChunks,
          existingClaims,
          backend
        );
        actionsWithClaims.push({ ...action, claims: cited.claims });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        passWarnings.push(`citation pass failed for "${action.slug}": ${msg}`);
        actionsWithClaims.push({ ...action, claims: [] });
      }
    }

    // (5) Single-transaction apply.
    const result = await applyPlanWithCitations(ctx, actionsWithClaims, {
      conceptsCategoryId,
      targetCategoryId,
      allowedParentIds,
      correlationId: contentHash.slice(0, 12),
      sourceId,
      contentHash,
      sourceName,
      citationsRequired,
    });

    // Post-commit side effects (index/aggregation) — never part of atomicity.
    if (result.applied.length > 0) {
      scheduleAggregationRefresh(tenantId, [conceptsCategoryId], "enrichment");
      scheduleConceptsIndexRegeneration(
        tenantId,
        conceptsCategoryId,
        contentHash.slice(0, 12)
      );
    }

    await completeEnrichJob(jobId, {
      applied: result.applied.map((a) => ({ slug: a.slug, action: a.action })),
      warnings: [...passWarnings, ...result.warnings],
      claimSummaries: result.claimSummaries,
      sourceId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[runEnrichJob] failed:", msg);
    await failEnrichJob(jobId, msg);
  }
}
