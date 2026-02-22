# Epic 18: Enhanced Graph Visualization

**Epic ID:** EPIC-18
**Created:** 2026-02-22
**Total Story Points:** 21
**Priority:** Low
**Status:** Planned
**Dependencies:** Must fix react-force-graph-2d installation (currently broken in package.json)

---

## Epic Overview

Epic 18 enhances the existing knowledge graph with improved visual styling, interactive controls, filtering capabilities, and an optional 3D view. The current graph implementation (EPIC-07) provides basic node-edge visualization with click-to-navigate. This epic adds polish and power-user features that make the graph a more effective knowledge exploration tool.

Enhancements include: node colors by type/category, node sizing by connection count, edge thickness by link strength, configurable color palettes for dark/light modes, zoom/pan/reset controls, depth slider for N-hop exploration, search within graph, path highlighting, filter panel for node types and date ranges, legend and stats panel, and an optional 3D graph toggle.

This epic is **blocked** until the react-force-graph library dependency is properly installed. Current error: `Module not found: Can't resolve 'react-force-graph-2d'` — likely due to incorrect package name or missing peer dependencies.

---

## Business Value

- **Visual clarity:** Color-coded nodes and sized edges help users quickly identify patterns and important nodes
- **Exploration tools:** Depth slider and search make large graphs navigable without overwhelming users
- **Accessibility:** Dark/light mode support and legend ensure graph is usable for all users
- **Power users:** 3D view and advanced filters unlock deep knowledge graph analysis
- **Differentiation:** Enhanced graph keeps SymbioKnowledgeBase competitive with Obsidian, Roam, and Logseq

---

## Architecture Summary

```
Enhanced Graph Stack
────────────────────

  Client Components:
  ┌────────────────────────────────────────┐
  │  GraphView.tsx (2D, existing)          │
  │  - Add nodeColor, nodeSize props       │
  │  - Add edge thickness calculation      │
  │  - Dark/light mode CSS variables       │
  └────────────────────────────────────────┘
           │
           ▼
  ┌────────────────────────────────────────┐
  │  GraphControls.tsx (NEW)               │
  │  - Zoom in/out/reset buttons           │
  │  - Depth slider (1-5 hops)             │
  │  - Search input (highlights nodes)     │
  │  - "Find path between nodes" tool      │
  └────────────────────────────────────────┘
           │
           ▼
  ┌────────────────────────────────────────┐
  │  GraphFilters.tsx (NEW)                │
  │  - Toggle node types (Page, Database)  │
  │  - Min connection count slider         │
  │  - Date range picker (updated after X) │
  │  - Reset filters button                │
  └────────────────────────────────────────┘
           │
           ▼
  ┌────────────────────────────────────────┐
  │  GraphLegend.tsx (NEW)                 │
  │  - Color meanings (blue=page, etc.)    │
  │  - Stats: X nodes, Y edges, Z clusters │
  └────────────────────────────────────────┘
           │
           ▼
  ┌────────────────────────────────────────┐
  │  Graph3DToggle.tsx (NEW)               │
  │  - Switch between 2D and 3D view       │
  │  - Uses react-force-graph-3d (WebGL)   │
  │  - Same data/filters as 2D             │
  └────────────────────────────────────────┘

  State Management:
  ┌────────────────────────────────────────┐
  │  useGraphFilters() hook                │
  │  - Manages filter state (URL params)   │
  │  - Computes filtered node/edge lists   │
  │  - Exposes reset() function            │
  └────────────────────────────────────────┘

  Color Palette:
  ┌────────────────────────────────────────┐
  │  Light Mode:                           │
  │  - Page: #529CCA (blue)                │
  │  - Database: #8B5CF6 (purple)          │
  │  - Orphan: #9CA3AF (gray)              │
  │                                        │
  │  Dark Mode:                            │
  │  - Page: #60A5FA (light blue)          │
  │  - Database: #A78BFA (light purple)    │
  │  - Orphan: #6B7280 (dark gray)         │
  └────────────────────────────────────────┘
```

---

## Stories Breakdown

### SKB-18.1: Graph Visual Styling — 5 points, High

**Delivers:** Node colors by type (Page vs. Database) and category. Node size scales with connection count using sqrt scale. Edge thickness varies with link strength (bidirectional links are thicker). Labels appear on hover only (to reduce clutter). Dark/light mode support via CSS variables. Configurable color palette exposed as props to GraphView.

**Depends on:** EPIC-07 (existing graph implementation must be functional)

---

### SKB-18.2: Graph Interaction Controls — 5 points, Medium

**Delivers:** GraphControls component with: Zoom in/out buttons (calls `graphRef.zoom()`), Reset view button (calls `graphRef.zoomToFit()`), Depth slider (1-5 hops, triggers `GET /api/graph?hops=N`), Search input (highlights matching nodes in-place), "Highlight path" tool (select 2 nodes, highlights shortest path using BFS). Right-click context menu on nodes (Open, Copy Link, Delete). All controls update URL params for shareability.

**Depends on:** SKB-18.1 (visual styling must be in place)

---

### SKB-18.3: Graph Filters & Legend — 5 points, Medium

**Delivers:** GraphFilters panel (collapsible sidebar): Toggle node types (Page, Database), Min connection count slider (0-20), Date range picker (pages updated after date X), "Only show orphans" toggle. Legend showing color meanings. Stats panel: total nodes, total edges, identified clusters (using community detection algorithm or simple connected-components). Filtered data computed client-side from full graph data.

**Depends on:** SKB-18.2 (controls must exist for consistent UX)

---

### SKB-18.4: Optional 3D Graph View — 6 points, Low

**Delivers:** Toggle button "2D / 3D" in graph header. 3D view uses react-force-graph-3d (WebGL renderer, three.js backend). Same node/edge data as 2D view. Same filters apply. Camera controls: orbit, zoom, pan. Performance warning if > 500 nodes ("3D view may be slow with large graphs"). Falls back to 2D if WebGL not supported.

**Depends on:** SKB-18.3 (filters must work across both 2D and 3D views)

---

## Test Coverage Requirements

| Story | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 18.1 | Node color function returns correct color for type; sqrt scale for node size | - | Graph renders with colored nodes, hover shows labels |
| 18.2 | Zoom buttons call graphRef.zoom(); search highlights correct nodes | - | Click zoom in → graph zooms, enter search term → node highlighted |
| 18.3 | Filter function removes nodes outside date range; stats count matches filtered nodes | - | Toggle "Only orphans" → only orphan nodes visible |
| 18.4 | 3D view renders without crashing; toggle switches between 2D and 3D | - | Click "3D" → 3D graph loads, click node → navigates to page |

---

## Implementation Order

```
18.1 → 18.2 → 18.3 → 18.4 (sequential)

18.1  Graph Visual Styling (foundation)
  │
  ▼
18.2  Graph Interaction Controls
  │
  ▼
18.3  Graph Filters & Legend
  │
  ▼
18.4  Optional 3D Graph View
```

---

## Shared Constraints

- All graph data fetched from existing `GET /api/graph` endpoint (no new APIs needed)
- Filters applied client-side (no server-side filtering — keeps API simple)
- URL params for all filter/control state (makes graph views shareable)
- TypeScript strict mode — no `any` types allowed
- react-force-graph-2d must be installed correctly before starting this epic
- react-force-graph-3d is a separate package (install only if 3D view is enabled)
- WebGL fallback: if WebGL unavailable, 3D toggle is hidden
- Maximum graph size for 3D: 1000 nodes (beyond that, force 2D for performance)

---

## Files Created/Modified by This Epic

### New Files
- `src/components/graph/GraphControls.tsx` — Zoom, depth, search controls
- `src/components/graph/GraphFilters.tsx` — Filter panel with toggles and sliders
- `src/components/graph/GraphLegend.tsx` — Color legend and stats
- `src/components/graph/Graph3DView.tsx` — 3D graph wrapper (react-force-graph-3d)
- `src/components/graph/Graph3DToggle.tsx` — 2D/3D toggle button
- `src/hooks/useGraphFilters.ts` — Filter state management hook
- `src/lib/graph/colorPalette.ts` — Color scheme definitions
- `src/lib/graph/pathfinding.ts` — BFS algorithm for path highlighting
- `src/__tests__/components/graph/GraphControls.test.tsx`
- `src/__tests__/components/graph/GraphFilters.test.tsx`
- `src/__tests__/lib/graph/pathfinding.test.ts`
- `tests/e2e/graph-controls.spec.ts`

### Modified Files
- `src/components/graph/GraphView.tsx` — Add color/size logic, dark mode support
- `src/app/(workspace)/graph/page.tsx` — Integrate GraphControls, GraphFilters, GraphLegend
- `package.json` — Fix react-force-graph-2d, add react-force-graph-3d (optional)
- `src/types/graph.ts` — Add GraphFilter, GraphStats types

---

## Blockers

### React Force Graph Installation Issue

**Current error:**
```
Module not found: Can't resolve 'react-force-graph-2d'
```

**Root cause:** The correct package name is `react-force-graph` (not `react-force-graph-2d`). The 2D component is imported as:
```typescript
import { ForceGraph2D } from 'react-force-graph';
```

**Fix required before EPIC-18:**
1. Update `package.json`:
   ```json
   "dependencies": {
     "react-force-graph": "^1.43.0",
     "three": "^0.160.0"  // peer dependency for 3D view
   }
   ```
2. Update all imports in existing code:
   ```typescript
   // OLD (broken):
   import ForceGraph2D from 'react-force-graph-2d';

   // NEW (correct):
   import { ForceGraph2D } from 'react-force-graph';
   ```
3. Run `npm install` or `pnpm install`
4. Verify graph page renders without errors

**Once fixed, EPIC-18 can proceed.**

---

**Last Updated:** 2026-02-22
