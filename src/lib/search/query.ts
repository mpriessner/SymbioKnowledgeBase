import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import type { SearchFilters, SearchResultItem } from "@/types/search";

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

export interface EnhancedSearchResults {
  results: SearchResultItem[];
  total: number;
}

/**
 * Enhanced search with filters.
 *
 * Searches across page titles and block content using PostgreSQL FTS.
 * Supports:
 * - Date range filtering (updatedAt)
 * - Content type filtering (code blocks, images, links)
 * - Relevance ranking (ts_rank)
 * - Snippet generation with highlighting (ts_headline)
 *
 * @param query - Search query string
 * @param tenantId - Tenant UUID for scoping
 * @param filters - Optional filters (date range, content type)
 * @param limit - Max results (default 20)
 * @param offset - Pagination offset (default 0)
 */
export async function enhancedSearchBlocks(
  query: string,
  tenantId: string,
  filters: SearchFilters = {},
  limit: number = 20,
  offset: number = 0
): Promise<EnhancedSearchResults> {
  // Trim only. FTS query text is passed as a BOUND parameter to
  // plainto_tsquery / ILIKE below, which is injection-safe; the old cosmetic
  // replace(/[<>]/g,"") was not SQL sanitization and is removed (audit S12).
  const sanitizedQuery = query.trim();

  if (sanitizedQuery.length === 0) {
    return { results: [], total: 0 };
  }

  const likePattern = `%${sanitizedQuery}%`;

  // Try FTS first, fall back to keyword (ILIKE) search
  try {
    const ftsResults = await ftsSearch(sanitizedQuery, tenantId, filters, limit, offset);
    if (ftsResults.total > 0) return ftsResults;
  } catch {
    // FTS failed — fall through to keyword search
  }

  // Keyword search: match page titles and block plain_text via ILIKE. Composed
  // with Prisma.sql tagged templates so every value is a bound parameter — no
  // $queryRawUnsafe, no string-concatenated SQL (audit S12).
  const [results, countResult] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        page_id: string;
        page_title: string;
        page_icon: string | null;
        updated_at: Date;
        block_id: string | null;
        rank: number;
        snippet: string;
      }>
    >(Prisma.sql`
      SELECT DISTINCT ON (p.id)
        p.id AS page_id,
        p.title AS page_title,
        p.icon AS page_icon,
        p.updated_at,
        b.id AS block_id,
        CASE
          WHEN p.title ILIKE ${likePattern} THEN 1.0
          WHEN b.plain_text ILIKE ${likePattern} THEN 0.5
          ELSE 0.1
        END AS rank,
        CASE
          WHEN length(b.plain_text) > 0
          THEN substring(b.plain_text, 1, 200)
          ELSE p.title
        END AS snippet
      FROM pages p
      LEFT JOIN blocks b ON b.page_id = p.id
      WHERE p.tenant_id::text = ${tenantId}
        AND (p.title ILIKE ${likePattern} OR b.plain_text ILIKE ${likePattern})
      ORDER BY p.id, rank DESC
    `),
    prisma.$queryRaw<[{ total: bigint }]>(Prisma.sql`
      SELECT COUNT(DISTINCT p.id) AS total
      FROM pages p
      LEFT JOIN blocks b ON b.page_id = p.id
      WHERE p.tenant_id::text = ${tenantId}
        AND (p.title ILIKE ${likePattern} OR b.plain_text ILIKE ${likePattern})
    `),
  ]);

  const total = Number(countResult[0]?.total || 0);

  // Sort by rank, apply pagination
  const sorted = results.sort((a, b) => b.rank - a.rank);
  const paginated = sorted.slice(offset, offset + limit);

  const mappedResults: SearchResultItem[] = paginated.map((row) => ({
    pageId: row.page_id,
    pageTitle: row.page_title,
    pageIcon: row.page_icon,
    snippet: row.snippet,
    score: parseFloat(String(row.rank)),
    updatedAt: row.updated_at.toISOString(),
    matchedBlockIds: row.block_id ? [row.block_id] : [],
  }));

  return { results: mappedResults, total };
}

/**
 * PostgreSQL Full-Text Search implementation.
 * Used as the primary search method when search_vector is populated.
 */
async function ftsSearch(
  sanitizedQuery: string,
  tenantId: string,
  filters: SearchFilters,
  limit: number,
  offset: number
): Promise<EnhancedSearchResults> {
  // Compose the dynamic WHERE as parameterized Prisma.sql fragments joined with
  // Prisma.join — no string concatenation, no manual $N indexing (audit S12).
  // Every value (query text, tenantId, dates) is a bound parameter; the only
  // literals are constant SQL keywords / enum-derived content-type predicates.
  const whereConditions: Prisma.Sql[] = [
    Prisma.sql`b.search_vector @@ plainto_tsquery('english', ${sanitizedQuery})`,
    Prisma.sql`b.tenant_id::text = ${tenantId}`,
  ];

  if (filters.dateFrom) {
    whereConditions.push(Prisma.sql`p.updated_at >= ${filters.dateFrom}::date`);
  }

  if (filters.dateTo) {
    whereConditions.push(
      Prisma.sql`p.updated_at <= ${filters.dateTo}::date + interval '1 day'`
    );
  }

  if (filters.contentType && filters.contentType.length > 0) {
    const contentTypeConditions: Prisma.Sql[] = [];
    for (const type of filters.contentType) {
      switch (type) {
        case "code":
          contentTypeConditions.push(
            Prisma.sql`EXISTS (SELECT 1 FROM blocks b2 WHERE b2.page_id = p.id AND b2.tenant_id = p.tenant_id AND b2.content::jsonb->>'type' = 'codeBlock')`
          );
          break;
        case "images":
          contentTypeConditions.push(
            Prisma.sql`EXISTS (SELECT 1 FROM blocks b2 WHERE b2.page_id = p.id AND b2.tenant_id = p.tenant_id AND b2.content::jsonb->>'type' = 'image')`
          );
          break;
        case "links":
          contentTypeConditions.push(
            Prisma.sql`EXISTS (SELECT 1 FROM blocks b2 WHERE b2.page_id = p.id AND b2.tenant_id = p.tenant_id AND b2.content::jsonb::text LIKE '%"type":"link"%')`
          );
          break;
      }
    }
    if (contentTypeConditions.length > 0) {
      whereConditions.push(
        Prisma.sql`(${Prisma.join(contentTypeConditions, " OR ")})`
      );
    }
  }

  const whereClause = Prisma.join(whereConditions, " AND ");

  const [results, countResult] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        page_id: string;
        page_title: string;
        page_icon: string | null;
        updated_at: Date;
        rank: number;
        snippet: string;
        matched_block_ids: string[];
      }>
    >(Prisma.sql`
      WITH ranked_blocks AS (
        SELECT
          p.id AS page_id,
          p.title AS page_title,
          p.icon AS page_icon,
          p.updated_at,
          b.id AS block_id,
          ts_rank(b.search_vector, plainto_tsquery('english', ${sanitizedQuery})) AS rank,
          ts_headline(
            'english',
            b.plain_text,
            plainto_tsquery('english', ${sanitizedQuery}),
            'MaxFragments=2, MinWords=25, MaxWords=50, HighlightAll=false, StartSel=<mark>, StopSel=</mark>'
          ) AS snippet
        FROM pages p
        JOIN blocks b ON b.page_id = p.id
        WHERE ${whereClause}
      ),
      best_per_page AS (
        SELECT DISTINCT ON (page_id)
          page_id, page_title, page_icon, updated_at, rank, snippet, block_id
        FROM ranked_blocks
        ORDER BY page_id, rank DESC
      ),
      aggregated AS (
        SELECT
          bp.page_id, bp.page_title, bp.page_icon, bp.updated_at, bp.rank, bp.snippet,
          array_agg(rb.block_id) AS matched_block_ids
        FROM best_per_page bp
        JOIN ranked_blocks rb ON rb.page_id = bp.page_id
        GROUP BY bp.page_id, bp.page_title, bp.page_icon, bp.updated_at, bp.rank, bp.snippet
      )
      SELECT * FROM aggregated
      ORDER BY rank DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `),
    prisma.$queryRaw<[{ total: bigint }]>(Prisma.sql`
      SELECT COUNT(DISTINCT p.id) AS total
      FROM pages p
      JOIN blocks b ON b.page_id = p.id
      WHERE ${whereClause}
    `),
  ]);

  const total = Number(countResult[0]?.total || 0);

  const mappedResults: SearchResultItem[] = results.map((row) => ({
    pageId: row.page_id,
    pageTitle: row.page_title,
    pageIcon: row.page_icon,
    snippet: row.snippet,
    score: parseFloat(String(row.rank)),
    updatedAt: row.updated_at.toISOString(),
    matchedBlockIds: row.matched_block_ids,
  }));

  return { results: mappedResults, total };
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
  // Trim only — the query text is a BOUND parameter to plainto_tsquery below
  // (injection-safe). The previous replace(/[<>]/g,"") was cosmetic (audit S12).
  const sanitizedQuery = query.trim();

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
  // Trim only — passed to Prisma's parameterized `contains` (injection-safe).
  const sanitizedQuery = query.trim();

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
