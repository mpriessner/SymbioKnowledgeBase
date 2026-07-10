/**
 * Generates the markdown content for the "Chemistry KB Index" page.
 *
 * OKF two-tier contract (a71-04): the index is the CHEAP orientation layer — one
 * bullet per experiment (`[Title](link) — description _(tags: ...)_`) that an
 * agent reads first, then follows a link and reads only the target page's
 * Executive Summary for a quick answer, or the full page for depth.
 *
 * `generateIndexPageContent()` is now DB-driven and async: it lists the active
 * experiments under the Experiments folder and archived ones under Archive. The
 * static navigation guide is preserved verbatim as the "How to read this KB"
 * preamble so an agent landing on the index with no external docs still learns
 * both the structure and the two-tier reading convention.
 */

import { prisma } from "@/lib/db";
import { tiptapToMarkdown } from "@/lib/agent/markdown";

// ─── The preserved static navigation guide (the "How to read this KB" preamble) ─

/**
 * The two-tier reading contract, prepended to the static guide. Generated once
 * and preserved byte-for-byte across every regeneration.
 */
const HOW_TO_READ_PREAMBLE = `# Chemistry KB Index

> AI agent navigation guide for the chemistry knowledge base

## How to Read This KB (Two-Tier Contract)

This index is the **cheap first hop**. Each entry below is a one-line summary of
one experiment. To answer a question:

1. Scan the one-liners here (bounded in size no matter how large the KB grows).
2. Follow the most relevant link and read **only** the \`## Executive Summary\`
   section of that page for a quick answer.
3. Read the full page (\`## Notebook Narrative\` / \`## ExpTube Analysis\` /
   \`## KB Notes\`) only when you need depth.

Active experiments are listed under **Experiments**; historical ones under
**Archive**, so you can tell "currently relevant" from "historical" without
opening either page.

## For Agents: How to Use This KB

### 1. Understanding the Structure

The chemistry KB has 5 page types:
- **Experiment**: Individual chemistry experiments (from ChemELN)
- **Chemical**: Practical info about chemicals we use
- **ReactionType**: Aggregated learnings about reaction types
- **Researcher**: Who has expertise in what areas
- **SubstrateClass**: Cross-experiment patterns for substrate classes

### 2. Tag-Based Filtering

Use these tag patterns to find relevant pages:

**Finding Experiments:**
- \`reaction:suzuki-coupling\` — All Suzuki coupling experiments
- \`researcher:mueller\` — All experiments by Dr. Mueller
- \`substrate-class:heteroaryl\` — All experiments with heteroaryl substrates
- \`scale:medium\` — Medium-scale experiments (1-10 mmol)
- \`challenge:protodeboronation\` — Experiments that faced protodeboronation issues
- \`quality:4\` OR \`quality:5\` — High-quality experiments only

**Finding Chemicals:**
- \`cas:14221-01-3\` — Find chemical by CAS number

**Finding Expertise:**
- \`researcher\` tag — All researcher pages
- Cross-reference with \`reaction:*\` tags to find who works on what

### 3. Wikilink Navigation

Pages are interconnected via wikilinks:
- Experiments link to chemicals, reaction types, researchers, substrate classes
- Chemical pages link back to experiments that used them
- Reaction type pages aggregate experiments by type
- Researcher pages show all their experiments

### 4. Graph Traversal

Use the graph API to:
- Find related experiments (via shared chemicals or substrate classes)
- Find who else worked on similar problems (via reaction type or substrate class)
- Find alternative approaches (via backlinks from chemicals)

### 5. Contextual Retrieval Example

**User asks: "How do we handle heteroaryl substrates in Suzuki couplings?"**

Agent strategy:
1. Search for pages with tags: \`reaction:suzuki-coupling\` AND \`substrate-class:heteroaryl\`
2. Find the [[Heteroaryl Halides]] substrate class page for aggregated insights
3. Read "Practical Notes" sections from top-quality experiments (quality:4+)
4. Check [[Suzuki Coupling]] reaction type page for "Substrate-Specific Advice"
5. Identify expert: Find researcher with most experiments in this area

## Tag Taxonomy Quick Reference

| Namespace | Pattern | Example | Description |
|-----------|---------|---------|-------------|
| \`eln:\` | \`eln:[id]\` | \`eln:EXP-2026-0042\` | ChemELN experiment ID |
| \`cas:\` | \`cas:[number]\` | \`cas:14221-01-3\` | CAS registry number |
| \`reaction:\` | \`reaction:[type]\` | \`reaction:suzuki-coupling\` | Reaction type |
| \`researcher:\` | \`researcher:[name]\` | \`researcher:mueller\` | Researcher name |
| \`substrate-class:\` | \`substrate-class:[class]\` | \`substrate-class:heteroaryl\` | Substrate class |
| \`scale:\` | \`scale:[category]\` | \`scale:medium\` | Scale category |
| \`challenge:\` | \`challenge:[issue]\` | \`challenge:protodeboronation\` | Challenge type |
| \`quality:\` | \`quality:[1-5]\` | \`quality:4\` | Quality score |

## Entry Points

- **[[Chemistry KB]]**: Root page
- **[[Experiments]]**: Browse all experiments
- **[[Reaction Types]]**: Browse by reaction type
- **[[Chemicals]]**: Browse chemicals
- **[[Researchers]]**: Find expertise
- **[[Substrate Classes]]**: Browse by substrate class`;

// ─── OKF one-liner formatting ──────────────────────────────────────────────

/** A minimal page shape sufficient to render an OKF one-liner. */
export interface OkfIndexEntry {
  id: string;
  title: string;
  externalId: string | null;
  oneLiner: string | null;
  /** Optional short summary field (a71-02's `exec_summary`) if already derived. */
  execSummary?: string | null;
  /** Fallback body text (already converted to markdown/plain) for description. */
  bodyText?: string | null;
  /** Stable slug used in the relative link, e.g. externalId lowercased. */
  linkSlug: string;
  /** Extra tag tokens to render (already sanitized). */
  tags: string[];
}

/** Max characters for a body-derived description fallback. */
const DESCRIPTION_FALLBACK_CHARS = 120;

/**
 * Derive the one-liner description clause: prefer the page's `oneLiner`, then a
 * pre-derived `exec_summary`, then the first ~120 chars of body text. Never the
 * full body. Never throws on empty-scaffold pages (AC6).
 */
export function deriveDescription(entry: OkfIndexEntry): string {
  const oneLiner = entry.oneLiner?.trim();
  if (oneLiner) return collapseWhitespace(oneLiner);

  const exec = entry.execSummary?.trim();
  if (exec) return collapseWhitespace(exec).slice(0, DESCRIPTION_FALLBACK_CHARS);

  const body = entry.bodyText?.trim();
  if (body) {
    const collapsed = collapseWhitespace(body);
    return collapsed.length > DESCRIPTION_FALLBACK_CHARS
      ? collapsed.slice(0, DESCRIPTION_FALLBACK_CHARS).trimEnd() + "…"
      : collapsed;
  }

  return "(no summary yet)";
}

function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Render one OKF bullet line:
 * `- [Title](./experiments/slug) — description _(tags: a, b)_`
 */
export function formatOkfBullet(
  entry: OkfIndexEntry,
  linkPrefix: string
): string {
  const description = deriveDescription(entry);
  const slug = entry.linkSlug || entry.id;
  const link = `${linkPrefix}/${slug}`;
  const tagClause =
    entry.tags.length > 0 ? ` _(tags: ${entry.tags.join(", ")})_` : "";
  return `- [${entry.title}](${link}) — ${description}${tagClause}`;
}

// ─── DB-driven generation ──────────────────────────────────────────────────

export interface GenerateIndexOptions {
  /** Parent page id of the "Experiments" folder (active experiments). */
  experimentsParentId?: string | null;
  /** Parent page id of the "Archive" folder (archived experiments). */
  archiveParentId?: string | null;
}

/** A row selected from the DB for index rendering. */
interface RawExperimentPage {
  id: string;
  title: string;
  externalId: string | null;
  oneLiner: string | null;
  position: number;
  createdAt: Date;
  updatedAt: Date;
  blocks: Array<{ content: unknown }>;
}

function toEntry(page: RawExperimentPage): OkfIndexEntry {
  const slug = (page.externalId || page.id).toLowerCase();
  const bodyBlock = page.blocks[0];
  const bodyText = bodyBlock ? tiptapToMarkdown(bodyBlock.content) : "";
  // Deterministic, size-bounded tags derived from stable metadata. Real tag
  // sourcing (exec_summary / reaction tags) arrives with a71-02.
  const tags: string[] = [];
  if (page.externalId) tags.push(`eln:${page.externalId}`);
  tags.push(dateTag(page.updatedAt));
  return {
    id: page.id,
    title: page.title,
    externalId: page.externalId,
    oneLiner: page.oneLiner,
    bodyText,
    linkSlug: slug,
    tags,
  };
}

function dateTag(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Query non-deleted experiment pages under a parent folder, ordered by a STABLE
 * key so regeneration is byte-identical (AC2). Never relies on implicit row order.
 */
async function queryExperimentPages(
  tenantId: string,
  parentId: string
): Promise<OkfIndexEntry[]> {
  const pages = await prisma.page.findMany({
    where: { tenantId, parentId, deletedAt: null },
    select: {
      id: true,
      title: true,
      externalId: true,
      oneLiner: true,
      position: true,
      createdAt: true,
      updatedAt: true,
      blocks: {
        where: { tenantId, type: "DOCUMENT" },
        select: { content: true },
        take: 1,
      },
    },
    orderBy: [
      { position: "asc" },
      { externalId: "asc" },
      { createdAt: "asc" },
      { id: "asc" },
    ],
  });
  return (pages as RawExperimentPage[]).map(toEntry);
}

/**
 * Generate the OKF-formatted "Chemistry KB Index" body.
 *
 * DB-driven + async (reworked from the former static, sync, zero-arg function).
 * Emits the preserved preamble, then one OKF one-liner per active experiment,
 * then a separate Archive section. Deterministic sort → byte-stable output.
 */
export async function generateIndexPageContent(
  tenantId: string,
  opts: GenerateIndexOptions = {}
): Promise<string> {
  const sections: string[] = [HOW_TO_READ_PREAMBLE];

  const active = opts.experimentsParentId
    ? await queryExperimentPages(tenantId, opts.experimentsParentId)
    : [];
  const archived = opts.archiveParentId
    ? await queryExperimentPages(tenantId, opts.archiveParentId)
    : [];

  sections.push("\n## Experiments\n");
  if (active.length > 0) {
    sections.push(
      active.map((e) => formatOkfBullet(e, "./experiments")).join("\n")
    );
  } else {
    sections.push("_No active experiments yet._");
  }

  sections.push("\n## Archive\n");
  if (archived.length > 0) {
    sections.push(
      archived.map((e) => formatOkfBullet(e, "./archive")).join("\n")
    );
  } else {
    sections.push("_No archived experiments yet._");
  }

  return sections.join("\n");
}
