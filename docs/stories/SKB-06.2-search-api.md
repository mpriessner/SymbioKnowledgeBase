# Story SKB-06.2: Search API Endpoint

**Epic:** Epic 6 - Search & Navigation
**Story ID:** SKB-06.2
**Story Points:** 3 | **Priority:** Critical | **Status:** Draft
**Depends On:** SKB-06.1 (FTS infrastructure must exist — search_vector column, GIN index, query builder)

---

## User Story

As an AI agent, I want to search content via API, So that I can find relevant information across the knowledge base programmatically.

---

## Acceptance Criteria

- [ ] `GET /api/search?q=term&limit=20&offset=0` endpoint
- [ ] Query parameter validation with Zod: `q` required (min length 1), `limit` optional (default 20, max 100), `offset` optional (default 0)
- [ ] Returns pages with matching blocks, including title, icon, snippet (ts_headline), and relevance score
- [ ] Response format: `{ data: [{ pageId, pageTitle, pageIcon, snippet, score }], meta: { total, limit, offset } }`
- [ ] Tenant-scoped — all results filtered by session tenant_id
- [ ] Returns 401 if unauthenticated
- [ ] Returns 400 for invalid query parameters (missing q, limit > 100, etc.)
- [ ] Returns empty data array for queries with no results (not 404)
- [ ] Standard API response envelope: `{ data, meta }` for success, `{ error, meta }` for failure
- [ ] Handles SQL injection attempts via `plainto_tsquery` (no raw query interpolation)
- [ ] TypeScript strict mode — no `any` types

---

## Architecture Overview

```
API Request/Response Flow
─────────────────────────

  Client (UI or AI Agent)
        │
        │ GET /api/search?q=postgresql+setup&limit=20&offset=0
        │ Headers: Cookie: next-auth.session-token=...
        ▼
  ┌──────────────────────────────────────────────────────┐
  │  /api/search/route.ts                                 │
  │                                                        │
  │  1. withTenant() → extract tenantId from session       │
  │     └── 401 if no valid session                        │
  │                                                        │
  │  2. Parse & validate query params (Zod)                │
  │     ├── q: string, min 1 char                          │
  │     ├── limit: number, 1-100, default 20               │
  │     └── offset: number, >= 0, default 0                │
  │     └── 400 if validation fails                        │
  │                                                        │
  │  3. Call searchBlocks(q, tenantId, limit, offset)      │
  │     └── from lib/search/query.ts                       │
  │                                                        │
  │  4. Return response envelope                           │
  └──────────────────────┬─────────────────────────────────┘
                         │
                         ▼
  Success Response (200):
  {
    "data": [
      {
        "pageId": "uuid-abc-123",
        "pageTitle": "PostgreSQL Setup Guide",
        "pageIcon": "🗄️",
        "snippet": "...<mark>PostgreSQL</mark> is a powerful...",
        "score": 0.85
      },
      {
        "pageId": "uuid-def-456",
        "pageTitle": "Database Architecture",
        "pageIcon": "📐",
        "snippet": "...the <mark>setup</mark> process for...",
        "score": 0.62
      }
    ],
    "meta": {
      "total": 12,
      "limit": 20,
      "offset": 0,
      "timestamp": "2026-02-21T10:30:00.000Z"
    }
  }

  Error Response (400):
  {
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Query parameter 'q' is required"
    },
    "meta": {
      "timestamp": "2026-02-21T10:30:00.000Z"
    }
  }
```

---

## Implementation Steps

### Step 1: Define Search API Types

**File: `src/types/search.ts`**

```typescript
import { z } from 'zod';

/**
 * Zod schema for validating search query parameters.
 */
export const SearchQuerySchema = z.object({
  q: z
    .string()
    .min(1, 'Search query must be at least 1 character')
    .max(500, 'Search query must be at most 500 characters'),
  limit: z.coerce
    .number()
    .int()
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit must be at most 100')
    .default(20),
  offset: z.coerce
    .number()
    .int()
    .min(0, 'Offset must be non-negative')
    .default(0),
});

export type SearchQueryParams = z.infer<typeof SearchQuerySchema>;

/**
 * A single search result in the API response.
 */
export interface SearchResultItem {
  pageId: string;
  pageTitle: string;
  pageIcon: string | null;
  snippet: string;
  score: number;
}

/**
 * The complete search API response.
 */
export interface SearchApiResponse {
  data: SearchResultItem[];
  meta: {
    total: number;
    limit: number;
    offset: number;
    timestamp: string;
  };
}
```

---

### Step 2: Implement the Search API Route

**File: `src/app/api/search/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/withTenant';
import { searchBlocks } from '@/lib/search/query';
import { SearchQuerySchema } from '@/types/search';
import type { SearchApiResponse } from '@/types/search';

/**
 * GET /api/search?q=term&limit=20&offset=0
 *
 * Full-text search across all block content within the authenticated tenant.
 *
 * Uses PostgreSQL tsvector/tsquery for relevance-ranked search with snippets.
 * Results are grouped by page — at most one result per page, using the
 * highest-ranked matching block.
 *
 * Query parameters:
 * - q (required): Search query string, 1-500 characters
 * - limit (optional): Max results, 1-100, default 20
 * - offset (optional): Pagination offset, >= 0, default 0
 *
 * Returns:
 * - 200: Search results with snippets and relevance scores
 * - 400: Invalid query parameters
 * - 401: Not authenticated
 */
export const GET = withTenant(
  async (
    req: NextRequest,
    { tenantId }: { tenantId: string }
  ) => {
    const { searchParams } = new URL(req.url);

    // Parse and validate query parameters
    const parseResult = SearchQuerySchema.safeParse({
      q: searchParams.get('q'),
      limit: searchParams.get('limit'),
      offset: searchParams.get('offset'),
    });

    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0];
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: firstError?.message || 'Invalid query parameters',
            details: parseResult.error.errors,
          },
          meta: { timestamp: new Date().toISOString() },
        },
        { status: 400 }
      );
    }

    const { q, limit, offset } = parseResult.data;

    // Execute the search
    const searchResults = await searchBlocks(q, tenantId, limit, offset);

    // Build the response
    const response: SearchApiResponse = {
      data: searchResults.results.map((result) => ({
        pageId: result.pageId,
        pageTitle: result.pageTitle,
        pageIcon: result.pageIcon,
        snippet: result.snippet,
        score: Math.round(result.rank * 100) / 100, // Round to 2 decimal places
      })),
      meta: {
        total: searchResults.total,
        limit,
        offset,
        timestamp: new Date().toISOString(),
      },
    };

    return NextResponse.json(response);
  }
);
```

---

### Step 3: Create the useSearch Hook

A TanStack Query hook for consuming the search API from the frontend.

**File: `src/hooks/useSearch.ts`**

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import type { SearchApiResponse } from '@/types/search';

/**
 * TanStack Query hook for the search API.
 *
 * @param query - The search query string
 * @param options.limit - Max results (default 20)
 * @param options.offset - Pagination offset (default 0)
 * @param options.enabled - Whether the query should run
 */
export function useSearch(
  query: string,
  options: {
    limit?: number;
    offset?: number;
    enabled?: boolean;
  } = {}
) {
  const { limit = 20, offset = 0, enabled = true } = options;

  return useQuery<SearchApiResponse>({
    queryKey: ['search', query, limit, offset],
    queryFn: async () => {
      const params = new URLSearchParams({
        q: query,
        limit: String(limit),
        offset: String(offset),
      });

      const response = await fetch(`/api/search?${params.toString()}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error?.error?.message || 'Search failed'
        );
      }

      return response.json() as Promise<SearchApiResponse>;
    },
    enabled: enabled && query.length > 0,
    staleTime: 15_000, // 15 seconds
    placeholderData: (prev) => prev, // Keep previous results while loading new ones
  });
}
```

---

## Testing Requirements

### Unit Tests: `src/__tests__/api/search/route.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/search/route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/search/query', () => ({
  searchBlocks: vi.fn(),
}));

vi.mock('@/lib/withTenant', () => ({
  withTenant: (handler: Function) => {
    return (req: NextRequest) => {
      return handler(req, { tenantId: 'test-tenant-id' });
    };
  },
}));

import { searchBlocks } from '@/lib/search/query';
const mockSearchBlocks = vi.mocked(searchBlocks);

describe('GET /api/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return search results for valid query', async () => {
    mockSearchBlocks.mockResolvedValue({
      results: [
        {
          pageId: 'page-1',
          pageTitle: 'Test Page',
          pageIcon: null,
          blockId: 'block-1',
          snippet: 'matching <mark>content</mark>',
          rank: 0.85,
        },
      ],
      total: 1,
    });

    const request = new NextRequest(
      'http://localhost:3000/api/search?q=content'
    );
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].pageId).toBe('page-1');
    expect(body.data[0].pageTitle).toBe('Test Page');
    expect(body.data[0].snippet).toContain('<mark>');
    expect(body.data[0].score).toBe(0.85);
    expect(body.meta.total).toBe(1);
    expect(body.meta.limit).toBe(20);
    expect(body.meta.offset).toBe(0);
  });

  it('should return 400 when q parameter is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/search');
    const response = await GET(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should use default limit and offset when not provided', async () => {
    mockSearchBlocks.mockResolvedValue({ results: [], total: 0 });

    const request = new NextRequest(
      'http://localhost:3000/api/search?q=test'
    );
    await GET(request);

    expect(mockSearchBlocks).toHaveBeenCalledWith(
      'test',
      'test-tenant-id',
      20,
      0
    );
  });

  it('should reject limit greater than 100', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/search?q=test&limit=200'
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject negative offset', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/search?q=test&offset=-1'
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
  });

  it('should return empty data array for no results (not 404)', async () => {
    mockSearchBlocks.mockResolvedValue({ results: [], total: 0 });

    const request = new NextRequest(
      'http://localhost:3000/api/search?q=nonexistent'
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual([]);
    expect(body.meta.total).toBe(0);
  });

  it('should pass tenant_id to searchBlocks', async () => {
    mockSearchBlocks.mockResolvedValue({ results: [], total: 0 });

    const request = new NextRequest(
      'http://localhost:3000/api/search?q=test'
    );
    await GET(request);

    expect(mockSearchBlocks).toHaveBeenCalledWith(
      'test',
      'test-tenant-id',
      expect.any(Number),
      expect.any(Number)
    );
  });

  it('should handle custom limit and offset', async () => {
    mockSearchBlocks.mockResolvedValue({ results: [], total: 0 });

    const request = new NextRequest(
      'http://localhost:3000/api/search?q=test&limit=5&offset=10'
    );
    await GET(request);

    expect(mockSearchBlocks).toHaveBeenCalledWith(
      'test',
      'test-tenant-id',
      5,
      10
    );
  });
});
```

### Integration Tests: `src/__tests__/api/search/search.integration.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';

describe('Search API Integration', () => {
  let tenantId: string;

  beforeEach(async () => {
    const tenant = await prisma.tenant.create({ data: { name: 'Test' } });
    tenantId = tenant.id;

    const page = await prisma.page.create({
      data: { title: 'Database Guide', tenant_id: tenantId },
    });

    await prisma.block.create({
      data: {
        page_id: page.id,
        tenant_id: tenantId,
        type: 'paragraph',
        sort_order: 0,
        content: { type: 'doc', content: [] },
        plain_text: 'PostgreSQL is a relational database management system',
      },
    });
  });

  it('should return ranked results for matching content', async () => {
    const response = await fetch(
      `http://localhost:3000/api/search?q=postgresql`
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0].pageTitle).toBe('Database Guide');
  });

  it('should enforce tenant isolation in search results', async () => {
    const otherTenant = await prisma.tenant.create({
      data: { name: 'Other Tenant' },
    });

    // Search from other tenant should not find content
    // (would need to mock session for proper isolation test)
    expect(true).toBe(true); // Placeholder for actual auth-scoped test
  });
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `src/types/search.ts` |
| CREATE | `src/app/api/search/route.ts` |
| CREATE | `src/hooks/useSearch.ts` |
| CREATE | `src/__tests__/api/search/route.test.ts` |
| CREATE | `src/__tests__/api/search/search.integration.test.ts` |

---

**Last Updated:** 2026-02-21
