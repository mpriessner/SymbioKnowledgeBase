import { prisma } from "@/lib/db";

export interface SearchResult {
  pageId: string;
  pageTitle: string;
  pageIcon: string | null;
  blockId: string;
  snippet: string;
  rank: number;
}

export interface SearchResults {
  results: SearchResult[];
  total: number;
}

/**
 * Searches blocks using PostgreSQL full-text search.
 *
 * Uses plainto_tsquery to parse the search term (handles spaces, stopwords).
 * Uses ts_rank for relevance scoring.
 * Uses ts_headline to generate snippets with highlighted matching terms.
 *
 * Results are grouped by page — if multiple blocks in the same page match,
 * only the highest-ranked block is returned.
 *
 * @param query - The search query string
 * @param tenantId - Tenant UUID for scoping
 * @param limit - Maximum number of results (default 20)
 * @param offset - Offset for pagination (default 0)
 * @returns Search results with snippets and relevance scores
 */
export async function searchBlocks(
  query: string,
  tenantId: string,
  limit: number = 20,
  offset: number = 0
): Promise<SearchResults> {
  // Sanitize the query — plainto_tsquery handles most injection prevention,
  // but we still strip dangerous characters
  const sanitizedQuery = query.replace(/[<>]/g, "").trim();

  if (sanitizedQuery.length === 0) {
    return { results: [], total: 0 };
  }

  // Execute the search using raw SQL for access to ts_rank and ts_headline
  const results = await prisma.$queryRaw<
    Array<{
      page_id: string;
      page_title: string;
      page_icon: string | null;
      block_id: string;
      snippet: string;
      rank: number;
    }>
  >`
    SELECT DISTINCT ON (b.page_id)
      b.page_id,
      p.title AS page_title,
      p.icon AS page_icon,
      b.id AS block_id,
      ts_headline(
        'english',
        b.plain_text,
        plainto_tsquery('english', ${sanitizedQuery}),
        'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15, MaxFragments=1'
      ) AS snippet,
      ts_rank(b.search_vector, plainto_tsquery('english', ${sanitizedQuery})) AS rank
    FROM blocks b
    JOIN pages p ON p.id = b.page_id
    WHERE b.search_vector @@ plainto_tsquery('english', ${sanitizedQuery})
      AND b.tenant_id = ${tenantId}::uuid
    ORDER BY b.page_id, rank DESC
  `;

  // Sort by rank (DISTINCT ON loses the overall ordering)
  const sorted = results.sort((a, b) => b.rank - a.rank);

  // Apply pagination
  const total = sorted.length;
  const paginated = sorted.slice(offset, offset + limit);

  return {
    results: paginated.map((r) => ({
      pageId: r.page_id,
      pageTitle: r.page_title,
      pageIcon: r.page_icon,
      blockId: r.block_id,
      snippet: r.snippet,
      rank: r.rank,
    })),
    total,
  };
}

/**
 * Searches pages by title only (no block content).
 * Used for quick page title matching (autocomplete, quick switcher).
 *
 * @param query - The search query string
 * @param tenantId - Tenant UUID
 * @param limit - Maximum results (default 10)
 */
export async function searchPagesByTitle(
  query: string,
  tenantId: string,
  limit: number = 10
): Promise<Array<{ id: string; title: string; icon: string | null }>> {
  const sanitizedQuery = query.replace(/[<>]/g, "").trim();

  if (sanitizedQuery.length === 0) {
    return [];
  }

  return prisma.page.findMany({
    where: {
      tenantId,
      title: {
        contains: sanitizedQuery,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      title: true,
      icon: true,
    },
    take: limit,
    orderBy: {
      updatedAt: "desc",
    },
  });
}
