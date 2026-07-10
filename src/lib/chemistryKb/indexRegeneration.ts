/**
 * Experiments-Index regeneration (a71-04).
 *
 * Regenerates the "Chemistry KB Index" page body from the current experiment
 * pages, idempotently and under an in-process concurrency guard that mirrors
 * `reconciliationSync.ts`'s `isReconciliationRunning()` shape.
 *
 * CONCURRENCY GUARD LIMITATION (documented, load-bearing): the guard is a
 * module-level in-process Set keyed by tenant. Under a SINGLE Node process
 * (the current single-container deployment) it correctly collapses a burst of
 * sync events into one regeneration. Under MULTIPLE workers/replicas each worker
 * has its own Set and they will NOT serialize across processes — a shared lock
 * (`pg_advisory_xact_lock`) is required before enabling multi-worker deployment.
 * This is a known, accepted single-process limitation, not a solved problem.
 *
 * `Page.properties` WRITE INVARIANT: the `lastRegeneratedAt`/`correlationId`
 * stamp is written with `jsonb_set` on its OWN subkey (`indexRegeneration`) in a
 * single `$executeRaw` UPDATE — never a full-column Prisma JSON write — so it
 * never clobbers a concurrent writer to a different `properties` subkey.
 */

import { prisma } from "@/lib/db";
import { markdownToTiptap } from "@/lib/markdown/deserializer";
import { processAgentWikilinks } from "@/lib/agent/wikilinks";
import { generateIndexPageContent } from "./indexPage";
import type { Prisma } from "@/generated/prisma/client";

// ─── Concurrency guard (in-process, per-tenant) ────────────────────────────

const activeRegenerations = new Set<string>();

export function isIndexRegenerationRunning(tenantId: string): boolean {
  return activeRegenerations.has(tenantId);
}

/** Test helper: clear guard state. */
export function clearIndexRegenerationState(): void {
  activeRegenerations.clear();
}

export interface RegenerateResult {
  regenerated: boolean;
  skipped: boolean;
  indexPageId?: string;
  reason?: string;
}

/**
 * Resolve the Chemistry KB Index page and the Experiments/Archive parent folders
 * for a tenant. Returns null if the hierarchy isn't set up.
 */
async function resolveHierarchy(tenantId: string): Promise<{
  indexPageId: string;
  experimentsParentId: string | null;
  archiveParentId: string | null;
} | null> {
  const root = await prisma.page.findFirst({
    where: { tenantId, title: "Chemistry KB", parentId: null, deletedAt: null },
    select: { id: true },
  });
  if (!root) return null;

  const [index, experiments, archive] = await Promise.all([
    prisma.page.findFirst({
      where: {
        tenantId,
        title: "Chemistry KB Index",
        parentId: root.id,
        deletedAt: null,
      },
      select: { id: true },
    }),
    prisma.page.findFirst({
      where: { tenantId, title: "Experiments", parentId: root.id, deletedAt: null },
      select: { id: true },
    }),
    prisma.page.findFirst({
      where: { tenantId, title: "Archive", parentId: root.id, deletedAt: null },
      select: { id: true },
    }),
  ]);

  if (!index) return null;
  return {
    indexPageId: index.id,
    experimentsParentId: experiments?.id ?? null,
    archiveParentId: archive?.id ?? null,
  };
}

/**
 * Stamp the index page's `properties.indexRegeneration` subkey with the last
 * regeneration timestamp and the triggering correlation id, via `jsonb_set`.
 */
async function stampRegenerationMetadata(
  tenantId: string,
  indexPageId: string,
  correlationId: string | null
): Promise<void> {
  const stamp: Prisma.InputJsonValue = {
    lastRegeneratedAt: new Date().toISOString(),
    correlationId: correlationId ?? null,
  };
  await prisma.$executeRaw`
    UPDATE "pages"
    SET "properties" = jsonb_set(
      COALESCE("properties", '{}'::jsonb),
      '{indexRegeneration}',
      ${JSON.stringify(stamp)}::jsonb,
      true
    )
    WHERE "id" = ${indexPageId} AND "tenant_id" = ${tenantId}
  `;
}

/**
 * Regenerate the Experiments Index for a tenant.
 *
 * - Concurrency-guarded: if a regeneration is already in flight for this tenant,
 *   this call no-ops (`skipped: true`) rather than racing to write the same page.
 * - Idempotent: with no intervening changes, produces byte-identical output.
 * - Every trigger MUST pass `tenantId` explicitly (never resolved from ambient
 *   state) so a cross-tenant event cannot regenerate the wrong tenant's index.
 */
export async function regenerateExperimentsIndex(
  tenantId: string,
  options: { correlationId?: string | null } = {}
): Promise<RegenerateResult> {
  // Synchronous guard check + set BEFORE any await, so two calls dispatched in
  // the same tick (e.g. Promise.all) collapse to exactly one execution.
  if (activeRegenerations.has(tenantId)) {
    return { regenerated: false, skipped: true, reason: "already-running" };
  }
  activeRegenerations.add(tenantId);

  try {
    const hierarchy = await resolveHierarchy(tenantId);
    if (!hierarchy) {
      return {
        regenerated: false,
        skipped: false,
        reason: "hierarchy-not-found",
      };
    }

    const markdown = await generateIndexPageContent(tenantId, {
      experimentsParentId: hierarchy.experimentsParentId,
      archiveParentId: hierarchy.archiveParentId,
    });

    const { content } = markdownToTiptap(markdown);
    const tiptap = content as unknown as Prisma.InputJsonValue;

    await prisma.block.updateMany({
      where: { pageId: hierarchy.indexPageId, tenantId, type: "DOCUMENT" },
      data: { content: tiptap },
    });

    await processAgentWikilinks(hierarchy.indexPageId, tenantId, content);
    await stampRegenerationMetadata(
      tenantId,
      hierarchy.indexPageId,
      options.correlationId ?? null
    );

    return {
      regenerated: true,
      skipped: false,
      indexPageId: hierarchy.indexPageId,
    };
  } finally {
    activeRegenerations.delete(tenantId);
  }
}
