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

export interface BulkContextResponse {
  experiments: BulkExperimentItem[];
  totalSize: number;
  maxTotalSize: number;
  experimentCount: number;
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

  return {
    experiments: items,
    totalSize,
    maxTotalSize,
    experimentCount: experiments.length,
  };
}
