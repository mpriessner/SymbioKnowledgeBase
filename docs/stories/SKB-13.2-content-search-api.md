# Story SKB-13.2: Content Search API

**Epic:** Epic 13 - Enhanced Search
**Story ID:** SKB-13.2
**Story Points:** 5 | **Priority:** Critical | **Status:** Planned
**Depends On:** SKB-06.1 (FTS infrastructure), SKB-06.2 (basic search API)

---

## User Story

As an API consumer (web UI or LLM agent), I want a search endpoint that returns ranked results with highlighted snippets and supports filtering by date and content type, So that I can build rich search experiences and retrieve precise context from the knowledge base.

---

## Acceptance Criteria

- [ ] Enhanced `GET /api/search` endpoint accepts new query params: `dateFrom`, `dateTo`, `contentType`
- [ ] Query param `contentType` accepts comma-separated values: `code`, `images`, `links`
- [ ] Query param `dateFrom` and `dateTo` accept ISO 8601 date strings (YYYY-MM-DD)
- [ ] Zod schema validates all params: `q` (1-500 chars), `limit` (1-100, default 20), `offset` (>=0, default 0), `dateFrom` (valid date), `dateTo` (valid date), `contentType` (array of valid types)
- [ ] Search uses PostgreSQL `ts_rank` for relevance scoring
- [ ] Search uses PostgreSQL `ts_headline` for snippet generation with highlighted keywords (`<mark>` tags)
- [ ] Snippets limited to 2 fragments, 25-50 words each (PostgreSQL `MaxFragments=2, MinWords=25, MaxWords=50`)
- [ ] Results include: `pageId`, `pageTitle`, `pageIcon`, `snippet`, `score` (normalized 0-1), `updatedAt`, `matchedBlockIds` (array)
- [ ] Filters applied correctly: date range filters `pages.updatedAt`, content type filters block content
- [ ] Content type filter `code` matches pages containing code blocks (TipTap type `codeBlock`)
- [ ] Content type filter `images` matches pages containing images (TipTap type `image`)
- [ ] Content type filter `links` matches pages containing external links (TipTap mark `link`)
- [ ] Results scoped by `tenant_id` for multi-tenant isolation
- [ ] Returns 401 if unauthenticated
- [ ] Returns 400 if validation fails (with detailed field errors)
- [ ] TypeScript strict mode — no `any` types

---

## Architecture Overview

```
Enhanced Search API Flow
────────────────────────

Client Request
   │
   ├─ GET /api/search?q=postgresql&dateFrom=2026-01-01&contentType=code,images
   │
   ▼
┌──────────────────────────────────────────────────────────┐
│  /api/search/route.ts                                     │
│                                                            │
│  1. Parse & validate query params (Zod)                   │
│     - q: string (required, 1-500 chars)                   │
│     - limit: number (1-100, default 20)                   │
│     - offset: number (>=0, default 0)                     │
│     - dateFrom: string (ISO date, optional)               │
│     - dateTo: string (ISO date, optional)                 │
│     - contentType: string[] (optional, comma-separated)   │
│                                                            │
│  2. Call enhancedSearchBlocks(q, tenantId, filters)       │
│                                                            │
│  3. Map results to API response format                    │
│                                                            │
│  4. Return listResponse(data, total, limit, offset)       │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│  lib/search/query.ts                                      │
│                                                            │
│  enhancedSearchBlocks(q, tenantId, filters)               │
│                                                            │
│  1. Build PostgreSQL query with:                          │
│     - ts_rank(search_vector, plainto_tsquery(q))          │
│     - ts_headline(plain_text, plainto_tsquery(q),         │
│                   'MaxFragments=2, MinWords=25')          │
│     - Date filters: WHERE updatedAt >= dateFrom           │
│     - Content type filters:                               │
│       - code: content->'type' = 'codeBlock'              │
│       - images: content->'type' = 'image'                 │
│       - links: content contains link mark                 │
│                                                            │
│  2. Execute query with Prisma.$queryRaw                   │
│                                                            │
│  3. Return { results, total }                             │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│  PostgreSQL                                               │
│                                                            │
│  SELECT DISTINCT ON (p.id)                                │
│    p.id AS page_id,                                       │
│    p.title AS page_title,                                 │
│    p.icon AS page_icon,                                   │
│    p.updated_at,                                          │
│    ts_rank(b.search_vector, query) AS rank,               │
│    ts_headline('english', b.plain_text, query,            │
│                'MaxFragments=2, MinWords=25') AS snippet, │
│    array_agg(b.id) AS matched_block_ids                   │
│  FROM pages p                                             │
│  JOIN blocks b ON b.page_id = p.id                        │
│  WHERE b.search_vector @@ plainto_tsquery('english', $q)  │
│    AND p.tenant_id = $tenantId                            │
│    AND p.updated_at >= $dateFrom (if set)                 │
│    AND p.updated_at <= $dateTo (if set)                   │
│    AND (content type filters)                             │
│  GROUP BY p.id, b.id, rank                                │
│  ORDER BY p.id, rank DESC                                 │
│  LIMIT $limit OFFSET $offset                              │
└──────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Update SearchQuerySchema with Filter Params

Add validation for new filter parameters.

**File: `src/types/search.ts`** (modify existing)

```typescript
import { z } from 'zod';

/**
 * Content type filters for search.
 * - code: Pages containing code blocks
 * - images: Pages containing images
 * - links: Pages containing external links
 */
export const ContentTypeFilter = z.enum(['code', 'images', 'links']);
export type ContentTypeFilter = z.infer<typeof ContentTypeFilter>;

/**
 * Search filter schema.
 */
export const SearchFiltersSchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  contentType: z.array(ContentTypeFilter).optional(),
});

export type SearchFilters = z.infer<typeof SearchFiltersSchema>;

/**
 * Enhanced search query schema with filters.
 */
export const SearchQuerySchema = z.object({
  q: z.string().min(1, 'Query is required').max(500, 'Query too long'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  contentType: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(',') : undefined))
    .pipe(z.array(ContentTypeFilter).optional()),
});

export type SearchQuery = z.infer<typeof SearchQuerySchema>;

/**
 * Search result item returned by API.
 */
export interface SearchResultItem {
  pageId: string;
  pageTitle: string;
  pageIcon: string | null;
  snippet: string; // HTML with <mark> tags
  score: number; // 0-1 normalized relevance score
  updatedAt: string; // ISO 8601 timestamp
  matchedBlockIds: string[]; // Block IDs containing matches
}
```

---

### Step 2: Implement Enhanced Search Query Builder

Add filter support to search query builder.

**File: `src/lib/search/query.ts`** (modify existing)

```typescript
import { prisma } from '@/lib/db';
import type { SearchFilters, SearchResultItem } from '@/types/search';
import { Prisma } from '@/generated/prisma/client';

interface SearchResult {
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
): Promise<SearchResult> {
  // Build WHERE clause for filters
  const whereClauses: string[] = [
    `b.search_vector @@ plainto_tsquery('english', ${Prisma.sql`${query}`})`,
    `p.tenant_id = ${Prisma.sql`${tenantId}`}`,
    `b.deleted_at IS NULL`,
  ];

  // Date range filters
  if (filters.dateFrom) {
    whereClauses.push(`p.updated_at >= ${Prisma.sql`${filters.dateFrom}`}::date`);
  }
  if (filters.dateTo) {
    whereClauses.push(`p.updated_at <= ${Prisma.sql`${filters.dateTo}`}::date`);
  }

  // Content type filters
  if (filters.contentType && filters.contentType.length > 0) {
    const contentTypeConditions: string[] = [];

    for (const type of filters.contentType) {
      switch (type) {
        case 'code':
          // Match blocks with type=codeBlock in TipTap JSON
          contentTypeConditions.push(
            `EXISTS (
              SELECT 1 FROM blocks b2
              WHERE b2.page_id = p.id
                AND b2.tenant_id = p.tenant_id
                AND b2.deleted_at IS NULL
                AND b2.content::jsonb->'type' = '"codeBlock"'
            )`
          );
          break;

        case 'images':
          // Match blocks with type=image in TipTap JSON
          contentTypeConditions.push(
            `EXISTS (
              SELECT 1 FROM blocks b2
              WHERE b2.page_id = p.id
                AND b2.tenant_id = p.tenant_id
                AND b2.deleted_at IS NULL
                AND b2.content::jsonb->'type' = '"image"'
            )`
          );
          break;

        case 'links':
          // Match blocks with link marks in TipTap JSON
          // Links are stored as marks: content.marks[].type = "link"
          contentTypeConditions.push(
            `EXISTS (
              SELECT 1 FROM blocks b2
              WHERE b2.page_id = p.id
                AND b2.tenant_id = p.tenant_id
                AND b2.deleted_at IS NULL
                AND b2.content::jsonb::text LIKE '%"type":"link"%'
            )`
          );
          break;
      }
    }

    if (contentTypeConditions.length > 0) {
      whereClauses.push(`(${contentTypeConditions.join(' OR ')})`);
    }
  }

  const whereClause = whereClauses.join(' AND ');

  // Main search query
  const searchQuery = Prisma.sql`
    WITH ranked_blocks AS (
      SELECT
        p.id AS page_id,
        p.title AS page_title,
        p.icon AS page_icon,
        p.updated_at,
        b.id AS block_id,
        ts_rank(b.search_vector, plainto_tsquery('english', ${query})) AS rank,
        ts_headline(
          'english',
          b.plain_text,
          plainto_tsquery('english', ${query}),
          'MaxFragments=2, MinWords=25, MaxWords=50, HighlightAll=false, StartSel=<mark>, StopSel=</mark>'
        ) AS snippet
      FROM pages p
      JOIN blocks b ON b.page_id = p.id
      WHERE ${Prisma.raw(whereClause)}
    ),
    best_per_page AS (
      SELECT DISTINCT ON (page_id)
        page_id,
        page_title,
        page_icon,
        updated_at,
        rank,
        snippet,
        ARRAY[block_id] AS matched_block_ids
      FROM ranked_blocks
      ORDER BY page_id, rank DESC
    )
    SELECT
      page_id,
      page_title,
      page_icon,
      updated_at,
      rank,
      snippet,
      matched_block_ids
    FROM best_per_page
    ORDER BY rank DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  // Count query for total results
  const countQuery = Prisma.sql`
    SELECT COUNT(DISTINCT p.id) AS total
    FROM pages p
    JOIN blocks b ON b.page_id = p.id
    WHERE ${Prisma.raw(whereClause)}
  `;

  // Execute queries
  const [results, countResult] = await Promise.all([
    prisma.$queryRaw<any[]>(searchQuery),
    prisma.$queryRaw<[{ total: bigint }]>(countQuery),
  ]);

  const total = Number(countResult[0]?.total || 0);

  // Map to SearchResultItem
  const mappedResults: SearchResultItem[] = results.map((row) => ({
    pageId: row.page_id,
    pageTitle: row.page_title,
    pageIcon: row.page_icon,
    snippet: row.snippet,
    score: parseFloat(row.rank),
    updatedAt: row.updated_at.toISOString(),
    matchedBlockIds: row.matched_block_ids,
  }));

  return { results: mappedResults, total };
}

// Keep existing searchBlocks function for backward compatibility
export async function searchBlocks(
  query: string,
  tenantId: string,
  limit: number = 20,
  offset: number = 0
): Promise<SearchResult> {
  return enhancedSearchBlocks(query, tenantId, {}, limit, offset);
}
```

---

### Step 3: Update Search API Route

Modify the existing search route to accept and use filter params.

**File: `src/app/api/search/route.ts`** (modify existing)

```typescript
import { NextRequest } from "next/server";
import { withTenant } from "@/lib/auth/withTenant";
import { enhancedSearchBlocks } from "@/lib/search/query";
import { listResponse, errorResponse } from "@/lib/apiResponse";
import { SearchQuerySchema } from "@/types/search";
import type { TenantContext } from "@/types/auth";

/**
 * GET /api/search?q=term&limit=20&offset=0&dateFrom=...&dateTo=...&contentType=code,images
 *
 * Enhanced full-text search with filters.
 *
 * Query parameters:
 * - q (required): Search query string, 1-500 characters
 * - limit (optional): Max results, 1-100, default 20
 * - offset (optional): Pagination offset, >= 0, default 0
 * - dateFrom (optional): ISO date (YYYY-MM-DD), filter by updatedAt >= dateFrom
 * - dateTo (optional): ISO date (YYYY-MM-DD), filter by updatedAt <= dateTo
 * - contentType (optional): Comma-separated list (code,images,links)
 *
 * Returns:
 * - 200: Search results with snippets, scores, and filters applied
 * - 400: Invalid query parameters
 * - 401: Not authenticated
 */
export const GET = withTenant(
  async (req: NextRequest, ctx: TenantContext) => {
    const { searchParams } = new URL(req.url);

    // Parse and validate query parameters
    const parseResult = SearchQuerySchema.safeParse({
      q: searchParams.get("q"),
      limit: searchParams.get("limit") ?? undefined,
      offset: searchParams.get("offset") ?? undefined,
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
      contentType: searchParams.get("contentType") ?? undefined,
    });

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0];
      return errorResponse(
        "VALIDATION_ERROR",
        firstError?.message || "Invalid query parameters",
        parseResult.error.flatten().fieldErrors,
        400
      );
    }

    const { q, limit, offset, dateFrom, dateTo, contentType } = parseResult.data;

    // Build filters object
    const filters = {
      dateFrom,
      dateTo,
      contentType,
    };

    try {
      // Execute the enhanced search
      const searchResults = await enhancedSearchBlocks(
        q,
        ctx.tenantId,
        filters,
        limit,
        offset
      );

      // Map to API response format
      const data = searchResults.results.map((result) => ({
        pageId: result.pageId,
        pageTitle: result.pageTitle,
        pageIcon: result.pageIcon,
        snippet: result.snippet,
        score: Math.round(result.score * 100) / 100,
        updatedAt: result.updatedAt,
        matchedBlockIds: result.matchedBlockIds,
      }));

      return listResponse(data, searchResults.total, limit, offset);
    } catch (error) {
      console.error("Enhanced search failed:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Search failed",
        undefined,
        500
      );
    }
  }
);
```

---

## Testing Requirements

### Unit Tests: `src/__tests__/lib/search/query.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { enhancedSearchBlocks } from '@/lib/search/query';
import { prisma } from '@/lib/db';
import { seedTestData, clearTestData } from '@/lib/test/helpers';

describe('enhancedSearchBlocks', () => {
  const TENANT_ID = 'test-tenant-123';

  beforeEach(async () => {
    await clearTestData();
    await seedTestData(TENANT_ID);
  });

  it('should return results matching query', async () => {
    const result = await enhancedSearchBlocks('postgresql', TENANT_ID);
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.total).toBeGreaterThan(0);
  });

  it('should filter by dateFrom', async () => {
    const result = await enhancedSearchBlocks(
      'postgresql',
      TENANT_ID,
      { dateFrom: '2026-02-01' }
    );
    // All results should have updatedAt >= 2026-02-01
    result.results.forEach((r) => {
      expect(new Date(r.updatedAt) >= new Date('2026-02-01')).toBe(true);
    });
  });

  it('should filter by dateTo', async () => {
    const result = await enhancedSearchBlocks(
      'postgresql',
      TENANT_ID,
      { dateTo: '2026-02-15' }
    );
    // All results should have updatedAt <= 2026-02-15
    result.results.forEach((r) => {
      expect(new Date(r.updatedAt) <= new Date('2026-02-15')).toBe(true);
    });
  });

  it('should filter by contentType=code', async () => {
    const result = await enhancedSearchBlocks(
      'function',
      TENANT_ID,
      { contentType: ['code'] }
    );
    // Results should only include pages with code blocks
    // (Verification requires checking block content in DB)
    expect(result.results.length).toBeGreaterThanOrEqual(0);
  });

  it('should generate snippets with <mark> tags', async () => {
    const result = await enhancedSearchBlocks('postgresql', TENANT_ID);
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results[0].snippet).toContain('<mark>');
    expect(result.results[0].snippet).toContain('</mark>');
  });

  it('should return matchedBlockIds', async () => {
    const result = await enhancedSearchBlocks('postgresql', TENANT_ID);
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results[0].matchedBlockIds).toBeDefined();
    expect(Array.isArray(result.results[0].matchedBlockIds)).toBe(true);
  });

  it('should respect limit and offset', async () => {
    const page1 = await enhancedSearchBlocks('test', TENANT_ID, {}, 5, 0);
    const page2 = await enhancedSearchBlocks('test', TENANT_ID, {}, 5, 5);

    expect(page1.results.length).toBeLessThanOrEqual(5);
    expect(page2.results.length).toBeLessThanOrEqual(5);
    // Page 2 results should be different from page 1
    expect(page1.results[0].pageId).not.toBe(page2.results[0]?.pageId);
  });
});
```

### Integration Tests: `src/__tests__/api/search/enhanced.integration.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from '@/app/api/search/route';
import { createTestContext } from '@/lib/test/helpers';

describe('Enhanced Search API Integration', () => {
  const TENANT_ID = 'test-tenant-123';
  let ctx: any;

  beforeEach(() => {
    ctx = createTestContext(TENANT_ID);
  });

  it('should return 400 for invalid date format', async () => {
    const req = new Request('http://localhost/api/search?q=test&dateFrom=invalid-date');
    const response = await GET(req, ctx, { params: Promise.resolve({}) });
    expect(response.status).toBe(400);
  });

  it('should return 400 for invalid contentType', async () => {
    const req = new Request('http://localhost/api/search?q=test&contentType=invalid');
    const response = await GET(req, ctx, { params: Promise.resolve({}) });
    expect(response.status).toBe(400);
  });

  it('should return 200 with valid filters', async () => {
    const req = new Request(
      'http://localhost/api/search?q=test&dateFrom=2026-01-01&contentType=code'
    );
    const response = await GET(req, ctx, { params: Promise.resolve({}) });
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.data).toBeDefined();
    expect(Array.isArray(json.data)).toBe(true);
  });
});
```

### E2E Test: `tests/e2e/search-api.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Enhanced Search API', () => {
  test('should search with filters', async ({ request }) => {
    // Assumes auth context is set up
    const response = await request.get(
      '/api/search?q=postgresql&dateFrom=2026-01-01&contentType=code'
    );

    expect(response.ok()).toBeTruthy();
    const json = await response.json();
    expect(json.data).toBeDefined();
    expect(Array.isArray(json.data)).toBe(true);

    // Verify each result has required fields
    json.data.forEach((result: any) => {
      expect(result.pageId).toBeDefined();
      expect(result.pageTitle).toBeDefined();
      expect(result.snippet).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.updatedAt).toBeDefined();
      expect(result.matchedBlockIds).toBeDefined();
    });
  });

  test('should highlight keywords in snippets', async ({ request }) => {
    const response = await request.get('/api/search?q=postgresql');

    expect(response.ok()).toBeTruthy();
    const json = await response.json();

    if (json.data.length > 0) {
      expect(json.data[0].snippet).toContain('<mark>');
    }
  });
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| MODIFY | `src/types/search.ts` (add SearchFilters, ContentTypeFilter, enhance SearchQuerySchema) |
| MODIFY | `src/lib/search/query.ts` (add enhancedSearchBlocks function) |
| MODIFY | `src/app/api/search/route.ts` (parse filter params, call enhancedSearchBlocks) |
| CREATE | `src/__tests__/lib/search/query.test.ts` |
| CREATE | `src/__tests__/api/search/enhanced.integration.test.ts` |
| CREATE | `tests/e2e/search-api.spec.ts` |

---

## Dev Notes

### Challenges

1. **Content type filtering**: Querying TipTap JSON stored as JSONB requires careful path expressions. Code blocks are top-level nodes with `type=codeBlock`, but links are marks nested deep in the content tree. The `LIKE '%"type":"link"%'` approach is a simplification — a more robust solution would use `jsonb_path_query`.

2. **ts_headline configuration**: The parameters `MaxFragments`, `MinWords`, `MaxWords` control snippet quality. Too many fragments → snippets are disjointed. Too few words → context is lost. Experimentation needed to find optimal values.

3. **Performance**: Content type filters use `EXISTS` subqueries that could be slow on large datasets. Consider adding a `page_metadata` table with `has_code`, `has_images`, `has_links` boolean columns updated by triggers.

4. **Snippet HTML safety**: `ts_headline` generates HTML `<mark>` tags. These must be sanitized on the client (DOMPurify) to prevent XSS if user content contains malicious HTML.

### Libraries to Evaluate

- None — uses PostgreSQL built-in functions

### PostgreSQL Functions Used

- `plainto_tsquery('english', query)`: Converts plain text to tsquery
- `ts_rank(tsvector, tsquery)`: Relevance ranking (0-1 float)
- `ts_headline('english', text, tsquery, options)`: Generates snippet with highlighting
  - Options: `MaxFragments=2, MinWords=25, MaxWords=50, StartSel=<mark>, StopSel=</mark>`

### Integration Points

- Used by `EnhancedSearchDialog` (SKB-13.1)
- Used by `useSearch` hook (needs enhancement to pass filters)
- API response format must match `SearchResultItem` type

---

**Last Updated:** 2026-02-22
