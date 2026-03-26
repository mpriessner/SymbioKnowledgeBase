/**
 * Depth-aware search for the Chemistry KB.
 *
 * Three levels:
 * - default: title + oneLiner only, fast (<100ms)
 * - medium:  + content snippets + 1-hop linked pages (<300ms)
 * - deep:    + graph traversal + institutional knowledge extraction (<1000ms)
 */

import { prisma } from "@/lib/db";
import { tiptapToMarkdown } from "@/lib/agent/markdown";

export type SearchDepth = "default" | "medium" | "deep";
export type SearchScope = "private" | "team" | "all";

export interface DepthSearchOptions {
  tenantId: string;
  query: string;
  depth: SearchDepth;
  scope: SearchScope;
  category?: string;
  limit?: number;
}

export interface DepthSearchResultItem {
  pageId: string;
  title: string;
  oneLiner: string | null;
  snippet?: string;
  score: number;
  category: string | null;
  space: string;
  linkedPages?: string[];
  relatedPages?: string[];
  institutionalKnowledge?: string[];
}

export interface DepthSearchResult {
  results: DepthSearchResultItem[];
  totalCount: number;
  depth: SearchDepth;
  scope: SearchScope;
  searchTimeMs: number;
}

const DEPTH_LIMITS: Record<SearchDepth, number> = {
  default: 10,
  medium: 20,
  deep: 50,
};

/**
 * Determine a page's category from its parent page title.
 */
async function getPageCategory(
  pageId: string,
  parentId: string | null,
  tenantId: string,
  categoryCache: Map<string, string | null>
): Promise<string | null> {
  if (!parentId) return null;
  if (categoryCache.has(parentId)) return categoryCache.get(parentId)!;

  const parent = await prisma.page.findFirst({
    where: { id: parentId, tenantId },
    select: { title: true, parentId: true },
  });

  if (!parent) {
    categoryCache.set(parentId, null);
    return null;
  }

  // Category pages are direct children of the Chemistry KB root
  // Their titles are: Experiments, Chemicals, Reaction Types, Researchers, Substrate Classes
  const categoryTitles = new Set([
    "Experiments",
    "Chemicals",
    "Reaction Types",
    "Researchers",
    "Substrate Classes",
  ]);

  if (categoryTitles.has(parent.title)) {
    const cat = parent.title.toLowerCase().replace(/\s+/g, "_");
    categoryCache.set(parentId, cat);
    return cat;
  }

  // Recurse up if needed (grandchild of category)
  const parentCategory = await getPageCategory(
    parentId,
    parent.parentId,
    tenantId,
    categoryCache
  );
  categoryCache.set(parentId, parentCategory);
  return parentCategory;
}

/**
 * Get a content snippet for a page around the query terms.
 */
async function getSnippet(
  pageId: string,
  tenantId: string,
  query: string,
  maxLength: number = 200
): Promise<string | undefined> {
  const block = await prisma.block.findFirst({
    where: { pageId, tenantId, type: "DOCUMENT" },
    select: { plainText: true },
  });

  if (!block?.plainText) return undefined;

  const text = block.plainText;
  const queryLower = query.toLowerCase();
  const idx = text.toLowerCase().indexOf(queryLower);

  if (idx === -1) {
    return text.slice(0, maxLength) + (text.length > maxLength ? "..." : "");
  }

  const start = Math.max(0, idx - 80);
  const end = Math.min(text.length, idx + queryLower.length + 120);
  let snippet = text.slice(start, end).trim();
  if (start > 0) snippet = "..." + snippet;
  if (end < text.length) snippet = snippet + "...";
  return snippet;
}

/**
 * Get linked page titles for a page (1-hop outgoing links).
 */
async function getLinkedPageTitles(
  pageId: string,
  tenantId: string
): Promise<string[]> {
  const links = await prisma.pageLink.findMany({
    where: { sourcePageId: pageId, tenantId },
    include: { targetPage: { select: { title: true } } },
    take: 10,
  });
  return links.map((l) => l.targetPage.title);
}

/**
 * Search with configurable depth, scope, and category filtering.
 */
export async function depthSearch(
  opts: DepthSearchOptions
): Promise<DepthSearchResult> {
  const startTime = Date.now();
  const { tenantId, query, depth, scope, category } = opts;
  const limit = opts.limit ?? DEPTH_LIMITS[depth];

  // Build where clause for scope filtering
  const scopeFilter =
    scope === "private"
      ? { spaceType: "PRIVATE" as const }
      : scope === "team"
        ? { spaceType: "TEAM" as const }
        : {}; // "all" = no filter

  // Step 1: Search pages by title and oneLiner (all depths)
  const titleMatches = await prisma.page.findMany({
    where: {
      tenantId,
      ...scopeFilter,
      OR: [
        { title: { contains: query, mode: "insensitive" as const } },
        { oneLiner: { contains: query, mode: "insensitive" as const } },
      ],
    },
    select: {
      id: true,
      title: true,
      oneLiner: true,
      spaceType: true,
      parentId: true,
    },
    take: limit,
    orderBy: { updatedAt: "desc" },
  });

  // Step 2: For medium/deep, also search block content
  let contentMatches: typeof titleMatches = [];
  if (depth === "medium" || depth === "deep") {
    const blocks = await prisma.block.findMany({
      where: {
        tenantId,
        type: "DOCUMENT",
        plainText: { contains: query, mode: "insensitive" as const },
        page: { ...scopeFilter },
      },
      select: {
        page: {
          select: {
            id: true,
            title: true,
            oneLiner: true,
            spaceType: true,
            parentId: true,
          },
        },
      },
      take: limit,
    });
    contentMatches = blocks.map((b) => b.page);
  }

  // Merge and deduplicate results
  const seenIds = new Set<string>();
  const allMatches: typeof titleMatches = [];

  // Title matches get higher score (added first)
  for (const match of titleMatches) {
    if (!seenIds.has(match.id)) {
      seenIds.add(match.id);
      allMatches.push(match);
    }
  }
  for (const match of contentMatches) {
    if (!seenIds.has(match.id)) {
      seenIds.add(match.id);
      allMatches.push(match);
    }
  }

  // Step 3: Determine categories and filter
  const categoryCache = new Map<string, string | null>();
  const resultsWithCategory = await Promise.all(
    allMatches.map(async (match) => {
      const cat = await getPageCategory(
        match.id,
        match.parentId,
        tenantId,
        categoryCache
      );
      return { ...match, category: cat };
    })
  );

  // Apply category filter if specified
  const categoryMap: Record<string, string> = {
    experiments: "experiments",
    chemicals: "chemicals",
    reactiontypes: "reaction_types",
    reaction_types: "reaction_types",
    researchers: "researchers",
    substrateclasses: "substrate_classes",
    substrate_classes: "substrate_classes",
  };

  let filtered = resultsWithCategory;
  if (category) {
    const normalizedCategory = categoryMap[category.toLowerCase()] ?? category.toLowerCase();
    filtered = resultsWithCategory.filter(
      (r) => r.category === normalizedCategory
    );
  }

  // Step 4: Build result items
  const titleSet = new Set(titleMatches.map((m) => m.id));
  const resultItems: DepthSearchResultItem[] = [];

  for (const match of filtered.slice(0, limit)) {
    const item: DepthSearchResultItem = {
      pageId: match.id,
      title: match.title,
      oneLiner: match.oneLiner,
      score: titleSet.has(match.id) ? 1.0 : 0.5,
      category: match.category,
      space: match.spaceType.toLowerCase(),
    };

    // Medium/deep: add snippets and linked pages
    if (depth === "medium" || depth === "deep") {
      const [snippet, linkedPages] = await Promise.all([
        getSnippet(match.id, tenantId, query),
        getLinkedPageTitles(match.id, tenantId),
      ]);
      item.snippet = snippet;
      item.linkedPages = linkedPages;
    }

    // Deep: add related pages (2-hop) and institutional knowledge
    if (depth === "deep") {
      // 2-hop: get pages linked FROM the linked pages
      const links = await prisma.pageLink.findMany({
        where: { sourcePageId: match.id, tenantId },
        select: { targetPageId: true },
        take: 5,
      });
      const hopTwoLinks = await prisma.pageLink.findMany({
        where: {
          sourcePageId: { in: links.map((l) => l.targetPageId) },
          tenantId,
        },
        include: { targetPage: { select: { title: true } } },
        take: 10,
      });
      item.relatedPages = [
        ...new Set(hopTwoLinks.map((l) => l.targetPage.title)),
      ];

      // Extract institutional knowledge bullet points from content
      const block = await prisma.block.findFirst({
        where: { pageId: match.id, tenantId, type: "DOCUMENT" },
        select: { content: true },
      });
      if (block) {
        const markdown = tiptapToMarkdown(block.content);
        const ikLines = markdown
          .split("\n")
          .filter((line) => line.match(/^[-*]\s+/))
          .map((line) => line.replace(/^[-*]\s+/, "").trim())
          .filter(Boolean)
          .slice(0, 5);
        if (ikLines.length > 0) {
          item.institutionalKnowledge = ikLines;
        }
      }
    }

    resultItems.push(item);
  }

  return {
    results: resultItems,
    totalCount: filtered.length,
    depth,
    scope,
    searchTimeMs: Date.now() - startTime,
  };
}
