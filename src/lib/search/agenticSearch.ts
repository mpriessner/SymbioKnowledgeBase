/**
 * Hierarchy-Guided Agentic Search (Story 53.4)
 *
 * Approach B: A deterministic state machine that navigates the KB hierarchy
 * like a researcher would — starting from the category level, scanning pages,
 * reading the most relevant ones, and cross-referencing via wikilinks.
 */

import { prisma } from "@/lib/db";
import { tiptapToMarkdown } from "@/lib/agent/markdown";
import { cosineSimilarity } from "@/lib/chemistryKb/textSimilarity";
import { classifyIntent, type QueryIntent } from "@/lib/agent/kbQuery";
import { getCategoryPageIds } from "./categoryUtils";
import { extractRelevantContent } from "./contentUtils";

export interface AgenticSearchOptions {
  tenantId: string;
  query: string;
  intent?: QueryIntent;        // Override auto-classification
  maxPagesToRead?: number;     // How many pages to deep-read (default 5)
  crossReference?: boolean;    // Follow wikilinks from top pages (default true)
}

export interface AgenticSearchResultItem {
  pageId: string;
  title: string;
  oneLiner: string | null;
  content: string;             // Extracted relevant content
  score: number;
  category: string | null;
  source: "category_scan" | "deep_read" | "cross_reference";
}

export interface AgenticSearchResult {
  results: AgenticSearchResultItem[];
  navigationPath: string[];    // The path the agent took through the hierarchy
  pagesVisited: number;
  searchTimeMs: number;
}

/**
 * Map intent to the primary category to search.
 * Returns an array of categories in priority order.
 */
function intentToCategories(intent: QueryIntent): string[] {
  switch (intent) {
    case "safety":
    case "properties":
      return ["Chemicals", "Substrate Classes"];
    case "procedure":
      return ["Experiments"];
    case "expertise":
      return ["Researchers"];
    case "reaction":
      return ["Reaction Types", "Experiments"];
    case "related":
      return ["Experiments", "Reaction Types"];
    default:
      // General: search all categories
      return ["Experiments", "Chemicals", "Reaction Types", "Researchers", "Substrate Classes"];
  }
}

/**
 * Agentic search: navigate KB hierarchy deterministically.
 */
export async function agenticSearch(
  opts: AgenticSearchOptions
): Promise<AgenticSearchResult> {
  const startTime = Date.now();
  const {
    tenantId,
    query,
    maxPagesToRead = 5,
    crossReference = true,
  } = opts;

  const intent = opts.intent ?? classifyIntent(query);
  const navigationPath: string[] = [`Intent: ${intent}`];
  let pagesVisited = 0;

  // Step 1: Get category page IDs
  const categoryPageIds = await getCategoryPageIds(tenantId);
  navigationPath.push(`Categories found: ${categoryPageIds.size}`);

  // Step 2: Determine which categories to search
  const targetCategories = intentToCategories(intent);
  navigationPath.push(`Target categories: ${targetCategories.join(", ")}`);

  // Step 3: Category scan — load child pages and score titles
  type ScoredPage = {
    id: string;
    title: string;
    oneLiner: string | null;
    score: number;
    category: string;
  };

  const scoredPages: ScoredPage[] = [];

  for (const catName of targetCategories) {
    const catPageId = categoryPageIds.get(catName);
    if (!catPageId) continue;

    navigationPath.push(`Scanning: ${catName}`);

    const childPages = await prisma.page.findMany({
      where: { tenantId, parentId: catPageId },
      select: { id: true, title: true, oneLiner: true },
    });

    pagesVisited += childPages.length;

    for (const page of childPages) {
      // Score using TF-IDF cosine similarity between query and title+oneLiner
      const pageText = [page.title, page.oneLiner || ""].join(" ");
      const score = cosineSimilarity(query, pageText);

      scoredPages.push({
        id: page.id,
        title: page.title,
        oneLiner: page.oneLiner,
        score,
        category: catName.toLowerCase().replace(/\s+/g, "_"),
      });
    }
  }

  // Sort by score descending
  scoredPages.sort((a, b) => b.score - a.score);

  // Step 4: Deep read — load full content of top N pages
  const topPages = scoredPages.slice(0, maxPagesToRead);
  const results: AgenticSearchResultItem[] = [];

  for (const page of topPages) {
    const block = await prisma.block.findFirst({
      where: { pageId: page.id, tenantId, type: "DOCUMENT" },
      select: { content: true },
    });

    let content = page.oneLiner || page.title;
    if (block?.content) {
      const markdown = tiptapToMarkdown(block.content);
      content = extractRelevantContent(markdown, page.oneLiner, intent, 400);
      pagesVisited++;
    }

    navigationPath.push(`Read: ${page.title} (score: ${page.score.toFixed(3)})`);

    results.push({
      pageId: page.id,
      title: page.title,
      oneLiner: page.oneLiner,
      content,
      score: page.score,
      category: page.category,
      source: "deep_read",
    });
  }

  // Step 5: Cross-reference — follow wikilinks from top pages
  if (crossReference && topPages.length > 0) {
    const topPageIds = topPages.map((p) => p.id);
    const seenIds = new Set(topPageIds);

    const links = await prisma.pageLink.findMany({
      where: {
        sourcePageId: { in: topPageIds },
        tenantId,
      },
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
      take: 20,
    });

    // Group cross-references by category for better context
    for (const link of links) {
      const tp = link.targetPage;
      if (seenIds.has(tp.id)) continue;
      seenIds.add(tp.id);

      // Determine category from parent
      let category: string | null = null;
      if (tp.parentId) {
        for (const [catName, catId] of categoryPageIds) {
          if (catId === tp.parentId) {
            category = catName.toLowerCase().replace(/\s+/g, "_");
            break;
          }
        }
      }

      // Score the cross-referenced page against the query
      const pageText = [tp.title, tp.oneLiner || ""].join(" ");
      const score = cosineSimilarity(query, pageText) * 0.7; // Discount for being indirect

      results.push({
        pageId: tp.id,
        title: tp.title,
        oneLiner: tp.oneLiner,
        content: tp.oneLiner || tp.title,
        score,
        category,
        source: "cross_reference",
      });
    }

    navigationPath.push(`Cross-references: ${links.length} links from ${topPageIds.length} pages`);
  }

  // Final sort
  results.sort((a, b) => b.score - a.score);

  return {
    results,
    navigationPath,
    pagesVisited,
    searchTimeMs: Date.now() - startTime,
  };
}
