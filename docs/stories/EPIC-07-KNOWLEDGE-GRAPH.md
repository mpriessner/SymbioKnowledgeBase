# Epic 7: Knowledge Graph Visualization

**Epic ID:** EPIC-07
**Created:** 2026-02-21
**Total Story Points:** 16
**Priority:** High
**Status:** Draft

---

## Epic Overview

Epic 7 implements the interactive knowledge graph that visualizes all pages as nodes and wikilinks as edges using react-force-graph. The epic delivers a global graph view showing the entire knowledge base topology, a local per-page graph view showing N-degree connections from the current page, click-to-navigate interaction, zoom/pan controls, and basic filtering by date range and connection count.

The graph data is served from a dedicated API endpoint that reads the `page_links` table and returns a node-edge structure optimized for react-force-graph consumption. The WebGL renderer is used for performance with large graphs.

This epic covers FR25-29 (knowledge graph features) and FR36 (graph navigation).

---

## Business Value

- The knowledge graph is SymbioKnowledgeBase's signature differentiator — it transforms a flat page list into a visual network of ideas, revealing hidden connections and knowledge clusters
- Local per-page graphs help users understand context by showing what a page connects to and what connects back to it
- Click-to-navigate on graph nodes provides an alternative, spatial navigation method that supplements sidebar and search
- Visual graph density reveals which pages are central hubs (well-connected) vs. orphans (disconnected), guiding users to fill knowledge gaps

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│  PostgreSQL 18                                               │
│                                                              │
│  page_links table                                            │
│  ┌──────────────────────────────────────────┐               │
│  │ id │ source_page_id │ target_page_id │ tenant_id │       │
│  └──────────────────────────────────────────┘               │
│                    │                                         │
│  pages table       │                                         │
│  ┌─────────────────────────────────────┐                    │
│  │ id │ title │ tenant_id │ updated_at │                    │
│  └─────────────────────────────────────┘                    │
└────────────────────┬────────────────────────────────────────┘
                     │  Prisma query (tenant-scoped)
                     ▼
┌─────────────────────────────────────────┐
│  GET /api/graph?pageId=xxx              │
│  /api/graph/route.ts                    │
│                                         │
│  Global: all pages + all links          │
│  Local:  N-hop BFS from pageId          │
│                                         │
│  Response: {                            │
│    data: {                              │
│      nodes: [{ id, label, updatedAt,    │
│               connectionCount }],       │
│      edges: [{ source, target }]        │
│    },                                   │
│    meta: { nodeCount, edgeCount }       │
│  }                                      │
└────────────────────┬────────────────────┘
                     │  TanStack Query fetch
                     ▼
┌─────────────────────────────────────────┐
│  react-force-graph (2D, WebGL)          │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  GraphView / LocalGraphView     │    │
│  │  - ForceGraph2D component       │    │
│  │  - Node: circle, label = title  │    │
│  │  - Edge: line between nodes     │    │
│  │  - Click node → router.push()   │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  GraphControls                  │    │
│  │  - Zoom in/out/reset buttons    │    │
│  │  - Date range filter            │    │
│  │  - Node size toggle             │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

---

## Stories Breakdown

### SKB-07.1: Graph Data API Endpoint — 3 points, Critical

**Delivers:** `GET /api/graph` endpoint returning `{ data: { nodes, edges }, meta: { nodeCount, edgeCount } }`. Nodes are derived from the `pages` table (`id`, `label` from title, `updatedAt`, `connectionCount`). Edges are derived from the `page_links` table (`source` as `source_page_id`, `target` as `target_page_id`). All queries scoped by `tenant_id`. Optional `?pageId=xxx` parameter triggers local graph mode: performs N-hop BFS expansion (default N=2) from the given page, returning only reachable nodes and their interconnecting edges. Optional `?hops=N` parameter controls expansion depth (1-5, default 2). Zod validation on query parameters.

**Depends on:** SKB-05.1 (page_links table must be populated by wikilink resolution)

---

### SKB-07.2: Global Knowledge Graph View — 5 points, High

**Delivers:** `/graph` page (`src/app/(workspace)/graph/page.tsx`) with a full-viewport `react-force-graph` 2D component using the WebGL renderer (`forceEngine="d3"`). All pages rendered as circular nodes with their title as label. All wikilinks rendered as directed edges. Node color based on a consistent hash of the page title. Click on a node calls `router.push(/pages/${nodeId})` to navigate to that page. Hover on a node shows a tooltip with page title and connection count. TanStack Query fetches data from `/api/graph` with stale-while-revalidate caching. Loading skeleton while graph data is fetched. Canvas resizes responsively on window resize.

**Depends on:** SKB-07.1 (graph API must provide node/edge data)

---

### SKB-07.3: Local Per-Page Graph View — 5 points, High

**Delivers:** `LocalGraph` component (`components/graph/LocalGraph.tsx`) embedded in the page view (`/pages/[id]`). Shows a smaller force graph (e.g., 400x300px) with the current page highlighted (distinct color and larger radius). Fetches from `/api/graph?pageId=xxx&hops=2`. Current page node is pinned at center. Toggle control to switch between local graph (N=2) and full global graph view (navigates to `/graph`). Collapsible panel — user can hide/show the local graph. Clicking a neighbor node navigates to that page.

**Depends on:** SKB-07.2 (global graph view establishes react-force-graph patterns and shared components)

---

### SKB-07.4: Graph Filtering and Interaction — 3 points, Medium

**Delivers:** `GraphControls` component (`components/graph/GraphControls.tsx`) rendered alongside the graph view. Zoom in, zoom out, and reset zoom buttons calling react-force-graph's `zoom()` and `centerAt()` APIs. Date range filter (start date, end date) filtering nodes by `updatedAt` — filtered nodes and their edges are removed from the rendered graph. Node size scales with `connectionCount` (more connections = larger radius, using a sqrt scale). Optional edge labels showing link text (toggled via checkbox, off by default for performance). Controls state managed via URL search params for shareability.

**Depends on:** SKB-07.2 (global graph view must exist as the rendering surface)

---

## Test Coverage Requirements

| Story | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 07.1 | BFS expansion returns correct N-hop nodes; Zod rejects invalid hops | API returns correct node/edge counts for known data; tenant isolation verified | GET /api/graph returns 200 with valid structure |
| 07.2 | GraphView component renders without crashing; node click handler calls router.push | - | Navigate to /graph, see nodes, click a node, navigated to page |
| 07.3 | LocalGraph renders with highlighted center node; toggle triggers navigation | - | On page view, local graph visible, click neighbor navigates |
| 07.4 | GraphControls renders buttons; date filter removes nodes outside range | - | Click zoom in, graph zooms; apply date filter, nodes filtered |

---

## Implementation Order

```
07.1 → 07.2 → 07.3 (sequential)
              → 07.4 (parallel with 07.3 after 07.2)

              ┌────────┐
         ┌───▶│ 07.3   │
┌────────┐│   │ Local  │
│ 07.1   ││   │ Graph  │
│ Graph  ││   └────────┘
│ API    │▼
└───┬────┘┌────────┐
    │     │ 07.2   │
    └────▶│ Global │──┐
          │ Graph  │  │
          └────────┘  │  ┌────────┐
                      └─▶│ 07.4   │
                         │ Filter │
                         │Controls│
                         └────────┘
```

---

## Shared Constraints

- All database queries must include `tenant_id` for multi-tenant isolation
- API responses follow the standard envelope: `{ data, meta }` for success, `{ error, meta }` for failure
- TypeScript strict mode — no `any` types allowed
- All UI components use Tailwind utility classes only — no custom CSS classes
- react-force-graph 2D is used (not 3D) to keep bundle size manageable
- WebGL renderer is preferred for performance; fall back to Canvas if WebGL is unavailable
- Maximum BFS expansion depth is capped at 5 hops to prevent excessive query size
- Graph data is cached client-side via TanStack Query with a 30-second stale time

---

## Files Created/Modified by This Epic

### New Files
- `src/app/api/graph/route.ts` — graph data API endpoint
- `src/lib/graph/buildGraphData.ts` — graph data builder with BFS expansion
- `src/app/(workspace)/graph/page.tsx` — global graph view page
- `src/components/graph/GraphView.tsx` — full-viewport react-force-graph wrapper
- `src/components/graph/LocalGraph.tsx` — per-page embedded graph view
- `src/components/graph/GraphControls.tsx` — zoom, filter, and display controls
- `src/components/graph/GraphTooltip.tsx` — hover tooltip for graph nodes
- `src/hooks/useGraphData.ts` — TanStack Query hook for graph API
- `src/types/graph.ts` — GraphNode, GraphEdge, GraphData type definitions
- `src/__tests__/lib/graph/buildGraphData.test.ts`
- `src/__tests__/api/graph/route.test.ts`
- `src/__tests__/components/graph/GraphView.test.tsx`
- `src/__tests__/components/graph/LocalGraph.test.tsx`
- `src/__tests__/components/graph/GraphControls.test.tsx`

### Modified Files
- `src/app/(workspace)/pages/[id]/page.tsx` — embed LocalGraph component in page view
- `src/app/(workspace)/graph/page.tsx` — replace placeholder with full GraphView
- `src/types/api.ts` — add GraphNode, GraphEdge, GraphResponse type exports

---

**Last Updated:** 2026-02-21