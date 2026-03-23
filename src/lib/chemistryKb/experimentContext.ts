/**
 * Assembles experiment context from the Chemistry KB for voice agent consumption.
 *
 * Three depth levels:
 * - default: titles + one-liners only (~1500 chars)
 * - medium:  full procedures + chemicals + best practices (~8000 chars)
 * - deep:    full graph traversal + historical data (~20000 chars)
 */

import { prisma } from "@/lib/db";
import { tiptapToMarkdown } from "@/lib/agent/markdown";

export type SearchDepth = "default" | "medium" | "deep";

export interface ChemicalContext {
  name: string;
  oneLiner: string | null;
  safety?: string;
  handling?: string;
}

export interface ReactionTypeContext {
  name: string;
  oneLiner: string | null;
  bestPractices?: string;
}

export interface ResearcherContext {
  name: string;
  oneLiner: string | null;
  expertise?: string;
}

export interface RelatedExperiment {
  id: string;
  title: string;
  oneLiner: string | null;
}

export interface InstitutionalKnowledge {
  bestPractices: string[];
  commonPitfalls: string[];
  relatedExperiments: RelatedExperiment[];
  tips: string[];
}

export interface ExperimentContext {
  experiment: {
    id: string;
    title: string;
    oneLiner: string | null;
    procedures?: string;
    chemicals: ChemicalContext[];
    reactionType?: ReactionTypeContext;
    researcher?: ResearcherContext;
  };
  institutionalKnowledge: InstitutionalKnowledge;
  contextSize: number;
  depth: SearchDepth;
  truncated: boolean;
}

const MAX_SIZES: Record<SearchDepth, number> = {
  default: 1500,
  medium: 8000,
  deep: 20000,
};

/**
 * Find an experiment page by searching for its title or ELN ID tag.
 */
async function findExperimentPage(
  tenantId: string,
  experimentId: string
): Promise<{ id: string; title: string; oneLiner: string | null } | null> {
  // Try exact title match first (e.g., "EXP-2026-0042: Suzuki Coupling...")
  const byTitle = await prisma.page.findFirst({
    where: {
      tenantId,
      title: { startsWith: experimentId },
    },
    select: { id: true, title: true, oneLiner: true },
  });
  if (byTitle) return byTitle;

  // Fallback: search in page content for the experiment ID
  const byContent = await prisma.block.findFirst({
    where: {
      tenantId,
      type: "DOCUMENT",
      deletedAt: null,
      plainText: { contains: experimentId },
    },
    select: {
      page: { select: { id: true, title: true, oneLiner: true } },
    },
  });
  return byContent?.page ?? null;
}

/**
 * Get the markdown content of a page's DOCUMENT block.
 */
async function getPageMarkdown(
  pageId: string,
  tenantId: string
): Promise<string> {
  const block = await prisma.block.findFirst({
    where: { pageId, tenantId, type: "DOCUMENT", deletedAt: null },
    select: { content: true },
  });
  if (!block) return "";
  return tiptapToMarkdown(block.content);
}

/**
 * Extract a named section from markdown content.
 * Looks for ## or ### headings matching the section name.
 */
function extractSection(markdown: string, sectionName: string): string {
  const lines = markdown.split("\n");
  let capturing = false;
  const captured: string[] = [];
  const sectionPattern = new RegExp(
    `^#{2,3}\\s+.*${sectionName}`,
    "i"
  );

  for (const line of lines) {
    if (sectionPattern.test(line)) {
      capturing = true;
      continue;
    }
    if (capturing) {
      // Stop at next heading of same or higher level
      if (/^#{1,3}\s+/.test(line)) break;
      captured.push(line);
    }
  }

  return captured.join("\n").trim();
}

/**
 * Extract bullet points from a section as an array of strings.
 */
function extractBulletPoints(markdown: string, sectionName: string): string[] {
  const section = extractSection(markdown, sectionName);
  if (!section) return [];
  return section
    .split("\n")
    .filter((line) => line.match(/^[-*]\s+/))
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .filter(Boolean);
}

/**
 * Get linked pages of a specific category (by checking parent page title).
 */
async function getLinkedPagesByCategory(
  pageId: string,
  tenantId: string,
  categoryTitle: string
): Promise<Array<{ id: string; title: string; oneLiner: string | null }>> {
  const links = await prisma.pageLink.findMany({
    where: { sourcePageId: pageId, tenantId },
    include: {
      targetPage: {
        select: {
          id: true,
          title: true,
          oneLiner: true,
          parentId: true,
        },
      },
    },
  });

  // Get parent pages to filter by category
  const parentIds = links
    .map((l) => l.targetPage.parentId)
    .filter((id): id is string => id !== null);

  if (parentIds.length === 0) return [];

  const parents = await prisma.page.findMany({
    where: { id: { in: parentIds }, tenantId },
    select: { id: true, title: true },
  });
  const parentMap = new Map(parents.map((p) => [p.id, p.title]));

  return links
    .filter((l) => {
      const parentTitle = l.targetPage.parentId
        ? parentMap.get(l.targetPage.parentId)
        : null;
      return parentTitle === categoryTitle;
    })
    .map((l) => ({
      id: l.targetPage.id,
      title: l.targetPage.title,
      oneLiner: l.targetPage.oneLiner,
    }));
}

/**
 * Assemble experiment context at the specified depth.
 */
export async function assembleExperimentContext(
  tenantId: string,
  experimentId: string,
  depth: SearchDepth = "default"
): Promise<ExperimentContext | null> {
  const maxSize = MAX_SIZES[depth];

  // 1. Find the experiment page
  const expPage = await findExperimentPage(tenantId, experimentId);
  if (!expPage) return null;

  // 2. Get linked pages by category (parallel)
  const [chemicals, reactionTypes, researchers] = await Promise.all([
    getLinkedPagesByCategory(expPage.id, tenantId, "Chemicals"),
    getLinkedPagesByCategory(expPage.id, tenantId, "Reaction Types"),
    getLinkedPagesByCategory(expPage.id, tenantId, "Researchers"),
  ]);

  // Default depth: titles + one-liners only
  const result: ExperimentContext = {
    experiment: {
      id: experimentId,
      title: expPage.title,
      oneLiner: expPage.oneLiner,
      chemicals: chemicals.map((c) => ({
        name: c.title,
        oneLiner: c.oneLiner,
      })),
      reactionType: reactionTypes[0]
        ? { name: reactionTypes[0].title, oneLiner: reactionTypes[0].oneLiner }
        : undefined,
      researcher: researchers[0]
        ? { name: researchers[0].title, oneLiner: researchers[0].oneLiner }
        : undefined,
    },
    institutionalKnowledge: {
      bestPractices: [],
      commonPitfalls: [],
      relatedExperiments: [],
      tips: [],
    },
    contextSize: 0,
    depth,
    truncated: false,
  };

  // Medium depth: add full content
  if (depth === "medium" || depth === "deep") {
    const expMarkdown = await getPageMarkdown(expPage.id, tenantId);
    result.experiment.procedures = extractSection(expMarkdown, "Procedure|Steps|Protocol");

    // Get chemical details
    const chemMarkdowns = await Promise.all(
      chemicals.map(async (c) => ({
        id: c.id,
        markdown: await getPageMarkdown(c.id, tenantId),
      }))
    );

    result.experiment.chemicals = chemicals.map((c, i) => ({
      name: c.title,
      oneLiner: c.oneLiner,
      safety: extractSection(chemMarkdowns[i].markdown, "Safety|Hazard") || undefined,
      handling: extractSection(chemMarkdowns[i].markdown, "Handling|Storage") || undefined,
    }));

    // Get reaction type best practices
    if (reactionTypes[0]) {
      const rtMarkdown = await getPageMarkdown(reactionTypes[0].id, tenantId);
      result.experiment.reactionType = {
        name: reactionTypes[0].title,
        oneLiner: reactionTypes[0].oneLiner,
        bestPractices: extractSection(rtMarkdown, "Best Practices|Institutional Knowledge") || undefined,
      };

      // Extract institutional knowledge from reaction type page
      result.institutionalKnowledge.bestPractices = extractBulletPoints(
        rtMarkdown,
        "Best Practices|Institutional Knowledge"
      );
      result.institutionalKnowledge.commonPitfalls = extractBulletPoints(
        rtMarkdown,
        "Common Pitfalls|Challenges|Known Issues"
      );
      result.institutionalKnowledge.tips = extractBulletPoints(
        rtMarkdown,
        "Tips|Recommendations|Practical Notes"
      );
    }

    // Get researcher expertise
    if (researchers[0]) {
      const resMarkdown = await getPageMarkdown(researchers[0].id, tenantId);
      result.experiment.researcher = {
        name: researchers[0].title,
        oneLiner: researchers[0].oneLiner,
        expertise: extractSection(resMarkdown, "Expertise|Specialization") || undefined,
      };
    }
  }

  // Deep depth: add related experiments via graph traversal
  if (depth === "deep") {
    // Find experiments with same reaction type (via backlinks from reaction type page)
    if (reactionTypes[0]) {
      const relatedExpLinks = await prisma.pageLink.findMany({
        where: { targetPageId: reactionTypes[0].id, tenantId },
        include: {
          sourcePage: {
            select: { id: true, title: true, oneLiner: true },
          },
        },
        take: 10,
      });

      result.institutionalKnowledge.relatedExperiments = relatedExpLinks
        .filter((l) => l.sourcePage.id !== expPage.id)
        .map((l) => ({
          id: l.sourcePage.id,
          title: l.sourcePage.title,
          oneLiner: l.sourcePage.oneLiner,
        }));
    }

    // Expand institutional knowledge from related experiment pages
    for (const related of result.institutionalKnowledge.relatedExperiments.slice(0, 3)) {
      const relMarkdown = await getPageMarkdown(related.id, tenantId);
      const relPitfalls = extractBulletPoints(relMarkdown, "Challenges|Issues|Pitfalls");
      const relTips = extractBulletPoints(relMarkdown, "Tips|Notes|Practical");
      result.institutionalKnowledge.commonPitfalls.push(...relPitfalls);
      result.institutionalKnowledge.tips.push(...relTips);
    }

    // Deduplicate
    result.institutionalKnowledge.bestPractices = [...new Set(result.institutionalKnowledge.bestPractices)];
    result.institutionalKnowledge.commonPitfalls = [...new Set(result.institutionalKnowledge.commonPitfalls)];
    result.institutionalKnowledge.tips = [...new Set(result.institutionalKnowledge.tips)];
  }

  // Truncate if over budget (trim institutional knowledge first, keep procedures)
  if (JSON.stringify(result).length > maxSize) {
    result.truncated = true;
    while (
      JSON.stringify(result).length > maxSize &&
      result.institutionalKnowledge.tips.length > 0
    ) {
      result.institutionalKnowledge.tips.pop();
    }
    while (
      JSON.stringify(result).length > maxSize &&
      result.institutionalKnowledge.commonPitfalls.length > 0
    ) {
      result.institutionalKnowledge.commonPitfalls.pop();
    }
    while (
      JSON.stringify(result).length > maxSize &&
      result.institutionalKnowledge.relatedExperiments.length > 0
    ) {
      result.institutionalKnowledge.relatedExperiments.pop();
    }
  }

  // Set final context size (must be last mutation)
  result.contextSize = JSON.stringify(result).length;

  return result;
}
