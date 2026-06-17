/**
 * Search Strategy Router (Story 53.5)
 *
 * Selects between RAG search (Approach A) and Agentic search (Approach B),
 * or combines both for complex queries.
 */

import type { QueryIntent } from "@/lib/agent/kbQuery";
import { ragSearch, type RagSearchResultItem } from "./ragSearch";
import { agenticSearch, type AgenticSearchResultItem } from "./agenticSearch";

export type SearchStrategy = "auto" | "rag" | "agentic";
export type ResolvedStrategy = "rag" | "agentic" | "combined";

export interface RouteSearchOptions {
  tenantId: string;
  query: string;
  intent: QueryIntent;
  strategy?: SearchStrategy;
  depth?: 0 | 1 | 2;
  limit?: number;
  category?: string;
}

export interface RoutedSearchResultItem {
  pageId: string;
  title: string;
  oneLiner: string | null;
  score: number;
  category: string | null;
  content?: string;            // From agentic deep reads
  snippet?: string | null;     // From RAG FTS
  source: "rag" | "agentic";
}

export interface RoutedSearchResult {
  results: RoutedSearchResultItem[];
  strategy: ResolvedStrategy;
  searchTimeMs: number;
  metadata: {
    ragResults?: number;
    agenticResults?: number;
    navigationPath?: string[];
  };
}

/**
 * Determine the best strategy for a query (when strategy is "auto").
 */
function autoSelectStrategy(query: string, intent: QueryIntent): ResolvedStrategy {
  const words = query.trim().split(/\s+/).length;

  // Complex queries → agentic
  if (words > 12) return "agentic";
  if (/compare|which is better|what substrate|across|between/i.test(query)) return "agentic";
  if (intent === "related" || intent === "expertise") return "agentic";

  // Short, specific queries → RAG
  if (words < 8) return "rag";
  if (intent === "safety" || intent === "properties") return "rag";

  // Medium complexity → combined
  return "combined";
}

/**
 * Route a search query to the appropriate strategy.
 */
export async function routeSearch(
  opts: RouteSearchOptions
): Promise<RoutedSearchResult> {
  const startTime = Date.now();
  const {
    tenantId,
    query,
    intent,
    strategy = "auto",
    depth = 1,
    limit = 10,
    category,
  } = opts;

  const resolved: ResolvedStrategy = strategy === "auto"
    ? autoSelectStrategy(query, intent)
    : strategy as ResolvedStrategy;

  const runRag = resolved === "rag" || resolved === "combined";
  const runAgentic = resolved === "agentic" || resolved === "combined";

  // Run selected strategies (in parallel for combined)
  const [ragResult, agenticResult] = await Promise.all([
    runRag
      ? ragSearch({ tenantId, query, depth, limit, category, scope: "team" })
      : null,
    runAgentic
      ? agenticSearch({ tenantId, query, intent, maxPagesToRead: 5, crossReference: true })
      : null,
  ]);

  // Merge results
  const seenIds = new Set<string>();
  const merged: RoutedSearchResultItem[] = [];

  // Add RAG results
  if (ragResult) {
    for (const r of ragResult.results) {
      if (!seenIds.has(r.pageId)) {
        seenIds.add(r.pageId);
        merged.push({
          pageId: r.pageId,
          title: r.title,
          oneLiner: r.oneLiner,
          score: r.score,
          category: r.category,
          snippet: r.snippet,
          source: "rag",
        });
      }
    }
  }

  // Add agentic results, boosting score if also found by RAG
  if (agenticResult) {
    for (const r of agenticResult.results) {
      const existing = merged.find((m) => m.pageId === r.pageId);
      if (existing) {
        // Found by both strategies — boost score by 1.5x
        existing.score = Math.min(existing.score * 1.5, 1.0);
        existing.content = r.content;
      } else {
        seenIds.add(r.pageId);
        merged.push({
          pageId: r.pageId,
          title: r.title,
          oneLiner: r.oneLiner,
          score: r.score,
          category: r.category,
          content: r.content,
          source: "agentic",
        });
      }
    }
  }

  // Sort by score
  merged.sort((a, b) => b.score - a.score);

  // If RAG returned too few results and we only ran RAG, fall back to agentic
  let actualStrategy = resolved;
  if (resolved === "rag" && merged.length < 2) {
    const fallback = await agenticSearch({
      tenantId,
      query,
      intent,
      maxPagesToRead: 5,
      crossReference: true,
    });

    for (const r of fallback.results) {
      if (!seenIds.has(r.pageId)) {
        seenIds.add(r.pageId);
        merged.push({
          pageId: r.pageId,
          title: r.title,
          oneLiner: r.oneLiner,
          score: r.score,
          category: r.category,
          content: r.content,
          source: "agentic",
        });
      }
    }

    actualStrategy = "combined";
    merged.sort((a, b) => b.score - a.score);
  }

  return {
    results: merged.slice(0, limit * 2),
    strategy: actualStrategy,
    searchTimeMs: Date.now() - startTime,
    metadata: {
      ragResults: ragResult?.totalMatched,
      agenticResults: agenticResult?.results.length,
      navigationPath: agenticResult?.navigationPath,
    },
  };
}
