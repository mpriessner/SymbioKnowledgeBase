# Story SKB-07.1: Graph Data API Endpoint

**Epic:** Epic 7 - Knowledge Graph Visualization
**Story ID:** SKB-07.1
**Story Points:** 3 | **Priority:** Critical | **Status:** Draft
**Depends On:** SKB-05.1 (page_links table must be populated by wikilink resolution)

---

## User Story

As an AI agent, I want to retrieve knowledge graph data, So that I can analyze the relationship structure of the knowledge base.

---

## Acceptance Criteria

- [ ] `GET /api/graph` returns `{ data: { nodes, edges }, meta: { nodeCount, edgeCount } }`
- [ ] Nodes: `[{ id, label, icon, linkCount, updatedAt }]` — built from `pages` table
- [ ] Edges: `[{ source, target }]` — built from `page_links` table
- [ ] All queries tenant-scoped via `withTenant()` wrapper
- [ ] Optional `?pageId=X` param for local graph mode (N-hop BFS from specified page)
- [ ] Optional `?depth=N` param (1-5, default 2) for BFS expansion depth
- [ ] `lib/graph/builder.ts`: `buildGraphData(tenantId, pageId?, depth?)` function
- [ ] BFS expansion correctly discovers N-degree connections
- [ ] `linkCount` on each node represents total incoming + outgoing links
- [ ] Orphan pages (no links) included in global graph, excluded from local graph
- [ ] Zod validation on query parameters
- [ ] Returns 404 if specified `pageId` not found
- [ ] TypeScript strict mode — no `any` types

---

## Architecture Overview

```
Global Graph: GET /api/graph
─────────────────────────────

  All pages + all page_links for tenant
  ┌──────────────────────────────────────────────────────┐
  │  nodes: [                                             │
  │    { id: 'uuid-1', label: 'Page A', icon: '📄',     │
  │      linkCount: 5, updatedAt: '2026-02-20' },        │
  │    { id: 'uuid-2', label: 'Page B', icon: '📐',     │
  │      linkCount: 3, updatedAt: '2026-02-19' },        │
  │    ...                                                │
  │  ],                                                   │
  │  edges: [                                             │
  │    { source: 'uuid-1', target: 'uuid-2' },           │
  │    { source: 'uuid-2', target: 'uuid-3' },           │
  │    ...                                                │
  │  ]                                                    │
  └──────────────────────────────────────────────────────┘

Local Graph: GET /api/graph?pageId=uuid-1&depth=2
──────────────────────────────────────────────────

  BFS from uuid-1, depth=2
  ┌──────────────────────────────────────────────────────┐
  │                                                        │
  │  Step 1: Start at uuid-1 (depth 0)                    │
  │  Step 2: Find all pages linked to/from uuid-1 (depth 1)│
  │  Step 3: Find all pages linked to/from depth-1 (depth 2)│
  │                                                        │
  │  Only include edges BETWEEN discovered nodes            │
  │                                                        │
  │           [Page C]                                     │
  │              ↑                                         │
  │  [Page B] ← [Page A] → [Page D]                       │
  │              ↓                                         │
  │           [Page E] → [Page F]                          │
  │                                                        │
  │  depth=1: A, B, C, D, E (direct connections)           │
  │  depth=2: A, B, C, D, E, F (F is 2 hops from A)       │
  └──────────────────────────────────────────────────────┘

API Layer
─────────

  ┌────────────────────────────────┐
  │  GET /api/graph                │
  │  GET /api/graph?pageId=X       │
  │  GET /api/graph?pageId=X&depth=2│
  └────────────┬───────────────────┘
               │
               ▼
  ┌────────────────────────────────┐
  │  lib/graph/builder.ts          │
  │  buildGraphData(               │
  │    tenantId,                   │
  │    pageId?,                    │
  │    depth?                      │
  │  )                             │
  └────────────┬───────────────────┘
               │
               ▼
  ┌────────────────────────────────┐
  │  PostgreSQL                    │
  │                                │
  │  pages table → nodes           │
  │  page_links table → edges      │
  │                                │
  │  BFS: recursive CTE or         │
  │  application-level loop        │
  └────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Define Graph Types

**File: `src/types/graph.ts`**

```typescript
import { z } from 'zod';

/**
 * A node in the knowledge graph (represents a page).
 */
export interface GraphNode {
  id: string;
  label: string;
  icon: string | null;
  linkCount: number;
  updatedAt: string;
}

/**
 * An edge in the knowledge graph (represents a wikilink).
 */
export interface GraphEdge {
  source: string;
  target: string;
}

/**
 * The complete graph data structure returned by the API.
 */
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * API response for the graph endpoint.
 */
export interface GraphApiResponse {
  data: GraphData;
  meta: {
    nodeCount: number;
    edgeCount: number;
    timestamp: string;
  };
}

/**
 * Zod schema for validating graph API query parameters.
 */
export const GraphQuerySchema = z.object({
  pageId: z.string().uuid().optional(),
  depth: z.coerce
    .number()
    .int()
    .min(1, 'Depth must be at least 1')
    .max(5, 'Depth must be at most 5')
    .default(2),
});

export type GraphQueryParams = z.infer<typeof GraphQuerySchema>;
```

---

### Step 2: Implement the Graph Data Builder

**File: `src/lib/graph/builder.ts`**

```typescript
import { prisma } from '@/lib/db';
import type { GraphData, GraphNode, GraphEdge } from '@/types/graph';

/**
 * Builds graph data for the knowledge graph visualization.
 *
 * Two modes:
 * 1. Global graph (no pageId): returns ALL pages and links for the tenant
 * 2. Local graph (with pageId + depth): returns N-hop BFS expansion from the specified page
 *
 * @param tenantId - Tenant UUID for scoping
 * @param pageId - Optional: center page for local graph mode
 * @param depth - BFS expansion depth (1-5, default 2). Only used with pageId.
 * @returns Graph data with nodes and edges
 */
export async function buildGraphData(
  tenantId: string,
  pageId?: string,
  depth: number = 2
): Promise<GraphData> {
  if (pageId) {
    return buildLocalGraph(tenantId, pageId, depth);
  }
  return buildGlobalGraph(tenantId);
}

/**
 * Builds the global graph: all pages and all links for the tenant.
 */
async function buildGlobalGraph(tenantId: string): Promise<GraphData> {
  // Fetch all pages
  const pages = await prisma.page.findMany({
    where: { tenant_id: tenantId },
    select: {
      id: true,
      title: true,
      icon: true,
      updated_at: true,
    },
  });

  // Fetch all links
  const links = await prisma.pageLink.findMany({
    where: { tenant_id: tenantId },
    select: {
      source_page_id: true,
      target_page_id: true,
    },
  });

  // Compute link counts per page (incoming + outgoing)
  const linkCounts = new Map<string, number>();
  for (const link of links) {
    linkCounts.set(
      link.source_page_id,
      (linkCounts.get(link.source_page_id) || 0) + 1
    );
    linkCounts.set(
      link.target_page_id,
      (linkCounts.get(link.target_page_id) || 0) + 1
    );
  }

  // Build nodes
  const nodes: GraphNode[] = pages.map((page) => ({
    id: page.id,
    label: page.title,
    icon: page.icon,
    linkCount: linkCounts.get(page.id) || 0,
    updatedAt: page.updated_at.toISOString(),
  }));

  // Build edges (only include edges where both source and target exist)
  const pageIds = new Set(pages.map((p) => p.id));
  const edges: GraphEdge[] = links
    .filter(
      (link) =>
        pageIds.has(link.source_page_id) && pageIds.has(link.target_page_id)
    )
    .map((link) => ({
      source: link.source_page_id,
      target: link.target_page_id,
    }));

  return { nodes, edges };
}

/**
 * Builds a local graph: N-hop BFS expansion from the specified page.
 *
 * Uses breadth-first search to discover pages within `depth` hops
 * of the center page. Only returns edges between discovered pages.
 */
async function buildLocalGraph(
  tenantId: string,
  centerPageId: string,
  depth: number
): Promise<GraphData> {
  // Fetch all links for the tenant (for BFS traversal)
  const allLinks = await prisma.pageLink.findMany({
    where: { tenant_id: tenantId },
    select: {
      source_page_id: true,
      target_page_id: true,
    },
  });

  // Build adjacency list (bidirectional for BFS)
  const adjacency = new Map<string, Set<string>>();
  for (const link of allLinks) {
    if (!adjacency.has(link.source_page_id)) {
      adjacency.set(link.source_page_id, new Set());
    }
    if (!adjacency.has(link.target_page_id)) {
      adjacency.set(link.target_page_id, new Set());
    }
    adjacency.get(link.source_page_id)!.add(link.target_page_id);
    adjacency.get(link.target_page_id)!.add(link.source_page_id);
  }

  // BFS from center page
  const discoveredPageIds = new Set<string>([centerPageId]);
  let frontier = [centerPageId];

  for (let d = 0; d < depth; d++) {
    const nextFrontier: string[] = [];

    for (const pageId of frontier) {
      const neighbors = adjacency.get(pageId);
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!discoveredPageIds.has(neighbor)) {
            discoveredPageIds.add(neighbor);
            nextFrontier.push(neighbor);
          }
        }
      }
    }

    frontier = nextFrontier;
    if (frontier.length === 0) break; // No more nodes to discover
  }

  // Fetch page details for discovered pages
  const pages = await prisma.page.findMany({
    where: {
      id: { in: Array.from(discoveredPageIds) },
      tenant_id: tenantId,
    },
    select: {
      id: true,
      title: true,
      icon: true,
      updated_at: true,
    },
  });

  const pageIdSet = new Set(pages.map((p) => p.id));

  // Compute link counts for discovered pages
  const linkCounts = new Map<string, number>();
  for (const link of allLinks) {
    if (pageIdSet.has(link.source_page_id)) {
      linkCounts.set(
        link.source_page_id,
        (linkCounts.get(link.source_page_id) || 0) + 1
      );
    }
    if (pageIdSet.has(link.target_page_id)) {
      linkCounts.set(
        link.target_page_id,
        (linkCounts.get(link.target_page_id) || 0) + 1
      );
    }
  }

  // Build nodes
  const nodes: GraphNode[] = pages.map((page) => ({
    id: page.id,
    label: page.title,
    icon: page.icon,
    linkCount: linkCounts.get(page.id) || 0,
    updatedAt: page.updated_at.toISOString(),
  }));

  // Build edges (only between discovered pages)
  const edges: GraphEdge[] = allLinks
    .filter(
      (link) =>
        discoveredPageIds.has(link.source_page_id) &&
        discoveredPageIds.has(link.target_page_id)
    )
    .map((link) => ({
      source: link.source_page_id,
      target: link.target_page_id,
    }));

  return { nodes, edges };
}
```

---

### Step 3: Implement the Graph API Endpoint

**File: `src/app/api/graph/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/withTenant';
import { buildGraphData } from '@/lib/graph/builder';
import { GraphQuerySchema } from '@/types/graph';
import type { GraphApiResponse } from '@/types/graph';

/**
 * GET /api/graph
 * GET /api/graph?pageId=uuid&depth=2
 *
 * Returns knowledge graph data: nodes (pages) and edges (wikilinks).
 *
 * Query parameters:
 * - pageId (optional): UUID of center page for local graph mode
 * - depth (optional): BFS expansion depth, 1-5, default 2 (only with pageId)
 *
 * Global mode (no pageId): returns all pages and links for the tenant.
 * Local mode (with pageId): returns N-hop BFS expansion from the page.
 */
export const GET = withTenant(
  async (
    req: NextRequest,
    { tenantId }: { tenantId: string }
  ) => {
    const { searchParams } = new URL(req.url);

    // Parse and validate query parameters
    const parseResult = GraphQuerySchema.safeParse({
      pageId: searchParams.get('pageId') || undefined,
      depth: searchParams.get('depth') || undefined,
    });

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: parseResult.error.errors[0]?.message || 'Invalid parameters',
            details: parseResult.error.errors,
          },
          meta: { timestamp: new Date().toISOString() },
        },
        { status: 400 }
      );
    }

    const { pageId, depth } = parseResult.data;

    // If pageId is provided, verify the page exists
    if (pageId) {
      const page = await import('@/lib/db').then((m) =>
        m.prisma.page.findFirst({
          where: { id: pageId, tenant_id: tenantId },
          select: { id: true },
        })
      );

      if (!page) {
        return NextResponse.json(
          {
            error: {
              code: 'NOT_FOUND',
              message: 'Page not found',
            },
            meta: { timestamp: new Date().toISOString() },
          },
          { status: 404 }
        );
      }
    }

    // Build graph data
    const graphData = await buildGraphData(tenantId, pageId, depth);

    const response: GraphApiResponse = {
      data: graphData,
      meta: {
        nodeCount: graphData.nodes.length,
        edgeCount: graphData.edges.length,
        timestamp: new Date().toISOString(),
      },
    };

    return NextResponse.json(response);
  }
);
```

---

### Step 4: Create the useGraphData Hook

**File: `src/hooks/useGraphData.ts`**

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import type { GraphApiResponse } from '@/types/graph';

/**
 * TanStack Query hook for fetching graph data.
 *
 * @param options.pageId - Optional page ID for local graph mode
 * @param options.depth - BFS depth for local graph (default 2)
 * @param options.enabled - Whether the query should run
 */
export function useGraphData(
  options: {
    pageId?: string;
    depth?: number;
    enabled?: boolean;
  } = {}
) {
  const { pageId, depth = 2, enabled = true } = options;

  return useQuery<GraphApiResponse>({
    queryKey: ['graph', pageId ?? 'global', depth],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (pageId) {
        params.set('pageId', pageId);
        params.set('depth', String(depth));
      }

      const url = params.toString()
        ? `/api/graph?${params.toString()}`
        : '/api/graph';

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to fetch graph data');
      }

      return response.json() as Promise<GraphApiResponse>;
    },
    enabled,
    staleTime: 30_000, // 30 seconds
  });
}
```

---

## Testing Requirements

### Unit Tests: `src/__tests__/lib/graph/builder.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '@/lib/db';
import { buildGraphData } from '@/lib/graph/builder';

describe('buildGraphData', () => {
  const tenantId = 'test-tenant';

  describe('global graph', () => {
    it('should return all pages as nodes', async () => {
      // Mock prisma calls
      vi.spyOn(prisma.page, 'findMany').mockResolvedValue([
        { id: 'p1', title: 'Page 1', icon: null, updated_at: new Date(), tenant_id: tenantId } as any,
        { id: 'p2', title: 'Page 2', icon: null, updated_at: new Date(), tenant_id: tenantId } as any,
      ]);
      vi.spyOn(prisma.pageLink, 'findMany').mockResolvedValue([]);

      const result = await buildGraphData(tenantId);

      expect(result.nodes).toHaveLength(2);
      expect(result.nodes[0].label).toBe('Page 1');
      expect(result.nodes[1].label).toBe('Page 2');
    });

    it('should return all links as edges', async () => {
      vi.spyOn(prisma.page, 'findMany').mockResolvedValue([
        { id: 'p1', title: 'Page 1', icon: null, updated_at: new Date() } as any,
        { id: 'p2', title: 'Page 2', icon: null, updated_at: new Date() } as any,
      ]);
      vi.spyOn(prisma.pageLink, 'findMany').mockResolvedValue([
        { source_page_id: 'p1', target_page_id: 'p2' } as any,
      ]);

      const result = await buildGraphData(tenantId);

      expect(result.edges).toHaveLength(1);
      expect(result.edges[0]).toEqual({ source: 'p1', target: 'p2' });
    });

    it('should compute correct linkCount per node', async () => {
      vi.spyOn(prisma.page, 'findMany').mockResolvedValue([
        { id: 'p1', title: 'Page 1', icon: null, updated_at: new Date() } as any,
        { id: 'p2', title: 'Page 2', icon: null, updated_at: new Date() } as any,
      ]);
      vi.spyOn(prisma.pageLink, 'findMany').mockResolvedValue([
        { source_page_id: 'p1', target_page_id: 'p2' } as any,
      ]);

      const result = await buildGraphData(tenantId);

      const p1Node = result.nodes.find((n) => n.id === 'p1');
      const p2Node = result.nodes.find((n) => n.id === 'p2');

      expect(p1Node?.linkCount).toBe(1);
      expect(p2Node?.linkCount).toBe(1);
    });
  });

  describe('local graph (BFS)', () => {
    it('should discover nodes within specified depth', async () => {
      vi.spyOn(prisma.pageLink, 'findMany').mockResolvedValue([
        { source_page_id: 'center', target_page_id: 'hop1a' } as any,
        { source_page_id: 'center', target_page_id: 'hop1b' } as any,
        { source_page_id: 'hop1a', target_page_id: 'hop2' } as any,
        { source_page_id: 'hop2', target_page_id: 'hop3' } as any,
      ]);

      vi.spyOn(prisma.page, 'findMany').mockImplementation(async (args: any) => {
        const ids = args?.where?.id?.in || [];
        return ids.map((id: string) => ({
          id,
          title: `Page ${id}`,
          icon: null,
          updated_at: new Date(),
        }));
      });

      // Depth 1: center + hop1a + hop1b
      const result1 = await buildGraphData(tenantId, 'center', 1);
      expect(result1.nodes.map((n) => n.id).sort()).toEqual(
        ['center', 'hop1a', 'hop1b'].sort()
      );

      // Depth 2: adds hop2
      const result2 = await buildGraphData(tenantId, 'center', 2);
      expect(result2.nodes.map((n) => n.id)).toContain('hop2');
      expect(result2.nodes.map((n) => n.id)).not.toContain('hop3');
    });

    it('should only include edges between discovered nodes', async () => {
      vi.spyOn(prisma.pageLink, 'findMany').mockResolvedValue([
        { source_page_id: 'center', target_page_id: 'hop1' } as any,
        { source_page_id: 'hop1', target_page_id: 'hop2' } as any,
      ]);

      vi.spyOn(prisma.page, 'findMany').mockImplementation(async (args: any) => {
        const ids = args?.where?.id?.in || [];
        return ids.map((id: string) => ({
          id,
          title: id,
          icon: null,
          updated_at: new Date(),
        }));
      });

      const result = await buildGraphData(tenantId, 'center', 1);

      // Only center → hop1 edge (hop1 → hop2 excluded because hop2 not discovered)
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0]).toEqual({ source: 'center', target: 'hop1' });
    });
  });
});
```

### Integration Tests: `src/__tests__/api/graph/route.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';

describe('GET /api/graph (integration)', () => {
  let tenantId: string;

  beforeEach(async () => {
    const tenant = await prisma.tenant.create({ data: { name: 'Test' } });
    tenantId = tenant.id;

    const page1 = await prisma.page.create({
      data: { title: 'Page 1', tenant_id: tenantId },
    });
    const page2 = await prisma.page.create({
      data: { title: 'Page 2', tenant_id: tenantId },
    });

    await prisma.pageLink.create({
      data: {
        source_page_id: page1.id,
        target_page_id: page2.id,
        tenant_id: tenantId,
      },
    });
  });

  it('should return graph data with correct node and edge counts', async () => {
    const response = await fetch('http://localhost:3000/api/graph');
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.nodes.length).toBeGreaterThanOrEqual(2);
    expect(body.data.edges.length).toBeGreaterThanOrEqual(1);
    expect(body.meta.nodeCount).toBe(body.data.nodes.length);
    expect(body.meta.edgeCount).toBe(body.data.edges.length);
  });

  it('should return 400 for invalid depth parameter', async () => {
    const response = await fetch(
      'http://localhost:3000/api/graph?depth=10'
    );
    expect(response.status).toBe(400);
  });

  it('should return 404 for non-existent pageId', async () => {
    const response = await fetch(
      'http://localhost:3000/api/graph?pageId=00000000-0000-0000-0000-000000000000'
    );
    expect(response.status).toBe(404);
  });
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `src/types/graph.ts` |
| CREATE | `src/lib/graph/builder.ts` |
| CREATE | `src/app/api/graph/route.ts` |
| CREATE | `src/hooks/useGraphData.ts` |
| CREATE | `src/__tests__/lib/graph/builder.test.ts` |
| CREATE | `src/__tests__/api/graph/route.test.ts` |

---

**Last Updated:** 2026-02-21
