/**
 * Enrichment orchestrator — the Phase-1 `POST /api/agent/pages/enrich` core.
 *
 * Flow: ledger dedup → resolve + validate write allowlist → gather tenant-scoped
 * context → propose plan (self-repairing) → (dryRun stops here) → apply within
 * the Concepts subtree → write ledger → schedule debounced index regeneration.
 */

import { prisma } from "@/lib/db";
import type { AgentContext } from "@/lib/agent/auth";
import { scheduleAggregationRefresh } from "@/lib/chemistryKb/aggregationRefresh";
import {
  proposePlan,
  type LlmBackend,
} from "./enrichmentAgent";
import {
  resolveConceptsCategory,
  gatherConceptPages,
  buildConceptContext,
  scheduleConceptsIndexRegeneration,
} from "./conceptsIndex";
import { applyPlan } from "./applyPlan";
import {
  computeContentHash,
  findLedgerEntry,
  writeLedgerEntry,
  type LedgerEntry,
} from "./ingestLedger";
import type { EnrichmentPlan } from "./schema";
import type { ConceptAction } from "./schema";

export const MAX_RAW_TEXT_CHARS = 50_000;

export interface EnrichParams {
  rawText: string;
  sourceName: string;
  targetCategoryId?: string;
  dryRun?: boolean;
  /** Test seam: inject a deterministic LLM backend. */
  backend?: LlmBackend;
}

export interface EnrichResult {
  plan: EnrichmentPlan | null;
  applied: ConceptAction[];
  warnings: string[];
  dryRun: boolean;
  alreadyIngested?: boolean;
  ledgerEntry?: LedgerEntry;
}

export class EnrichmentError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "EnrichmentError";
  }
}

/** Walk parentId chain (bounded) to check `candidate` is within `ancestor`. */
async function isWithinSubtree(
  tenantId: string,
  candidateId: string,
  ancestorId: string
): Promise<boolean> {
  if (candidateId === ancestorId) return true;
  let current: string | null = candidateId;
  for (let depth = 0; depth < 20 && current; depth++) {
    const page: { parentId: string | null } | null =
      await prisma.page.findFirst({
        where: { id: current, tenantId, deletedAt: null },
        select: { parentId: true },
      });
    if (!page) return false;
    if (page.parentId === ancestorId) return true;
    current = page.parentId;
  }
  return false;
}

export async function enrich(
  ctx: AgentContext,
  params: EnrichParams
): Promise<EnrichResult> {
  const { rawText, sourceName, targetCategoryId, dryRun = false } = params;
  const tenantId = ctx.tenantId;

  if (!rawText || rawText.length === 0) {
    throw new EnrichmentError("rawText is required", 400);
  }
  if (rawText.length > MAX_RAW_TEXT_CHARS) {
    throw new EnrichmentError(
      `rawText exceeds ${MAX_RAW_TEXT_CHARS} chars`,
      400
    );
  }

  const contentHash = computeContentHash(rawText);

  // Idempotency: a byte-identical prior ingestion short-circuits before the LLM
  // (non-dryRun only — a dryRun is a read-only preview and writes no ledger).
  if (!dryRun) {
    const prior = await findLedgerEntry(tenantId, contentHash);
    if (prior) {
      return {
        plan: null,
        applied: [],
        warnings: [
          `already ingested (ledger ${prior.id}, ${prior.actionCount} actions)`,
        ],
        dryRun: false,
        alreadyIngested: true,
        ledgerEntry: prior,
      };
    }
  }

  const conceptsCategoryId = await resolveConceptsCategory(tenantId);
  if (!conceptsCategoryId) {
    throw new EnrichmentError(
      "Concepts category not found — run Chemistry KB hierarchy setup first",
      409
    );
  }

  // Build the allowlisted write surface (Concepts subtree).
  const allowedParentIds = new Set<string>([conceptsCategoryId]);
  if (targetCategoryId && targetCategoryId !== conceptsCategoryId) {
    const ok = await isWithinSubtree(
      tenantId,
      targetCategoryId,
      conceptsCategoryId
    );
    if (!ok) {
      // §5a: an explicit targetCategoryId must be inside the enrichment-writable
      // subtree. Routing into the chemistry taxonomy is intentionally NOT allowed
      // by the engine (security overrides the §2 convenience).
      throw new EnrichmentError(
        "targetCategoryId is outside the enrichment-writable Concepts subtree",
        403
      );
    }
    allowedParentIds.add(targetCategoryId);
  }

  // Gather tenant-scoped context for the prompt.
  const concepts = await gatherConceptPages(tenantId, conceptsCategoryId);
  const { index, bodies } = buildConceptContext(concepts);

  const plan = await proposePlan(
    rawText,
    index,
    bodies,
    sourceName,
    params.backend
  );

  if (dryRun) {
    return { plan, applied: [], warnings: [], dryRun: true };
  }

  const result = await applyPlan(ctx, plan.actions, {
    conceptsCategoryId,
    targetCategoryId,
    allowedParentIds,
    correlationId: contentHash.slice(0, 12),
  });

  await writeLedgerEntry({
    tenantId,
    contentHash,
    sourceName,
    planSummary: plan.reasoning.slice(0, 500),
    actionCount: result.applied.length,
  });

  // Schedule ONE debounced index regeneration keyed on the Concepts category id
  // (not individual concept ids) — a batch of N writes -> one regeneration (AC9).
  if (result.applied.length > 0) {
    scheduleAggregationRefresh(tenantId, [conceptsCategoryId], "enrichment");
    scheduleConceptsIndexRegeneration(
      tenantId,
      conceptsCategoryId,
      contentHash.slice(0, 12)
    );
  }

  return {
    plan,
    applied: result.applied,
    warnings: result.warnings,
    dryRun: false,
  };
}
