# Story SKB-15.1: REST Agent API Endpoints

**Epic:** Epic 15 - Agent API & MCP Server
**Story ID:** SKB-15.1
**Story Points:** 8 | **Priority:** High | **Status:** Planned
**Depends On:** EPIC-14 (Markdown Conversion utilities)

---

## User Story

As an AI agent developer, I want REST API endpoints that accept and return markdown, So that my agent can create, read, update, and search knowledge base pages without understanding TipTap's JSON structure.

---

## Acceptance Criteria

- [ ] `GET /api/agent/pages` — list all pages with pagination
  - Query params: `limit`, `offset`, `parent_id`, `search`
  - Returns: `{ data: Page[], meta: { total, limit, offset } }`
  - Each Page: `{ id, title, icon, parent_id, created_at, updated_at }`
- [ ] `GET /api/agent/pages/:id` — read page as markdown
  - Returns: `{ data: { id, title, icon, markdown, created_at, updated_at } }`
  - Markdown generated via `tiptapToMarkdown(block.content)`
  - Wikilinks preserved as `[[Page Title]]`
- [ ] `POST /api/agent/pages` — create page from markdown
  - Body: `{ title, markdown?, parent_id? }`
  - Markdown converted via `markdownToTiptap(markdown)`
  - Returns: `{ data: { id, title, created_at } }` (201 status)
- [ ] `PUT /api/agent/pages/:id` — update page from markdown
  - Body: `{ markdown }`
  - Updates DOCUMENT block content (upsert if doesn't exist)
  - Returns: `{ data: { id, updated_at } }` (200 status)
- [ ] `GET /api/agent/search?q=query` — full-text search, return markdown snippets
  - Query params: `q` (required), `limit`, `offset`
  - Returns: `{ data: SearchResult[], meta: { total, limit, offset } }`
  - SearchResult: `{ page_id, title, icon, snippet, score }`
  - Snippet: markdown excerpt with search term highlighted
- [ ] `GET /api/agent/graph?pageId=X&depth=N` — get knowledge graph
  - Query params: `pageId` (optional), `depth` (optional, default 2)
  - Returns: `{ data: { nodes, edges }, meta: { node_count, edge_count } }`
  - Nodes: `{ id, label, icon, link_count }`
  - Edges: `{ source, target }`
- [ ] All endpoints accept `Authorization: Bearer <token>` header
- [ ] Placeholder auth middleware (validates token format, defers actual validation to SKB-15.3)
- [ ] Standard error responses: `{ error: { code, message, details? }, meta: { timestamp } }`
- [ ] Response time: <200ms for GET, <500ms for POST/PUT
- [ ] TypeScript strict mode — no `any` types

---

## Architecture Overview

```
Agent API Endpoints Architecture
─────────────────────────────────

Request Flow:
┌─────────────────────────────────────────────────────────────────┐
│  1. Agent Request                                                │
│     POST /api/agent/pages                                        │
│     Authorization: Bearer <token>                                │
│     { title: "My Note", markdown: "# Heading\nContent..." }      │
└─────────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Auth Middleware (placeholder for now)                        │
│     - Extract tenant_id from token (mock for SKB-15.1)           │
│     - TODO: Real validation in SKB-15.3                          │
└─────────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. Markdown Conversion                                          │
│     markdownToTiptap(markdown) → TipTapDocument                  │
│     {                                                            │
│       type: 'doc',                                               │
│       content: [                                                 │
│         { type: 'heading', attrs: { level: 1 }, content: [...] }│
│         { type: 'paragraph', content: [...] }                    │
│       ]                                                          │
│     }                                                            │
└─────────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. Database Operations                                          │
│     prisma.page.create({                                         │
│       data: { tenantId, title }                                  │
│     })                                                           │
│     prisma.block.create({                                        │
│       data: { pageId, tenantId, type: 'DOCUMENT', content }      │
│     })                                                           │
└─────────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. Response                                                     │
│     {                                                            │
│       data: { id: "uuid", title: "My Note", created_at: ... },  │
│       meta: { timestamp: "2026-02-22T..." }                      │
│     }                                                            │
└─────────────────────────────────────────────────────────────────┘

Endpoint Implementations:
┌─────────────────────────────────────────────────────────────────┐
│  /api/agent/pages/route.ts                                       │
│    export const GET = withAgentAuth(async (req, ctx) => {       │
│      const pages = await prisma.page.findMany({                 │
│        where: { tenantId: ctx.tenantId },                        │
│        select: { id, title, icon, parent_id, created_at, ... }  │
│      });                                                         │
│      return listResponse(pages, total, limit, offset);          │
│    });                                                           │
│                                                                  │
│    export const POST = withAgentAuth(async (req, ctx) => {      │
│      const { title, markdown, parent_id } = await req.json();   │
│      const page = await prisma.page.create({...});              │
│      if (markdown) {                                             │
│        const tiptap = markdownToTiptap(markdown);                │
│        await prisma.block.create({                               │
│          type: 'DOCUMENT', content: tiptap, pageId: page.id     │
│        });                                                       │
│      }                                                           │
│      return successResponse(page, undefined, 201);              │
│    });                                                           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  /api/agent/pages/[id]/route.ts                                 │
│    export const GET = withAgentAuth(async (req, ctx, params) => {
│      const page = await prisma.page.findFirst({                 │
│        where: { id: params.id, tenantId: ctx.tenantId }         │
│      });                                                         │
│      const block = await prisma.block.findFirst({               │
│        where: { pageId: page.id, type: 'DOCUMENT' }             │
│      });                                                         │
│      const markdown = tiptapToMarkdown(block.content);          │
│      return successResponse({ ...page, markdown });             │
│    });                                                           │
│                                                                  │
│    export const PUT = withAgentAuth(async (req, ctx, params) => {
│      const { markdown } = await req.json();                     │
│      const tiptap = markdownToTiptap(markdown);                 │
│      await prisma.block.upsert({                                 │
│        where: { pageId_type: { pageId, type: 'DOCUMENT' } },    │
│        update: { content: tiptap },                              │
│        create: { pageId, type: 'DOCUMENT', content: tiptap }    │
│      });                                                         │
│      return successResponse({ id, updated_at });                │
│    });                                                           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  /api/agent/search/route.ts                                     │
│    export const GET = withAgentAuth(async (req, ctx) => {       │
│      const { q, limit, offset } = parseQuery(req);              │
│      const results = await fullTextSearch(q, ctx.tenantId);     │
│      const withSnippets = results.map(r => ({                   │
│        ...r,                                                     │
│        snippet: extractMarkdownSnippet(r.plainText, q)          │
│      }));                                                        │
│      return listResponse(withSnippets, total, limit, offset);   │
│    });                                                           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  /api/agent/graph/route.ts                                      │
│    export const GET = withAgentAuth(async (req, ctx) => {       │
│      const { pageId, depth } = parseQuery(req);                 │
│      const graph = await buildGraph(pageId, depth, ctx.tenantId);
│      return successResponse(graph, {                             │
│        node_count: graph.nodes.length,                           │
│        edge_count: graph.edges.length                            │
│      });                                                         │
│    });                                                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Create Placeholder Auth Middleware

**File: `src/lib/agent/auth.ts`**

```typescript
import { NextRequest } from 'next/server';
import { errorResponse } from '@/lib/apiResponse';

export interface AgentContext {
  tenantId: string;
  userId: string;
  apiKeyId?: string;
}

// Placeholder middleware — real implementation in SKB-15.3
export async function withAgentAuth<T>(
  handler: (req: NextRequest, ctx: AgentContext, params?: any) => Promise<T>
) {
  return async (req: NextRequest, params?: any): Promise<T> => {
    const authHeader = req.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(
        'UNAUTHORIZED',
        'Missing or invalid Authorization header',
        undefined,
        401
      ) as T;
    }

    const token = authHeader.substring(7);

    // TODO (SKB-15.3): Validate Supabase JWT or API key
    // For now, mock context with default tenant
    const ctx: AgentContext = {
      tenantId: process.env.DEFAULT_TENANT_ID || 'mock-tenant-id',
      userId: 'mock-user-id',
    };

    return handler(req, ctx, params);
  };
}
```

---

### Step 2: Implement List and Create Pages Endpoints

**File: `src/app/api/agent/pages/route.ts`**

```typescript
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { withAgentAuth, AgentContext } from '@/lib/agent/auth';
import { successResponse, listResponse, errorResponse } from '@/lib/apiResponse';
import { markdownToTiptap } from '@/lib/agent/markdown';
import { z } from 'zod';

// Validation schemas
const listPagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  parent_id: z.string().uuid().optional(),
  search: z.string().optional(),
});

const createPageSchema = z.object({
  title: z.string().min(1).max(255),
  markdown: z.string().optional(),
  parent_id: z.string().uuid().optional(),
  icon: z.string().optional(),
});

// GET /api/agent/pages — List pages
export const GET = withAgentAuth(
  async (req: NextRequest, ctx: AgentContext) => {
    try {
      const { searchParams } = new URL(req.url);
      const queryParams = Object.fromEntries(searchParams.entries());

      const parsed = listPagesQuerySchema.safeParse(queryParams);
      if (!parsed.success) {
        return errorResponse('VALIDATION_ERROR', 'Invalid query parameters',
          parsed.error.flatten().fieldErrors, 400);
      }

      const { limit, offset, parent_id, search } = parsed.data;

      const where: any = { tenantId: ctx.tenantId };
      if (parent_id) where.parentId = parent_id;
      if (search) where.title = { contains: search, mode: 'insensitive' };

      const [pages, total] = await Promise.all([
        prisma.page.findMany({
          where,
          select: {
            id: true,
            title: true,
            icon: true,
            parentId: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: 'desc' },
          skip: offset,
          take: limit,
        }),
        prisma.page.count({ where }),
      ]);

      return listResponse(
        pages.map(p => ({
          id: p.id,
          title: p.title,
          icon: p.icon,
          parent_id: p.parentId,
          created_at: p.createdAt.toISOString(),
          updated_at: p.updatedAt.toISOString(),
        })),
        total,
        limit,
        offset
      );
    } catch (error) {
      console.error('GET /api/agent/pages error:', error);
      return errorResponse('INTERNAL_ERROR', 'Internal server error', undefined, 500);
    }
  }
);

// POST /api/agent/pages — Create page
export const POST = withAgentAuth(
  async (req: NextRequest, ctx: AgentContext) => {
    try {
      const body = await req.json();
      const parsed = createPageSchema.safeParse(body);

      if (!parsed.success) {
        return errorResponse('VALIDATION_ERROR', 'Invalid request body',
          parsed.error.flatten().fieldErrors, 400);
      }

      const { title, markdown, parent_id, icon } = parsed.data;

      // Verify parent exists if provided
      if (parent_id) {
        const parent = await prisma.page.findFirst({
          where: { id: parent_id, tenantId: ctx.tenantId },
        });
        if (!parent) {
          return errorResponse('NOT_FOUND', 'Parent page not found', undefined, 404);
        }
      }

      // Calculate position
      const maxPosition = await prisma.page.aggregate({
        where: { tenantId: ctx.tenantId, parentId: parent_id },
        _max: { position: true },
      });
      const nextPosition = (maxPosition._max.position ?? -1) + 1;

      // Create page
      const page = await prisma.page.create({
        data: {
          tenantId: ctx.tenantId,
          title,
          icon,
          parentId: parent_id,
          position: nextPosition,
        },
      });

      // Create DOCUMENT block if markdown provided
      if (markdown) {
        const tiptap = markdownToTiptap(markdown);
        await prisma.block.create({
          data: {
            tenantId: ctx.tenantId,
            pageId: page.id,
            type: 'DOCUMENT',
            content: tiptap as any,
            position: 0,
          },
        });
      }

      return successResponse(
        {
          id: page.id,
          title: page.title,
          created_at: page.createdAt.toISOString(),
        },
        undefined,
        201
      );
    } catch (error) {
      console.error('POST /api/agent/pages error:', error);
      return errorResponse('INTERNAL_ERROR', 'Internal server error', undefined, 500);
    }
  }
);
```

---

### Step 3: Implement Read and Update Page Endpoints

**File: `src/app/api/agent/pages/[id]/route.ts`**

```typescript
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { withAgentAuth, AgentContext } from '@/lib/agent/auth';
import { successResponse, errorResponse } from '@/lib/apiResponse';
import { tiptapToMarkdown, markdownToTiptap } from '@/lib/agent/markdown';
import { z } from 'zod';

const updatePageSchema = z.object({
  markdown: z.string(),
});

// GET /api/agent/pages/:id — Read page as markdown
export const GET = withAgentAuth(
  async (
    req: NextRequest,
    ctx: AgentContext,
    routeContext: { params: Promise<Record<string, string>> }
  ) => {
    try {
      const { id } = await routeContext.params;

      const page = await prisma.page.findFirst({
        where: { id, tenantId: ctx.tenantId },
      });

      if (!page) {
        return errorResponse('NOT_FOUND', 'Page not found', undefined, 404);
      }

      // Find DOCUMENT block
      const block = await prisma.block.findFirst({
        where: {
          pageId: id,
          tenantId: ctx.tenantId,
          type: 'DOCUMENT',
          deletedAt: null,
        },
      });

      let markdown = '';
      if (block) {
        markdown = tiptapToMarkdown(block.content as any);
      }

      return successResponse({
        id: page.id,
        title: page.title,
        icon: page.icon,
        parent_id: page.parentId,
        markdown,
        created_at: page.createdAt.toISOString(),
        updated_at: page.updatedAt.toISOString(),
      });
    } catch (error) {
      console.error('GET /api/agent/pages/:id error:', error);
      return errorResponse('INTERNAL_ERROR', 'Internal server error', undefined, 500);
    }
  }
);

// PUT /api/agent/pages/:id — Update page markdown
export const PUT = withAgentAuth(
  async (
    req: NextRequest,
    ctx: AgentContext,
    routeContext: { params: Promise<Record<string, string>> }
  ) => {
    try {
      const { id } = await routeContext.params;
      const body = await req.json();
      const parsed = updatePageSchema.safeParse(body);

      if (!parsed.success) {
        return errorResponse('VALIDATION_ERROR', 'Invalid request body',
          parsed.error.flatten().fieldErrors, 400);
      }

      const { markdown } = parsed.data;

      // Verify page exists
      const page = await prisma.page.findFirst({
        where: { id, tenantId: ctx.tenantId },
      });

      if (!page) {
        return errorResponse('NOT_FOUND', 'Page not found', undefined, 404);
      }

      // Convert markdown to TipTap
      const tiptap = markdownToTiptap(markdown);

      // Find existing DOCUMENT block
      const existing = await prisma.block.findFirst({
        where: {
          pageId: id,
          tenantId: ctx.tenantId,
          type: 'DOCUMENT',
          deletedAt: null,
        },
      });

      if (existing) {
        await prisma.block.update({
          where: { id: existing.id },
          data: { content: tiptap as any },
        });
      } else {
        await prisma.block.create({
          data: {
            tenantId: ctx.tenantId,
            pageId: id,
            type: 'DOCUMENT',
            content: tiptap as any,
            position: 0,
          },
        });
      }

      // Trigger updated_at on page
      const updatedPage = await prisma.page.update({
        where: { id },
        data: { updatedAt: new Date() },
      });

      return successResponse({
        id: updatedPage.id,
        updated_at: updatedPage.updatedAt.toISOString(),
      });
    } catch (error) {
      console.error('PUT /api/agent/pages/:id error:', error);
      return errorResponse('INTERNAL_ERROR', 'Internal server error', undefined, 500);
    }
  }
);
```

---

### Step 4: Implement Search Endpoint

**File: `src/app/api/agent/search/route.ts`**

```typescript
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { withAgentAuth, AgentContext } from '@/lib/agent/auth';
import { listResponse, errorResponse } from '@/lib/apiResponse';
import { z } from 'zod';

const searchQuerySchema = z.object({
  q: z.string().min(1).max(500),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// Helper: Extract markdown snippet with context
function extractMarkdownSnippet(plainText: string, query: string): string {
  const lowerText = plainText.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) return plainText.substring(0, 150) + '...';

  const start = Math.max(0, index - 50);
  const end = Math.min(plainText.length, index + query.length + 100);

  let snippet = plainText.substring(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < plainText.length) snippet = snippet + '...';

  return snippet;
}

// GET /api/agent/search — Full-text search
export const GET = withAgentAuth(
  async (req: NextRequest, ctx: AgentContext) => {
    try {
      const { searchParams } = new URL(req.url);
      const queryParams = Object.fromEntries(searchParams.entries());

      const parsed = searchQuerySchema.safeParse(queryParams);
      if (!parsed.success) {
        return errorResponse('VALIDATION_ERROR', 'Invalid query parameters',
          parsed.error.flatten().fieldErrors, 400);
      }

      const { q, limit, offset } = parsed.data;

      // Full-text search using PostgreSQL ts_vector
      const results = await prisma.$queryRaw<any[]>`
        SELECT
          b.page_id,
          p.title,
          p.icon,
          b.plain_text,
          ts_rank(b.search_vector, websearch_to_tsquery('english', ${q})) as score
        FROM blocks b
        JOIN pages p ON p.id = b.page_id
        WHERE b.tenant_id = ${ctx.tenantId}
          AND b.deleted_at IS NULL
          AND b.search_vector @@ websearch_to_tsquery('english', ${q})
        ORDER BY score DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      const total = await prisma.$queryRaw<any[]>`
        SELECT COUNT(DISTINCT b.page_id)::int as count
        FROM blocks b
        WHERE b.tenant_id = ${ctx.tenantId}
          AND b.deleted_at IS NULL
          AND b.search_vector @@ websearch_to_tsquery('english', ${q})
      `;

      const formatted = results.map(r => ({
        page_id: r.page_id,
        title: r.title,
        icon: r.icon,
        snippet: extractMarkdownSnippet(r.plain_text, q),
        score: parseFloat(r.score),
      }));

      return listResponse(formatted, total[0]?.count ?? 0, limit, offset);
    } catch (error) {
      console.error('GET /api/agent/search error:', error);
      return errorResponse('INTERNAL_ERROR', 'Internal server error', undefined, 500);
    }
  }
);
```

---

### Step 5: Implement Graph Endpoint

**File: `src/app/api/agent/graph/route.ts`**

```typescript
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { withAgentAuth, AgentContext } from '@/lib/agent/auth';
import { successResponse, errorResponse } from '@/lib/apiResponse';
import { z } from 'zod';

const graphQuerySchema = z.object({
  pageId: z.string().uuid().optional(),
  depth: z.coerce.number().int().min(1).max(5).default(2),
});

// GET /api/agent/graph — Knowledge graph
export const GET = withAgentAuth(
  async (req: NextRequest, ctx: AgentContext) => {
    try {
      const { searchParams } = new URL(req.url);
      const queryParams = Object.fromEntries(searchParams.entries());

      const parsed = graphQuerySchema.safeParse(queryParams);
      if (!parsed.success) {
        return errorResponse('VALIDATION_ERROR', 'Invalid query parameters',
          parsed.error.flatten().fieldErrors, 400);
      }

      const { pageId, depth } = parsed.data;

      let pageIds: string[];

      if (pageId) {
        // Local graph: BFS expansion from pageId
        pageIds = await expandGraphBFS(pageId, depth, ctx.tenantId);
      } else {
        // Global graph: all pages
        const pages = await prisma.page.findMany({
          where: { tenantId: ctx.tenantId },
          select: { id: true },
        });
        pageIds = pages.map(p => p.id);
      }

      // Fetch nodes
      const nodes = await prisma.page.findMany({
        where: { id: { in: pageIds }, tenantId: ctx.tenantId },
        select: { id: true, title: true, icon: true, updatedAt: true },
      });

      // Fetch edges (wikilinks)
      const edges = await prisma.pageLink.findMany({
        where: {
          tenantId: ctx.tenantId,
          sourcePageId: { in: pageIds },
          targetPageId: { in: pageIds },
        },
        select: { sourcePageId: true, targetPageId: true },
      });

      // Calculate link counts
      const linkCounts = new Map<string, number>();
      edges.forEach(e => {
        linkCounts.set(e.sourcePageId, (linkCounts.get(e.sourcePageId) ?? 0) + 1);
        linkCounts.set(e.targetPageId, (linkCounts.get(e.targetPageId) ?? 0) + 1);
      });

      const formattedNodes = nodes.map(n => ({
        id: n.id,
        label: n.title,
        icon: n.icon,
        link_count: linkCounts.get(n.id) ?? 0,
      }));

      const formattedEdges = edges.map(e => ({
        source: e.sourcePageId,
        target: e.targetPageId,
      }));

      return successResponse(
        { nodes: formattedNodes, edges: formattedEdges },
        { node_count: formattedNodes.length, edge_count: formattedEdges.length }
      );
    } catch (error) {
      console.error('GET /api/agent/graph error:', error);
      return errorResponse('INTERNAL_ERROR', 'Internal server error', undefined, 500);
    }
  }
);

// BFS expansion helper
async function expandGraphBFS(
  startPageId: string,
  depth: number,
  tenantId: string
): Promise<string[]> {
  const visited = new Set<string>([startPageId]);
  let currentLayer = [startPageId];

  for (let i = 0; i < depth; i++) {
    const links = await prisma.pageLink.findMany({
      where: {
        tenantId,
        OR: [
          { sourcePageId: { in: currentLayer } },
          { targetPageId: { in: currentLayer } },
        ],
      },
      select: { sourcePageId: true, targetPageId: true },
    });

    const nextLayer = new Set<string>();
    links.forEach(link => {
      if (!visited.has(link.sourcePageId)) {
        visited.add(link.sourcePageId);
        nextLayer.add(link.sourcePageId);
      }
      if (!visited.has(link.targetPageId)) {
        visited.add(link.targetPageId);
        nextLayer.add(link.targetPageId);
      }
    });

    currentLayer = Array.from(nextLayer);
    if (currentLayer.length === 0) break;
  }

  return Array.from(visited);
}
```

---

### Step 6: Create Markdown Conversion Utilities

**File: `src/lib/agent/markdown.ts`**

```typescript
import type { TipTapDocument } from '@/lib/wikilinks/types';

/**
 * Convert TipTap JSON document to Markdown
 * This is a placeholder — full implementation in EPIC-14
 */
export function tiptapToMarkdown(doc: TipTapDocument): string {
  // TODO (EPIC-14): Implement full conversion
  // For now, return placeholder
  return '# TODO: Implement tiptapToMarkdown\n\nThis requires EPIC-14.';
}

/**
 * Convert Markdown to TipTap JSON document
 * This is a placeholder — full implementation in EPIC-14
 */
export function markdownToTiptap(markdown: string): TipTapDocument {
  // TODO (EPIC-14): Implement full conversion
  // For now, return basic document
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'TODO: Implement markdownToTiptap. This requires EPIC-14.' },
        ],
      },
    ],
  };
}
```

---

## Testing Requirements

### Unit Tests

**File: `src/__tests__/lib/agent/markdown.test.ts`**

```typescript
import { tiptapToMarkdown, markdownToTiptap } from '@/lib/agent/markdown';

describe('Markdown conversion', () => {
  it('should convert heading to markdown', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
      ],
    };
    expect(tiptapToMarkdown(doc)).toBe('# Title\n\n');
  });

  it('should convert markdown heading to TipTap', () => {
    const markdown = '# Title\n\nContent';
    const doc = markdownToTiptap(markdown);
    expect(doc.content[0].type).toBe('heading');
    expect(doc.content[0].attrs.level).toBe(1);
  });

  it('should preserve wikilinks', () => {
    const markdown = 'Link to [[Other Page]]';
    const doc = markdownToTiptap(markdown);
    const backToMd = tiptapToMarkdown(doc);
    expect(backToMd).toContain('[[Other Page]]');
  });
});
```

---

### Integration Tests

**File: `src/__tests__/api/agent/pages/route.test.ts`**

```typescript
import { GET, POST } from '@/app/api/agent/pages/route';
import { prisma } from '@/lib/db';

describe('GET /api/agent/pages', () => {
  it('should list pages for tenant', async () => {
    const req = new Request('http://localhost/api/agent/pages?limit=10', {
      headers: { Authorization: 'Bearer mock-token' },
    });
    const response = await GET(req, {} as any);
    const json = await response.json();

    expect(json.data).toBeInstanceOf(Array);
    expect(json.meta.total).toBeGreaterThanOrEqual(0);
  });

  it('should filter by parent_id', async () => {
    const req = new Request('http://localhost/api/agent/pages?parent_id=root-page-id', {
      headers: { Authorization: 'Bearer mock-token' },
    });
    const response = await GET(req, {} as any);
    const json = await response.json();

    json.data.forEach((page: any) => {
      expect(page.parent_id).toBe('root-page-id');
    });
  });
});

describe('POST /api/agent/pages', () => {
  it('should create page with markdown', async () => {
    const req = new Request('http://localhost/api/agent/pages', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer mock-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Test Page',
        markdown: '# Heading\n\nContent'
      }),
    });

    const response = await POST(req, {} as any);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.data.id).toBeDefined();
    expect(json.data.title).toBe('Test Page');
  });
});
```

---

### E2E Tests

**Manual test script:**

```bash
# 1. Create page via Agent API
curl -X POST http://localhost:3000/api/agent/pages \
  -H "Authorization: Bearer mock-token" \
  -H "Content-Type: application/json" \
  -d '{"title":"Agent Created Page","markdown":"# Hello\n\nThis is [[Linked Page]]"}'

# Expected: 201 Created with page ID

# 2. Read page back as markdown
curl http://localhost:3000/api/agent/pages/{PAGE_ID} \
  -H "Authorization: Bearer mock-token"

# Expected: markdown field contains "# Hello\n\nThis is [[Linked Page]]"

# 3. Update page markdown
curl -X PUT http://localhost:3000/api/agent/pages/{PAGE_ID} \
  -H "Authorization: Bearer mock-token" \
  -H "Content-Type: application/json" \
  -d '{"markdown":"# Updated\n\nNew content"}'

# Expected: 200 OK with updated_at timestamp

# 4. Search pages
curl "http://localhost:3000/api/agent/search?q=Hello&limit=5" \
  -H "Authorization: Bearer mock-token"

# Expected: Search results with snippets containing "Hello"

# 5. Get graph
curl "http://localhost:3000/api/agent/graph?depth=2" \
  -H "Authorization: Bearer mock-token"

# Expected: nodes and edges arrays
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `src/lib/agent/auth.ts` |
| CREATE | `src/app/api/agent/pages/route.ts` |
| CREATE | `src/app/api/agent/pages/[id]/route.ts` |
| CREATE | `src/app/api/agent/search/route.ts` |
| CREATE | `src/app/api/agent/graph/route.ts` |
| CREATE | `src/lib/agent/markdown.ts` (placeholder) |
| CREATE | `src/__tests__/api/agent/pages/route.test.ts` |
| CREATE | `src/__tests__/lib/agent/markdown.test.ts` |

---

## Dev Notes

### Performance Optimizations
- **Caching:** Consider caching graph data in Redis (TTL 5 minutes)
- **Pagination:** Enforce max limit of 100 items per request
- **Indexes:** Ensure `blocks.search_vector` GIN index exists for fast full-text search

### Error Handling
- Return 404 if page not found (not 500)
- Return 400 for validation errors with field-level details
- Return 401 for missing/invalid auth token
- Log all errors to console for debugging

### Security Considerations
- Auth middleware must extract tenant_id from token (not trust client input)
- All queries must filter by tenant_id
- Sanitize markdown input to prevent XSS (but don't strip wikilinks)

### Future Enhancements (Post-MVP)
- Batch operations: `POST /api/agent/pages/batch` to create multiple pages
- Partial updates: `PATCH /api/agent/pages/:id` to update title/icon without markdown
- Export endpoint: `GET /api/agent/pages/:id/export` to download as .md file

---

**Last Updated:** 2026-02-22
