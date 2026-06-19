/**
 * Aggregation Auto-Refresh — Debounced refresh of aggregation pages
 * (reaction type summaries, researcher profiles, chemical usage stats)
 * when Team KB content changes.
 */

import { prisma } from "@/lib/db";

/**
 * Minimal slice of the Prisma client used inside a refresh batch. Declared as an
 * interface so the transaction client (`tx`) and the base client are
 * interchangeable here.
 */
type RefreshTxClient = {
  page: {
    findFirst: typeof prisma.page.findFirst;
    findMany: typeof prisma.page.findMany;
    update: typeof prisma.page.update;
  };
};

/**
 * Run `fn` inside an interactive transaction when the client supports one,
 * otherwise fall back to the base client. The fallback keeps unit tests that
 * stub only the model methods (and not `$transaction`) working, while
 * production still gets atomicity.
 */
async function runInTransaction<T>(
  fn: (tx: RefreshTxClient) => Promise<T>
): Promise<T> {
  if (typeof prisma.$transaction === "function") {
    return prisma.$transaction((tx) => fn(tx as unknown as RefreshTxClient));
  }
  return fn(prisma as unknown as RefreshTxClient);
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type RefreshTrigger = "promotion" | "capture" | "sync" | "manual";

export interface RefreshEvent {
  trigger: RefreshTrigger;
  affectedPageIds: string[];
  duration: number;
  timestamp: string;
}

export interface RefreshResult {
  refreshed: number;
  duration: number;
  pageIds: string[];
}

// ─── Debounce State ──────────────────────────────────────────────────────────

const pendingRefreshes = new Map<string, Set<string>>();
const pendingTriggers = new Map<string, RefreshTrigger>();
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

const DEBOUNCE_MS = 5000;

/**
 * Schedule an aggregation refresh for the given pages.
 * Multiple rapid calls are debounced — only one refresh runs after the window.
 */
export function scheduleAggregationRefresh(
  tenantId: string,
  affectedPageIds: string[],
  trigger: RefreshTrigger
): void {
  const pending = pendingRefreshes.get(tenantId) ?? new Set();
  for (const id of affectedPageIds) {
    pending.add(id);
  }
  pendingRefreshes.set(tenantId, pending);
  pendingTriggers.set(tenantId, trigger);

  // Clear existing timer and set new one
  const existingTimer = debounceTimers.get(tenantId);
  if (existingTimer) clearTimeout(existingTimer);

  const timer = setTimeout(() => {
    executeRefresh(tenantId).catch((err) => {
      console.error("Aggregation refresh failed:", err);
    });
  }, DEBOUNCE_MS);

  debounceTimers.set(tenantId, timer);
}

/**
 * Execute the pending refresh for a tenant.
 * Collects all pending page IDs and refreshes them.
 */
async function executeRefresh(tenantId: string): Promise<void> {
  const pageIds = pendingRefreshes.get(tenantId);
  const trigger = pendingTriggers.get(tenantId) ?? "manual";

  // Clear pending state
  pendingRefreshes.delete(tenantId);
  pendingTriggers.delete(tenantId);
  debounceTimers.delete(tenantId);

  if (!pageIds || pageIds.size === 0) return;

  const startTime = Date.now();
  await refreshAggregationPages(tenantId, [...pageIds]);
  const duration = Date.now() - startTime;

  console.log(
    `[aggregation-refresh] tenant=${tenantId} trigger=${trigger} pages=${pageIds.size} duration=${duration}ms`
  );
}

/**
 * Clear all pending refreshes. Useful for testing.
 */
export function clearPendingRefreshes(): void {
  for (const timer of debounceTimers.values()) {
    clearTimeout(timer);
  }
  pendingRefreshes.clear();
  pendingTriggers.clear();
  debounceTimers.clear();
}

/**
 * Get the count of pending refreshes for a tenant.
 */
export function getPendingCount(tenantId: string): number {
  return pendingRefreshes.get(tenantId)?.size ?? 0;
}

// ─── Refresh Logic ───────────────────────────────────────────────────────────

/**
 * Find aggregation pages affected by changes to the given pages.
 * Walks upward to find parent category pages (reaction types, chemicals, etc.)
 * and refreshes their summaries/stats.
 */
export async function findAffectedAggregationPages(
  tenantId: string,
  changedPageIds: string[]
): Promise<string[]> {
  const affectedIds = new Set<string>();

  // Get changed pages and their parents
  const changedPages = await prisma.page.findMany({
    where: { id: { in: changedPageIds }, tenantId },
    select: { id: true, parentId: true, spaceType: true },
  });

  // Only process TEAM space pages
  const teamPages = changedPages.filter((p) => p.spaceType === "TEAM");

  for (const page of teamPages) {
    // The parent category page is an aggregation target
    if (page.parentId) {
      affectedIds.add(page.parentId);

      // Also check if grandparent is an aggregation page
      const parent = await prisma.page.findFirst({
        where: { id: page.parentId, tenantId },
        select: { parentId: true },
      });
      if (parent?.parentId) {
        affectedIds.add(parent.parentId);
      }
    }

    // Find linked pages that might be aggregation targets
    const links = await prisma.pageLink.findMany({
      where: {
        sourcePageId: page.id,
        tenantId,
      },
      select: { targetPageId: true },
      take: 10,
    });

    for (const link of links) {
      affectedIds.add(link.targetPageId);
    }
  }

  // Remove the changed pages themselves
  for (const id of changedPageIds) {
    affectedIds.delete(id);
  }

  return [...affectedIds];
}

/**
 * Refresh aggregation content for the specified pages.
 * Updates experiment counts, yield stats, and other computed sections.
 */
export async function refreshAggregationPages(
  tenantId: string,
  pageIds: string[]
): Promise<RefreshResult> {
  const startTime = Date.now();

  // Track the ids that were ACTUALLY refreshed (not all input ids qualify — some
  // are missing, non-TEAM, or have no children). Previously the result reported
  // `pageIds.slice(0, count)`, which named the first N *input* ids rather than
  // the ones really updated — wrong and misleading for callers/telemetry.
  const refreshedIds: string[] = [];

  // The whole batch is applied in one transaction so a failure partway through
  // doesn't leave some aggregation pages updated and others stale.
  await runInTransaction(async (tx) => {
    for (const pageId of pageIds) {
      const page = await tx.page.findFirst({
        where: { id: pageId, tenantId, spaceType: "TEAM" },
        select: { id: true, title: true, parentId: true },
      });

      if (!page) continue;

      // Get the parent to determine if this is a category page
      const parent = page.parentId
        ? await tx.page.findFirst({
            where: { id: page.parentId, tenantId },
            select: { title: true },
          })
        : null;

      // Refresh summary/oneLiner based on child pages
      const children = await tx.page.findMany({
        where: { parentId: pageId, tenantId },
        select: { id: true, title: true },
      });

      if (children.length > 0) {
        // Update the oneLiner with current child count
        const pageType = parent?.title ?? "items";
        const newOneLiner = `${children.length} ${pageType.toLowerCase()} documented`;

        await tx.page.update({
          where: { id: pageId },
          data: {
            oneLiner: newOneLiner,
            summaryUpdatedAt: new Date(),
          },
        });

        refreshedIds.push(pageId);
      }
    }
  });

  return {
    refreshed: refreshedIds.length,
    duration: Date.now() - startTime,
    pageIds: refreshedIds,
  };
}

/**
 * Immediately refresh aggregation pages without debounce.
 * Used by the manual webhook endpoint.
 */
export async function immediateRefresh(
  tenantId: string,
  pageIds: string[],
  trigger: RefreshTrigger
): Promise<RefreshResult> {
  // Find affected aggregation pages if not specified directly
  const targetIds =
    pageIds.length > 0
      ? await findAffectedAggregationPages(tenantId, pageIds)
      : [];

  const allIds = [...new Set([...pageIds, ...targetIds])];

  const result = await refreshAggregationPages(tenantId, allIds);

  console.log(
    `[aggregation-refresh] immediate tenant=${tenantId} trigger=${trigger} pages=${result.refreshed} duration=${result.duration}ms`
  );

  return result;
}
