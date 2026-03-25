/**
 * Bulk Experiment Context — Fetches context for multiple experiments
 * in parallel with token budgeting and deduplication.
 */

import {
  assembleExperimentContext,
  type SearchDepth,
  type ExperimentContext,
} from "./experimentContext";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BulkExperimentRequest {
  experimentId: string;
  depth: SearchDepth;
}

export interface BulkExperimentItem {
  experimentId: string;
  context?: ExperimentContext;
  error?: string;
  allocated: number;
  used: number;
  truncated: boolean;
}

export interface SharedContextItem {
  name: string;
  category: "chemical" | "reactionType" | "researcher";
  usedBy: string[];
}

export interface SharedContext {
  chemicals: SharedContextItem[];
  reactionTypes: SharedContextItem[];
  researchers: SharedContextItem[];
}

export interface BulkContextResponse {
  experiments: BulkExperimentItem[];
  totalSize: number;
  maxTotalSize: number;
  experimentCount: number;
  sharedContext?: SharedContext;
}

// ─── Budget Allocation ───────────────────────────────────────────────────────

/**
 * Allocate character budget across experiments.
 * First experiment (primary) gets 60%, others split remaining 40%.
 */
function allocateBudgets(count: number, maxTotalSize: number): number[] {
  if (count === 0) return [];
  if (count === 1) return [maxTotalSize];

  const primaryBudget = Math.floor(maxTotalSize * 0.6);
  const remainingBudget = maxTotalSize - primaryBudget;
  const secondaryBudget = Math.floor(remainingBudget / (count - 1));

  const budgets = [primaryBudget];
  for (let i = 1; i < count; i++) {
    budgets.push(secondaryBudget);
  }

  return budgets;
}

// ─── Bulk Assembly ───────────────────────────────────────────────────────────

/**
 * Fetch context for multiple experiments in parallel.
 * Applies token budgeting and deduplication.
 */
export async function assembleBulkContext(
  tenantId: string,
  experiments: BulkExperimentRequest[],
  maxTotalSize: number
): Promise<BulkContextResponse> {
  const budgets = allocateBudgets(experiments.length, maxTotalSize);

  // Fetch all contexts in parallel
  const results = await Promise.allSettled(
    experiments.map((exp) =>
      assembleExperimentContext(tenantId, exp.experimentId, exp.depth)
    )
  );

  // Build response items
  const items: BulkExperimentItem[] = [];
  let totalSize = 0;

  for (let i = 0; i < experiments.length; i++) {
    const result = results[i];
    const budget = budgets[i];

    if (result.status === "rejected") {
      items.push({
        experimentId: experiments[i].experimentId,
        error: result.reason?.message ?? "Unknown error",
        allocated: budget,
        used: 0,
        truncated: false,
      });
      continue;
    }

    const context = result.value;

    if (!context) {
      items.push({
        experimentId: experiments[i].experimentId,
        error: "not found",
        allocated: budget,
        used: 0,
        truncated: false,
      });
      continue;
    }

    const contextSize = context.contextSize;
    const truncated = contextSize > budget;

    items.push({
      experimentId: experiments[i].experimentId,
      context,
      allocated: budget,
      used: Math.min(contextSize, budget),
      truncated,
    });

    totalSize += Math.min(contextSize, budget);
  }

  // Build shared context from items appearing in 2+ experiments
  const sharedContext = extractSharedContext(items);

  return {
    experiments: items,
    totalSize,
    maxTotalSize,
    experimentCount: experiments.length,
    ...(sharedContext ? { sharedContext } : {}),
  };
}

// ─── Shared Context Extraction ────────────────────────────────────────────────

/**
 * Identify chemicals, reaction types, and researchers shared across experiments.
 * Returns undefined if fewer than 2 successful experiments (nothing to deduplicate).
 */
function extractSharedContext(
  items: BulkExperimentItem[]
): SharedContext | undefined {
  const successItems = items.filter((item) => item.context);
  if (successItems.length < 2) return undefined;

  const chemicalMap = new Map<string, string[]>();
  const reactionTypeMap = new Map<string, string[]>();
  const researcherMap = new Map<string, string[]>();

  for (const item of successItems) {
    const ctx = item.context!;
    const expId = item.experimentId;

    for (const chem of ctx.experiment.chemicals) {
      const existing = chemicalMap.get(chem.name) ?? [];
      existing.push(expId);
      chemicalMap.set(chem.name, existing);
    }

    if (ctx.experiment.reactionType) {
      const name = ctx.experiment.reactionType.name;
      const existing = reactionTypeMap.get(name) ?? [];
      existing.push(expId);
      reactionTypeMap.set(name, existing);
    }

    if (ctx.experiment.researcher) {
      const name = ctx.experiment.researcher.name;
      const existing = researcherMap.get(name) ?? [];
      existing.push(expId);
      researcherMap.set(name, existing);
    }
  }

  const chemicals: SharedContextItem[] = [];
  const reactionTypes: SharedContextItem[] = [];
  const researchers: SharedContextItem[] = [];

  for (const [name, usedBy] of chemicalMap) {
    if (usedBy.length >= 2) {
      chemicals.push({ name, category: "chemical", usedBy });
    }
  }
  for (const [name, usedBy] of reactionTypeMap) {
    if (usedBy.length >= 2) {
      reactionTypes.push({ name, category: "reactionType", usedBy });
    }
  }
  for (const [name, usedBy] of researcherMap) {
    if (usedBy.length >= 2) {
      researchers.push({ name, category: "researcher", usedBy });
    }
  }

  // Only include if there's something shared
  if (chemicals.length === 0 && reactionTypes.length === 0 && researchers.length === 0) {
    return undefined;
  }

  return { chemicals, reactionTypes, researchers };
}
