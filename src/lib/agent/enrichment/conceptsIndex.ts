/**
 * Concepts area: context gathering + OKF index generation/regeneration.
 *
 * The Concepts index shares a71-04's OKF one-liner FORMAT and its in-process
 * concurrency-guard PATTERN, but is its own generator over its own object set
 * (concept pages), with its own stable sort for byte-identical idempotency.
 *
 * Inherits a71-04's in-process-only guard limitation (worse here, since
 * enrichment can fire concurrently): under multi-worker deployment a
 * `pg_advisory_xact_lock` is required. Single-process today — documented, not
 * silently assumed solved.
 *
 * Every query is tenant-scoped and excludes soft-deleted pages (§5a / AC13).
 */

import { prisma } from "@/lib/db";
import { tiptapToMarkdown } from "@/lib/agent/markdown";
import { markdownToTiptap } from "@/lib/markdown/deserializer";
import { processAgentWikilinks } from "@/lib/agent/wikilinks";
import { formatOkfBullet, type OkfIndexEntry } from "@/lib/chemistryKb/indexPage";
import type { Prisma } from "@/generated/prisma/client";
import type { ConceptIndexEntry, ConceptBody } from "./enrichmentAgent";

/** Concept pages are keyed by `concept:<slug>` in `Page.externalId`. */
export const CONCEPT_EXTERNAL_ID_PREFIX = "concept:";

export function conceptExternalId(slug: string): string {
  return `${CONCEPT_EXTERNAL_ID_PREFIX}${slug}`;
}

export function slugFromExternalId(externalId: string | null): string | null {
  if (!externalId || !externalId.startsWith(CONCEPT_EXTERNAL_ID_PREFIX)) {
    return null;
  }
  return externalId.slice(CONCEPT_EXTERNAL_ID_PREFIX.length);
}

interface RawConceptPage {
  id: string;
  title: string;
  externalId: string | null;
  oneLiner: string | null;
  properties: unknown;
  position: number;
  createdAt: Date;
  blocks: Array<{ content: unknown }>;
}

export interface GatheredConcept {
  id: string;
  slug: string;
  title: string;
  oneLiner: string | null;
  tags: string[];
  type: string;
  aliases: string[];
  firstSeen: string | null;
  bodyMarkdown: string;
}

function toStringArray(v: unknown): string[] {
  return Array.isArray(v)
    ? (v as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
}

function readConceptProps(properties: unknown): {
  type: string;
  tags: string[];
  aliases: string[];
  firstSeen: string | null;
} {
  const empty = {
    type: "concept",
    tags: [] as string[],
    aliases: [] as string[],
    firstSeen: null as string | null,
  };
  if (!properties || typeof properties !== "object") return empty;
  const concept = (properties as Record<string, unknown>).concept;
  if (!concept || typeof concept !== "object") return empty;
  const c = concept as Record<string, unknown>;
  return {
    type: typeof c.type === "string" ? c.type : "concept",
    tags: toStringArray(c.tags),
    aliases: toStringArray(c.aliases),
    firstSeen: typeof c.firstSeen === "string" ? c.firstSeen : null,
  };
}

/**
 * Resolve the "Concepts" category page id for a tenant (tenant-scoped,
 * non-deleted). Returns null if the hierarchy isn't set up.
 */
export async function resolveConceptsCategory(
  tenantId: string
): Promise<string | null> {
  const root = await prisma.page.findFirst({
    where: { tenantId, title: "Chemistry KB", parentId: null, deletedAt: null },
    select: { id: true },
  });
  if (!root) return null;
  const concepts = await prisma.page.findFirst({
    where: { tenantId, title: "Concepts", parentId: root.id, deletedAt: null },
    select: { id: true },
  });
  return concepts?.id ?? null;
}

/**
 * Gather all concept pages under the Concepts category, tenant-scoped and
 * excluding soft-deleted pages, ordered by a STABLE key for byte-stable output.
 */
export async function gatherConceptPages(
  tenantId: string,
  conceptsCategoryId: string
): Promise<GatheredConcept[]> {
  const pages = await prisma.page.findMany({
    where: {
      tenantId,
      parentId: conceptsCategoryId,
      deletedAt: null,
      externalId: { startsWith: CONCEPT_EXTERNAL_ID_PREFIX },
    },
    select: {
      id: true,
      title: true,
      externalId: true,
      oneLiner: true,
      properties: true,
      position: true,
      createdAt: true,
      blocks: {
        where: { tenantId, type: "DOCUMENT" },
        select: { content: true },
        take: 1,
      },
    },
    orderBy: [
      { externalId: "asc" },
      { createdAt: "asc" },
      { id: "asc" },
    ],
  });

  return (pages as RawConceptPage[]).map((p) => {
    const props = readConceptProps(p.properties);
    const body = p.blocks[0] ? tiptapToMarkdown(p.blocks[0].content) : "";
    return {
      id: p.id,
      slug: slugFromExternalId(p.externalId) ?? p.id,
      title: p.title,
      oneLiner: p.oneLiner,
      tags: props.tags,
      type: props.type,
      aliases: props.aliases,
      firstSeen: props.firstSeen,
      bodyMarkdown: body,
    };
  });
}

/** Split gathered concepts into the two-tier prompt context. */
export function buildConceptContext(concepts: GatheredConcept[]): {
  index: ConceptIndexEntry[];
  bodies: ConceptBody[];
} {
  return {
    index: concepts.map((c) => ({
      slug: c.slug,
      title: c.title,
      description: c.oneLiner ?? "",
      tags: c.tags,
    })),
    bodies: concepts.map((c) => ({
      slug: c.slug,
      title: c.title,
      body: c.bodyMarkdown,
    })),
  };
}

// ─── Index generation ──────────────────────────────────────────────────────

const CONCEPTS_INDEX_PREAMBLE = `# Concepts Index

> Auto-generated OKF one-liner index of every concept page. Follow a link and
> read the target page for depth.
`;

export async function generateConceptsIndexContent(
  tenantId: string,
  conceptsCategoryId: string
): Promise<string> {
  const concepts = await gatherConceptPages(tenantId, conceptsCategoryId);
  const sections: string[] = [CONCEPTS_INDEX_PREAMBLE, "## Concepts\n"];
  if (concepts.length === 0) {
    sections.push("_No concepts yet._");
  } else {
    const entries: OkfIndexEntry[] = concepts.map((c) => ({
      id: c.id,
      title: c.title,
      externalId: conceptExternalId(c.slug),
      oneLiner: c.oneLiner,
      linkSlug: c.slug,
      tags: c.tags,
    }));
    sections.push(
      entries.map((e) => formatOkfBullet(e, "./concepts")).join("\n")
    );
  }
  return sections.join("\n");
}

// ─── Concurrency-guarded + debounced regeneration ──────────────────────────

const activeConceptsRegenerations = new Set<string>();
const conceptsDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const CONCEPTS_DEBOUNCE_MS = 5000;

export function isConceptsIndexRegenerationRunning(tenantId: string): boolean {
  return activeConceptsRegenerations.has(tenantId);
}

export function clearConceptsIndexRegenerationState(): void {
  activeConceptsRegenerations.clear();
  for (const t of conceptsDebounceTimers.values()) clearTimeout(t);
  conceptsDebounceTimers.clear();
}

/**
 * Ensure the "Concepts Index" page (+ its DOCUMENT block) exists under the
 * Concepts category, returning its id. Created lazily so tenants set up before
 * this feature still get an index on first enrichment.
 */
async function ensureConceptsIndexPage(
  tenantId: string,
  conceptsCategoryId: string
): Promise<string> {
  const existing = await prisma.page.findFirst({
    where: {
      tenantId,
      title: "Concepts Index",
      parentId: conceptsCategoryId,
      deletedAt: null,
    },
    select: { id: true },
  });
  if (existing) return existing.id;

  const page = await prisma.page.create({
    data: {
      tenantId,
      title: "Concepts Index",
      icon: "\u{1F4C7}",
      oneLiner: "OKF one-liner index of every concept page.",
      parentId: conceptsCategoryId,
      spaceType: "TEAM",
      position: 0,
    },
  });
  await prisma.block.create({
    data: {
      tenantId,
      pageId: page.id,
      type: "DOCUMENT",
      content: {} as Prisma.InputJsonValue,
      position: 0,
    },
  });
  return page.id;
}

export interface ConceptsRegenerateResult {
  regenerated: boolean;
  skipped: boolean;
  indexPageId?: string;
  reason?: string;
}

/**
 * Regenerate the Concepts index. Concurrency-guarded + idempotent (byte-stable
 * via the stable sort in `gatherConceptPages`). Stamps
 * `properties.conceptsIndexRegeneration` via `jsonb_set`.
 */
export async function regenerateConceptsIndex(
  tenantId: string,
  conceptsCategoryId: string,
  options: { correlationId?: string | null } = {}
): Promise<ConceptsRegenerateResult> {
  if (activeConceptsRegenerations.has(tenantId)) {
    return { regenerated: false, skipped: true, reason: "already-running" };
  }
  activeConceptsRegenerations.add(tenantId);
  try {
    const indexPageId = await ensureConceptsIndexPage(
      tenantId,
      conceptsCategoryId
    );
    const markdown = await generateConceptsIndexContent(
      tenantId,
      conceptsCategoryId
    );
    const { content } = markdownToTiptap(markdown);
    const tiptap = content as unknown as Prisma.InputJsonValue;

    await prisma.block.updateMany({
      where: { pageId: indexPageId, tenantId, type: "DOCUMENT" },
      data: { content: tiptap },
    });
    await processAgentWikilinks(indexPageId, tenantId, content);

    const stamp: Prisma.InputJsonValue = {
      lastRegeneratedAt: new Date().toISOString(),
      correlationId: options.correlationId ?? null,
    };
    await prisma.$executeRaw`
      UPDATE "pages"
      SET "properties" = jsonb_set(
        COALESCE("properties", '{}'::jsonb),
        '{conceptsIndexRegeneration}',
        ${JSON.stringify(stamp)}::jsonb,
        true
      )
      WHERE "id" = ${indexPageId} AND "tenant_id" = ${tenantId}
    `;

    return { regenerated: true, skipped: false, indexPageId };
  } finally {
    activeConceptsRegenerations.delete(tenantId);
  }
}

/**
 * Debounced regeneration: a burst of N concept writes in one ingestion collapses
 * to exactly ONE regeneration after the window (AC9), keyed on the tenant +
 * Concepts category (not individual concept page ids).
 */
export function scheduleConceptsIndexRegeneration(
  tenantId: string,
  conceptsCategoryId: string,
  correlationId?: string | null
): void {
  const existing = conceptsDebounceTimers.get(tenantId);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    conceptsDebounceTimers.delete(tenantId);
    regenerateConceptsIndex(tenantId, conceptsCategoryId, { correlationId }).catch(
      (err) => console.error("[concepts-index] regeneration failed:", err)
    );
  }, CONCEPTS_DEBOUNCE_MS);
  conceptsDebounceTimers.set(tenantId, timer);
}
