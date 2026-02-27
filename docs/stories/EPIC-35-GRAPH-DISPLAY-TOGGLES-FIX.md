# Epic 35: Graph Display Toggles Fix

**Epic ID:** EPIC-35
**Created:** 2026-02-27
**Total Story Points:** 8
**Priority:** High
**Status:** Done

---

## Epic Overview

The knowledge graph view has a "Display" section in GraphControls with two toggles: **"Node labels"** and **"Edge labels"**. Neither works correctly:

1. **"Node labels" toggle** — labels disappear/appear, but the force simulation restarts causing all nodes to "wiggle" (re-settle). The toggle works functionally but the UX is broken by the physics restart.
2. **"Edge labels" toggle** — completely non-functional. The checkbox toggles state in memory, but the state is never passed to `GraphView` and there is no custom edge rendering (`linkCanvasObject`) to consume it.

Additionally, the user expects to be able to **show/hide nodes and edges themselves** (not just their labels), which the current UI doesn't support at all.

### Root Cause Analysis

**Bug 1 — Node label toggle causes wiggle:**
- `showLabels` is in the dependency array of `nodeCanvasObject` (`GraphView.tsx:283`)
- When `showLabels` changes, `nodeCanvasObject` gets a new function reference
- `react-force-graph-2d` interprets a new `nodeCanvasObject` function as a reason to re-heat the force simulation
- All nodes re-settle, causing the "wiggle"
- **Fix:** Memoize `showLabels` via a ref so the callback identity doesn't change, OR use `useRef` for the value and read it inside the callback without it being a dependency

**Bug 2 — Edge labels toggle does nothing:**
- `showEdgeLabels` is stored in `useGraphFilters` state (`useGraphFilters.ts:17`)
- `GraphControls.tsx:216` toggles it correctly
- **But:** `page.tsx:147-152` does NOT pass `showEdgeLabels` to `GraphView`
- **And:** `GraphView.tsx` has no `showEdgeLabels` prop, no `linkCanvasObject`, and no edge label rendering logic at all
- The toggle is a dead control — it changes state that nothing reads
- **Fix:** Pass `showEdgeLabels` to `GraphView`, implement `linkCanvasObject` that draws directional arrows with optional labels

**Missing feature — Show/hide nodes and edges:**
- No toggles exist for hiding all nodes or all edges
- Users may want to hide edges to see an uncluttered node map, or hide nodes to see connection patterns
- **Fix:** Add `showNodes` and `showEdges` filter options

### What Already Exists

- **GraphControls.tsx** (`src/components/graph/GraphControls.tsx:195-226`) — Display section with two checkbox toggles
- **useGraphFilters.ts** (`src/hooks/useGraphFilters.ts:7-18`) — Filter state with `showLabels` and `showEdgeLabels`
- **GraphView.tsx** (`src/components/graph/GraphView.tsx:206-284`) — Custom `nodeCanvasObject` that reads `showLabels` for label rendering
- **ForceGraph2D** props (`GraphView.tsx:339-359`) — Uses `linkColor`, `linkWidth`, `linkDirectionalArrowLength` but no `linkCanvasObject`
- **Graph3DView** (`src/components/graph/Graph3DView.tsx`) — 3D view that also receives `showLabels` but may have similar issues

---

## Stories Breakdown

### SKB-35.1: Fix Node Label Toggle Wiggle — 3 points, High

**Delivers:** The "Node labels" toggle smoothly shows/hides labels without restarting the force simulation. Nodes stay in place.

**Depends on:** Nothing

---

### SKB-35.2: Implement Edge Label Toggle & Add Show/Hide Controls — 5 points, High

**Delivers:** The "Edge labels" toggle actually renders/hides labels on edges. New "Show nodes" and "Show edges" toggles are added to the Display section, allowing users to independently hide all nodes or all edges. All four toggles work correctly without causing simulation restarts.

**Depends on:** SKB-35.1 (wiggle fix technique applies to all toggles)

---

## Test Coverage Requirements

| Story | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 35.1 | nodeCanvasObject reads showLabels without being in dependency array; label drawn when true, hidden when false | Toggle label → no force simulation restart; labels appear/disappear smoothly | Click "Node labels" checkbox → labels toggle without wiggle |
| 35.2 | linkCanvasObject draws edge labels when showEdgeLabels=true; nodes hidden when showNodes=false; edges hidden when showEdges=false | All four toggles update display correctly; URL params persist state | Full graph controls interaction test |

---

## Implementation Order

```
┌────────┐   ┌────────┐
│ 35.1   │──▶│ 35.2   │
│Label   │   │Edge +  │
│Wiggle  │   │Controls│
└────────┘   └────────┘
```

---

## Shared Constraints

- **No simulation restart:** Display toggles must NOT cause the force simulation to re-heat. Nodes must stay in place.
- **URL persistence:** All toggle states persisted in URL search params (existing pattern).
- **Theme support:** Edge labels must respect light/dark theme colors.
- **3D view parity:** Changes should also apply to `Graph3DView` where applicable.
- **Performance:** Custom `linkCanvasObject` must handle 1000+ edges without frame drops.

---

## Files Created/Modified by This Epic

### Modified Files
- `src/components/graph/GraphView.tsx` — Fix nodeCanvasObject dependency, add linkCanvasObject, add showNodes/showEdges support
- `src/components/graph/GraphControls.tsx` — Add "Show nodes" and "Show edges" toggles
- `src/hooks/useGraphFilters.ts` — Add showNodes, showEdges to GraphFilters interface
- `src/app/(workspace)/graph/page.tsx` — Pass showEdgeLabels, showNodes, showEdges to GraphView
- `src/components/graph/Graph3DView.tsx` — Apply same fixes for 3D view consistency

---

**Last Updated:** 2026-02-27
