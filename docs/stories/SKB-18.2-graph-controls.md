# Story SKB-18.2: Graph Interaction Controls

**Epic:** Epic 18 - Enhanced Graph Visualization
**Story ID:** SKB-18.2
**Story Points:** 5 | **Priority:** Medium | **Status:** Planned
**Depends On:** SKB-18.1 (visual styling must be in place)

---

## User Story

As a user exploring the knowledge graph, I want interactive controls for zooming, searching, and navigating, So that I can efficiently explore large graphs and find specific nodes.

---

## Acceptance Criteria

1. **Zoom Controls:** Zoom in/out/reset buttons calling `graphRef.zoom()`, `graphRef.zoomToFit()`
2. **Depth Slider:** 1-5 hops, triggers `GET /api/graph?hops=N`
3. **Search Input:** Highlights matching nodes by title
4. **Path Highlight:** Select 2 nodes, BFS finds shortest path, highlights edges
5. **Right-Click Menu:** Open page, Copy link, Delete (context menu on node)
6. **URL Params:** All controls sync to URL (`?zoom=2&hops=3&search=foo`)

---

## Technical Implementation

**GraphControls.tsx** with zoom buttons, depth slider, search input.
**useGraphFilters()** hook manages URL params.
**Pathfinding:** BFS algorithm in `src/lib/graph/pathfinding.ts`.

---

**Last Updated:** 2026-02-22
