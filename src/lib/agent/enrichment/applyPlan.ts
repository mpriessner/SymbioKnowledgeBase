/**
 * Apply an enrichment plan to the Concepts subtree.
 *
 * SECURITY BOUNDARY (§5a — load-bearing, not optional):
 *  - Writes are restricted to the Concepts subtree (allowlisted parent ids).
 *    An `update` whose target resolves outside that subtree is REJECTED — no
 *    write to experiment/aggregation/index pages (AC11/AC12).
 *  - Every query is tenant-scoped and excludes soft-deleted pages (AC13).
 *  - Concept `slug` → `Page.externalId = concept:<slug>`; the existing
 *    `@@unique([tenantId, externalId])` collapses concurrent duplicate creates
 *    (AC14) via a P2002 → update.
 *  - Every applied create/update is audit-logged AND snapshotted as a
 *    `DocumentVersion` (AI_SUGGESTED) so a bad overwrite is traceable/rollbackable
 *    (AC15).
 *
 * The LLM-decision rules (degrade-update-to-create, dangling-link warning,
 * duplicate-prevention) mirror `apply_plan` in `enrichment_agent.py`.
 */

import { prisma } from "@/lib/db";
import type { AgentContext } from "@/lib/agent/auth";
import { logAgentAction } from "@/lib/agent/audit";
import { markdownToTiptap } from "@/lib/markdown/deserializer";
import { extractPlainText } from "@/lib/search/indexer";
import { processAgentWikilinks } from "@/lib/agent/wikilinks";
import { createDocumentVersion } from "@/lib/livingDocs/versioning";
import {
  extractStatements,
  findSimilarPairs,
} from "@/lib/chemistryKb/textSimilarity";
import type { Prisma } from "@/generated/prisma/client";
import type { ConceptAction } from "./schema";
import {
  conceptExternalId,
  gatherConceptPages,
  type GatheredConcept,
} from "./conceptsIndex";

const DUPLICATE_SIMILARITY_THRESHOLD = 0.7;

// ─── Pure decision helpers (unit-tested) ───────────────────────────────────

/**
 * Degrade an `update` for a slug that has no existing page to a `create`
 * (the LLM sometimes hallucinates that a concept already exists). Mirrors
 * `if verb == "update" and prior is None: verb = "create"`.
 */
export function degradeAction(
  action: ConceptAction,
  existingSlugs: Set<string>
): ConceptAction {
  if (action.action === "update" && !existingSlugs.has(action.slug)) {
    return { ...action, action: "create" };
  }
  return action;
}

/**
 * Collect `related_slugs` that reference neither an existing nor a
 * same-plan-planned concept. Warn, never fail. Mirrors the Python `dangling` check.
 */
export function findDangling(
  action: ConceptAction,
  existingSlugs: Set<string>,
  plannedSlugs: Set<string>
): string[] {
  return action.related_slugs.filter(
    (s) => !existingSlugs.has(s) && !plannedSlugs.has(s)
  );
}

/**
 * Duplicate-prevention backstop for `create` actions: compare the candidate body
 * against existing concept bodies in the SAME (already tenant-scoped) set. A
 * ≥0.7 similarity hit produces a warning — never blocks (the create still
 * happens). The candidate set MUST already be tenant-filtered by the caller;
 * `findSimilarPairs` provides no isolation of its own.
 */
export function findDuplicateWarning(
  action: ConceptAction,
  existingConcepts: GatheredConcept[]
): string | null {
  if (action.action !== "create") return null;
  const candidate = extractStatements(action.body_markdown);
  if (candidate.length === 0) return null;
  for (const existing of existingConcepts) {
    if (existing.slug === action.slug) continue;
    const existingStatements = extractStatements(existing.bodyMarkdown);
    if (existingStatements.length === 0) continue;
    const pairs = findSimilarPairs(
      candidate,
      existingStatements,
      DUPLICATE_SIMILARITY_THRESHOLD
    );
    if (pairs.length > 0) {
      return `possible duplicate of existing concept "${existing.title}" (${existing.slug}) — created anyway, flag for review`;
    }
  }
  return null;
}

// ─── Apply ─────────────────────────────────────────────────────────────────

export interface ApplyPlanOptions {
  conceptsCategoryId: string;
  /** Optional explicit target category; MUST be pre-validated as allowlisted. */
  targetCategoryId?: string;
  /** Allowlisted parent page ids the engine may write under (Concepts subtree). */
  allowedParentIds: Set<string>;
  correlationId?: string | null;
}

export interface ApplyPlanResult {
  applied: ConceptAction[];
  warnings: string[];
  /** Page ids created or updated (for downstream index regeneration). */
  affectedPageIds: string[];
}

function isP2002(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "P2002"
  );
}

/**
 * Build the `properties.concept` sub-object for a page, merging prior first-seen.
 */
function buildConceptProps(
  action: ConceptAction,
  prior: GatheredConcept | undefined
): Prisma.InputJsonValue {
  const today = new Date().toISOString().slice(0, 10);
  const aliases = Array.from(
    new Set([...(prior?.aliases ?? []), ...action.aliases])
  );
  // person type is sticky against the default (mirrors the prototype)
  let type = action.type || "concept";
  if (prior?.type === "person" && type === "concept") type = "person";
  return {
    type,
    tags: action.tags,
    aliases,
    firstSeen: prior?.firstSeen ?? today,
    lastSeen: today,
  };
}

/** Write the `properties.concept` subkey via jsonb_set (never full-column). */
async function stampConceptProps(
  tenantId: string,
  pageId: string,
  props: Prisma.InputJsonValue
): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "pages"
    SET "properties" = jsonb_set(
      COALESCE("properties", '{}'::jsonb),
      '{concept}',
      ${JSON.stringify(props)}::jsonb,
      true
    )
    WHERE "id" = ${pageId} AND "tenant_id" = ${tenantId}
  `;
}

async function writeConceptBody(
  tenantId: string,
  pageId: string,
  action: ConceptAction,
  prior: GatheredConcept | undefined,
  ctx: AgentContext
): Promise<void> {
  const { content } = markdownToTiptap(action.body_markdown);
  const tiptap = content as unknown as Prisma.InputJsonValue;

  await prisma.block.updateMany({
    where: { pageId, tenantId, type: "DOCUMENT" },
    data: { content: tiptap },
  });

  // Metadata: title, oneLiner (= description), properties.concept subkey.
  await prisma.page.update({
    where: { id: pageId },
    data: { title: action.title, oneLiner: action.description },
  });
  await stampConceptProps(tenantId, pageId, buildConceptProps(action, prior));

  await processAgentWikilinks(pageId, tenantId, content);

  // DocumentVersion snapshot (post-write content) + audit.
  const plainText = extractPlainText(
    content as unknown as Parameters<typeof extractPlainText>[0]
  );
  await createDocumentVersion({
    pageId,
    tenantId,
    content: tiptap,
    plainText,
    changeType: "AI_SUGGESTED",
    changeSource: "enrichment-engine",
    changeNotes: action.change_note || undefined,
  });
  await logAgentAction(ctx, action.action, "page", pageId, {
    slug: action.slug,
    title: action.title,
    source: "enrichment-engine",
  });
}

export async function applyPlan(
  ctx: AgentContext,
  actions: ConceptAction[],
  options: ApplyPlanOptions
): Promise<ApplyPlanResult> {
  const tenantId = ctx.tenantId;
  const parentId = options.targetCategoryId ?? options.conceptsCategoryId;

  // Defense-in-depth: the write parent MUST be allowlisted.
  if (!options.allowedParentIds.has(parentId)) {
    throw new Error(
      "Enrichment write target is outside the allowlisted Concepts subtree"
    );
  }

  // Gather existing concepts ONCE, tenant-scoped, excluding soft-deleted.
  const existing = await gatherConceptPages(
    tenantId,
    options.conceptsCategoryId
  );
  const bySlug = new Map<string, GatheredConcept>(
    existing.map((c) => [c.slug, c])
  );
  const existingSlugs = new Set(bySlug.keys());
  const plannedSlugs = new Set(actions.map((a) => a.slug));

  const warnings: string[] = [];
  const applied: ConceptAction[] = [];
  const affectedPageIds: string[] = [];

  for (const raw of actions) {
    const action = degradeAction(raw, existingSlugs);

    const dangling = findDangling(action, existingSlugs, plannedSlugs);
    if (dangling.length > 0) {
      warnings.push(
        `${action.slug} links to unknown concepts: ${dangling.join(", ")}`
      );
    }

    const dupWarning = findDuplicateWarning(action, existing);
    if (dupWarning) warnings.push(dupWarning);

    const externalId = conceptExternalId(action.slug);
    const prior = bySlug.get(action.slug);

    let pageId: string | null = null;

    if (action.action === "update") {
      // Resolve ONLY within the concept namespace, tenant-scoped, non-deleted.
      const target = await prisma.page.findFirst({
        where: { tenantId, externalId, deletedAt: null },
        select: { id: true, parentId: true },
      });
      if (!target) {
        // No such concept page — degrade to create below.
        pageId = null;
      } else if (
        !target.parentId ||
        !options.allowedParentIds.has(target.parentId)
      ) {
        // Resolved outside the Concepts subtree → REJECT, no write (AC11).
        warnings.push(
          `update to "${action.slug}" rejected: target is outside the Concepts subtree`
        );
        continue;
      } else {
        pageId = target.id;
      }
    }

    if (pageId === null) {
      // Create path (fresh create, or a degraded update).
      try {
        const maxPos = await prisma.page.aggregate({
          where: { tenantId, parentId },
          _max: { position: true },
        });
        const created = await prisma.page.create({
          data: {
            tenantId,
            externalId,
            title: action.title,
            oneLiner: action.description,
            parentId,
            spaceType: "TEAM",
            position: (maxPos._max.position ?? -1) + 1,
          },
        });
        await prisma.block.create({
          data: {
            tenantId,
            pageId: created.id,
            type: "DOCUMENT",
            content: {} as Prisma.InputJsonValue,
            position: 0,
          },
        });
        pageId = created.id;
      } catch (err) {
        if (isP2002(err)) {
          // Concurrent duplicate create collapsed on the unique index (AC14):
          // resolve the winner and fall through to update it.
          const winner = await prisma.page.findFirst({
            where: { tenantId, externalId, deletedAt: null },
            select: { id: true },
          });
          if (!winner) throw err;
          pageId = winner.id;
        } else {
          throw err;
        }
      }
    }

    await writeConceptBody(tenantId, pageId, action, prior, ctx);
    applied.push(action);
    affectedPageIds.push(pageId);
  }

  return { applied, warnings, affectedPageIds };
}
