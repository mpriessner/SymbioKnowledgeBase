import {
  filterByTags,
  extractTagsFromFrontmatter,
  type PageWithTags,
} from "./tagFilter";

export interface TagSearchQuery {
  tags: string[];
  operator: "AND" | "OR";
  tenantId: string;
  limit?: number;
  offset?: number;
}

export interface TagSearchResult {
  page: PageWithTags;
  matchedTags: string[];
  score: number;
}

/**
 * Parses a human-readable tag query string into a structured TagSearchQuery.
 *
 * Examples:
 *   "reaction:suzuki-coupling"
 *     → { tags: ["reaction:suzuki-coupling"], operator: "AND", tenantId: "" }
 *
 *   "researcher:mueller AND reaction:suzuki-coupling"
 *     → { tags: ["researcher:mueller", "reaction:suzuki-coupling"], operator: "AND", tenantId: "" }
 *
 *   "reaction:suzuki-coupling OR reaction:heck"
 *     → { tags: ["reaction:suzuki-coupling", "reaction:heck"], operator: "OR", tenantId: "" }
 *
 *   "scale:large AND quality:4+"
 *     → { tags: ["scale:large", "quality:4+"], operator: "AND", tenantId: "" }
 */
export function parseTagQuery(
  queryString: string,
  tenantId: string = ""
): TagSearchQuery {
  const trimmed = queryString.trim();
  if (!trimmed) {
    return { tags: [], operator: "AND", tenantId };
  }

  // Determine operator: look for explicit AND/OR between tags.
  // If both are present, AND takes precedence (all parts split by AND first).
  // For simplicity, we support one operator type per query.
  const hasAnd = /\s+AND\s+/i.test(trimmed);
  const hasOr = /\s+OR\s+/i.test(trimmed);

  let operator: "AND" | "OR" = "AND";
  let parts: string[];

  if (hasOr && !hasAnd) {
    operator = "OR";
    parts = trimmed.split(/\s+OR\s+/i);
  } else {
    // Default to AND (covers single-tag case and explicit AND)
    operator = "AND";
    parts = trimmed.split(/\s+AND\s+/i);
  }

  const tags = parts
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  return { tags, operator, tenantId };
}

/**
 * Computes a relevance score based on how many query tags matched.
 */
function computeScore(
  pageTags: string[],
  queryTags: string[],
): number {
  let matched = 0;
  for (const qt of queryTags) {
    const rangeMatch = qt.match(/^([a-z-]+):(\d+)\+$/);
    if (rangeMatch) {
      const namespace = rangeMatch[1];
      const minValue = parseInt(rangeMatch[2], 10);
      const prefix = `${namespace}:`;
      const pageTag = pageTags.find((pt) => pt.startsWith(prefix));
      if (pageTag) {
        const val = parseInt(pageTag.slice(prefix.length), 10);
        if (!isNaN(val) && val >= minValue) {
          // Boost score by how far above the minimum
          matched += 1 + (val - minValue) * 0.1;
        }
      }
    } else if (pageTags.some((pt) => pt.toLowerCase() === qt.toLowerCase())) {
      matched += 1;
    }
  }
  return queryTags.length > 0 ? matched / queryTags.length : 0;
}

/**
 * Finds which query tags actually matched against a page's tags.
 */
function findMatchedTags(pageTags: string[], queryTags: string[]): string[] {
  const matched: string[] = [];
  for (const qt of queryTags) {
    const rangeMatch = qt.match(/^([a-z-]+):(\d+)\+$/);
    if (rangeMatch) {
      const namespace = rangeMatch[1];
      const minValue = parseInt(rangeMatch[2], 10);
      const prefix = `${namespace}:`;
      const pageTag = pageTags.find((pt) => pt.startsWith(prefix));
      if (pageTag) {
        const val = parseInt(pageTag.slice(prefix.length), 10);
        if (!isNaN(val) && val >= minValue) {
          matched.push(qt);
        }
      }
    } else if (pageTags.some((pt) => pt.toLowerCase() === qt.toLowerCase())) {
      matched.push(qt);
    }
  }
  return matched;
}

/**
 * Searches pages by tags, returning scored results sorted by relevance.
 */
export function searchByTags(
  query: TagSearchQuery,
  pages: PageWithTags[]
): TagSearchResult[] {
  if (query.tags.length === 0) return [];

  const filtered = filterByTags(pages, query.tags, query.operator);

  const results: TagSearchResult[] = filtered.map((page) => ({
    page,
    matchedTags: findMatchedTags(page.tags, query.tags),
    score: computeScore(page.tags, query.tags),
  }));

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  // Apply offset and limit
  const offset = query.offset ?? 0;
  const limit = query.limit ?? results.length;

  return results.slice(offset, offset + limit);
}
