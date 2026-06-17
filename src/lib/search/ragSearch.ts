/**
 * RAG Search with Wikilink Following (Story 53.3)
 *
 * Approach A: Full-text search over all KB content, then follow
 * wikilinks at configurable depth to gather related context.
 */

import { prisma } from "@/lib/db";
import { getPageCategory, normalizeCategory } from "./categoryUtils";

export interface RagSearchOptions {
  tenantId: string;
  query: string;
  depth?: 0 | 1 | 2;          // Wikilink follow depth (default 1)
  limit?: number;              // Max results (default 10)
  category?: string;           // Optional category filter
  scope?: "private" | "team" | "all";
}

export interface RagSearchResultItem {
  pageId: string;
  title: string;
  oneLiner: string | null;
  score: number;
  category: string | null;
  hopDistance: number;          // 0 = direct match, 1 = 1-hop link, 2 = 2-hop link
  snippet: string | null;
}

export interface RagSearchResult {
  results: RagSearchResultItem[];
  totalMatched: number;
  searchTimeMs: number;
}

/**
 * RAG search: FTS over all content + title matching, then wikilink following.
 */
export async function ragSearch(
  opts: RagSearchOptions
): Promise<RagSearchResult> {
  const startTime = Date.now();
  const {
    tenantId,
    query,
    depth = 1,
    limit = 10,
    category,
    scope = "team",
  } = opts;

  const sanitizedQuery = query.replace(/[<>]/g, "").trim();
  if (sanitizedQuery.length === 0) {
    return { results: [], totalMatched: 0, searchTimeMs: 0 };
  }

  const scopeWhere = scope === "private"
    ? `AND p.space_type = 'PRIVATE'`
    : scope === "team"
      ? `AND p.space_type = 'TEAM'`
      : "";

  // Step 1: FTS content search
  type FtsRow = {
    page_id: string;
    page_title: string;
    page_one_liner: string | null;
    parent_id: string | null;
    fts_rank: number;
    fts_snippet: string | null;
  };

  let ftsResults: FtsRow[] = [];
  try {
    ftsResults = await prisma.$queryRawUnsafe<FtsRow[]>(
      `SELECT DISTINCT ON (p.id)
        p.id AS page_id,
        p.title AS page_title,
        p.one_liner AS page_one_liner,
        p.parent_id,
        ts_rank(b.search_vector, plainto_tsquery('english', $1)) AS fts_rank,
        ts_headline(
          'english',
          b.plain_text,
          plainto_tsquery('english', $1),
          'MaxFragments=1, MinWords=15, MaxWords=35'
        ) AS fts_snippet
      FROM pages p
      JOIN blocks b ON b.page_id = p.id
      WHERE b.search_vector @@ plainto_tsquery('english', $1)
        AND b.tenant_id::text = $2
        ${scopeWhere}
      ORDER BY p.id, fts_rank DESC
      LIMIT $3`,
      sanitizedQuery,
      tenantId,
      limit * 2 // Fetch extra for post-filtering
    );
  } catch {
    // FTS not available — fall through
  }

  // Step 2: Title search (ILIKE for titles since they don't have tsvector)
  const titleMatches = await prisma.page.findMany({
    where: {
      tenantId,
      OR: [
        { title: { contains: sanitizedQuery, mode: "insensitive" } },
        { oneLiner: { contains: sanitizedQuery, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      title: true,
      oneLiner: true,
      parentId: true,
    },
    take: limit,
  });

  // Step 3: Merge and deduplicate, scoring
  const seenIds = new Set<string>();
  const directMatches: Array<{
    pageId: string;
    title: string;
    oneLiner: string | null;
    parentId: string | null;
    score: number;
    snippet: string | null;
  }> = [];

  // Title matches get score 1.0
  for (const m of titleMatches) {
    if (!seenIds.has(m.id)) {
      seenIds.add(m.id);
      directMatches.push({
        pageId: m.id,
        title: m.title,
        oneLiner: m.oneLiner,
        parentId: m.parentId,
        score: 1.0,
        snippet: null,
      });
    }
  }

  // FTS matches get ts_rank score (boosted slightly if also title matched)
  for (const m of ftsResults) {
    if (!seenIds.has(m.page_id)) {
      seenIds.add(m.page_id);
      directMatches.push({
        pageId: m.page_id,
        title: m.page_title,
        oneLiner: m.page_one_liner,
        parentId: m.parent_id,
        score: Math.min(m.fts_rank + 0.1, 0.95),
        snippet: m.fts_snippet,
      });
    }
  }

  // Sort by score
  directMatches.sort((a, b) => b.score - a.score);

  // Step 4: Category detection + filtering
  const categoryCache = new Map<string, string | null>();
  const withCategory = await Promise.all(
    directMatches.map(async (m) => ({
      ...m,
      category: await getPageCategory(m.pageId, m.parentId, tenantId, categoryCache),
    }))
  );

  let filtered = withCategory;
  if (category) {
    const normCat = normalizeCategory(category);
    filtered = withCategory.filter((m) => m.category === normCat);
  }

  // Take top N direct matches
  const topMatches = filtered.slice(0, limit);
  const totalMatched = filtered.length;

  // Step 5: Wikilink following
  const results: RagSearchResultItem[] = topMatches.map((m) => ({
    pageId: m.pageId,
    title: m.title,
    oneLiner: m.oneLiner,
    score: m.score,
    category: m.category,
    hopDistance: 0,
    snippet: m.snippet,
  }));

  if (depth >= 1 && topMatches.length > 0) {
    // Get 1-hop linked pages from top matches
    const topPageIds = topMatches.slice(0, 5).map((m) => m.pageId);
    const hop1Links = await prisma.pageLink.findMany({
      where: {
        sourcePageId: { in: topPageIds },
        tenantId,
      },
      include: {
        targetPage: {
          select: { id: true, title: true, oneLiner: true, parentId: true },
        },
      },
      take: 20,
    });

    const hop1PageIds: string[] = [];
    for (const link of hop1Links) {
      const tp = link.targetPage;
      if (seenIds.has(tp.id)) continue;
      seenIds.add(tp.id);

      const cat = await getPageCategory(tp.id, tp.parentId, tenantId, categoryCache);
      if (category && cat !== normalizeCategory(category)) continue;

      hop1PageIds.push(tp.id);
      results.push({
        pageId: tp.id,
        title: tp.title,
        oneLiner: tp.oneLiner,
        score: 0.6, // 1-hop pages get lower base score
        category: cat,
        hopDistance: 1,
        snippet: null,
      });
    }

    // 2-hop: follow links from 1-hop pages
    if (depth >= 2 && hop1PageIds.length > 0) {
      const hop2Links = await prisma.pageLink.findMany({
        where: {
          sourcePageId: { in: hop1PageIds.slice(0, 10) },
          tenantId,
        },
        include: {
          targetPage: {
            select: { id: true, title: true, oneLiner: true, parentId: true },
          },
        },
        take: 15,
      });

      for (const link of hop2Links) {
        const tp = link.targetPage;
        if (seenIds.has(tp.id)) continue;
        seenIds.add(tp.id);

        const cat = await getPageCategory(tp.id, tp.parentId, tenantId, categoryCache);
        if (category && cat !== normalizeCategory(category)) continue;

        results.push({
          pageId: tp.id,
          title: tp.title,
          oneLiner: tp.oneLiner,
          score: 0.3, // 2-hop pages get lowest score
          category: cat,
          hopDistance: 2,
          snippet: null,
        });
      }
    }
  }

  // Final sort by score
  results.sort((a, b) => b.score - a.score);

  return {
    results: results.slice(0, limit * 2), // Allow linked pages to expand result set
    totalMatched,
    searchTimeMs: Date.now() - startTime,
  };
}
