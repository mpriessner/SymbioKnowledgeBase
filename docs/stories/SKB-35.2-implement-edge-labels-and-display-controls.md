# Story SKB-35.2: Implement Edge Label Toggle & Add Show/Hide Controls

**Epic:** Epic 35 - Graph Display Toggles Fix
**Story ID:** SKB-35.2
**Story Points:** 5 | **Priority:** High | **Status:** Draft
**Depends On:** SKB-35.1 (ref-based toggle pattern must be in place)

---

## User Story

As a SymbioKnowledgeBase user, I want working "Edge labels" toggles and new "Show nodes" / "Show edges" controls in the graph, so that I can customize the graph visualization to focus on what matters — seeing just nodes, just connections, or a clean labeled view.

---

## Acceptance Criteria

### Edge Labels Toggle (Fix Existing Broken Toggle)
- [ ] The "Edge labels" checkbox in GraphControls actually shows/hides labels on edges
- [ ] Edge labels display the source→target relationship (e.g., no text, or a dot/arrow)
- [ ] Edge labels are theme-aware (light text on dark bg, dark text on light bg)
- [ ] Edge labels only visible when zoomed in sufficiently (`globalScale > 1.2`)
- [ ] Toggle does NOT restart the force simulation (uses ref pattern from SKB-35.1)
- [ ] `showEdgeLabels` is passed from `page.tsx` to `GraphView` as a prop

### Show/Hide Nodes Toggle (New)
- [ ] A new "Show nodes" checkbox is added to the Display section in GraphControls
- [ ] Default: checked (nodes visible)
- [ ] When unchecked: node circles are hidden, but edges remain visible
- [ ] Node labels are also hidden when nodes are hidden
- [ ] Node hover/click interactions disabled when nodes are hidden
- [ ] URL persistence: `?nodes=false`

### Show/Hide Edges Toggle (New)
- [ ] A new "Show edges" checkbox is added to the Display section in GraphControls
- [ ] Default: checked (edges visible)
- [ ] When unchecked: edge lines and arrows are hidden, but nodes remain visible
- [ ] Edge labels are also hidden when edges are hidden
- [ ] URL persistence: `?edges=false`

### Display Section Order
- [ ] Updated Display section in GraphControls:
  1. Show nodes (checkbox)
  2. Show edges (checkbox)
  3. Node labels (checkbox)
  4. Edge labels (checkbox)

### Implementation Details for linkCanvasObject
- [ ] A custom `linkCanvasObject` callback is added to `GraphView.tsx`
- [ ] It draws:
  - The edge line (if `showEdges` is true)
  - A directional arrow at the target end
  - An optional label at the midpoint (if `showEdgeLabels` is true)
- [ ] Uses refs for `showEdges` and `showEdgeLabels` (no simulation restart)
- [ ] **OR** use the built-in `linkVisibility` prop on ForceGraph2D:
  - `linkVisibility={(link) => showEdgesRef.current}` — simpler, may avoid need for custom linkCanvasObject
  - Test both approaches and use whichever avoids simulation restart

### nodeCanvasObject Enhancement
- [ ] The existing `nodeCanvasObject` checks `showNodesRef.current`
- [ ] When `showNodes` is false: skip the entire node drawing (circle + label + glow)
- [ ] The node still exists in the force simulation (for edge positioning) but is invisible

### GraphFilters Extension
- [ ] `useGraphFilters` interface extended with:
  ```typescript
  showNodes: boolean;      // default: true
  showEdges: boolean;      // default: true
  ```
- [ ] Both persisted to URL params (`?nodes=false`, `?edges=false`)
- [ ] Both included in `resetFilters()` default values

### Props Extension
- [ ] `GraphView` props extended:
  ```typescript
  showEdgeLabels?: boolean;  // NEW
  showNodes?: boolean;       // NEW
  showEdges?: boolean;       // NEW
  ```
- [ ] `page.tsx` passes all four display toggles to `GraphView`

---

## Architecture Overview

```
Updated Display Section in GraphControls:
──────────────────────────────────────────

┌─────────────────────────────────────┐
│ Display                             │
│                                     │
│ [x] Show nodes                      │
│ [x] Show edges                      │
│ [x] Node labels                     │
│ [ ] Edge labels                     │
└─────────────────────────────────────┘


GraphView Rendering Logic:
──────────────────────────

nodeCanvasObject(node, ctx, globalScale):
  if (!showNodesRef.current) return;   // ← NEW: skip drawing
  // ... existing node drawing code ...
  if (showLabelsRef.current && globalScale > 0.8):
    // draw label

linkCanvasObject(link, ctx, globalScale):        // ← NEW CALLBACK
  if (!showEdgesRef.current) return;
  // Draw edge line
  // Draw directional arrow
  if (showEdgeLabelsRef.current && globalScale > 1.2):
    // Draw edge label at midpoint

OR (simpler approach using built-in props):

<ForceGraph2D
  ...
  nodeVisibility={(node) => showNodesRef.current}
  linkVisibility={(link) => showEdgesRef.current}
  linkCanvasObjectMode={() => showEdgeLabelsRef.current ? 'after' : undefined}
  linkCanvasObject={edgeLabelRenderer}
/>


Ref Pattern (from SKB-35.1):
─────────────────────────────

const showNodesRef = useRef(showNodes);
const showEdgesRef = useRef(showEdges);
const showEdgeLabelsRef = useRef(showEdgeLabels);

useEffect(() => { showNodesRef.current = showNodes; }, [showNodes]);
useEffect(() => { showEdgesRef.current = showEdges; }, [showEdges]);
useEffect(() => { showEdgeLabelsRef.current = showEdgeLabels; }, [showEdgeLabels]);

// None of these refs are in any useCallback dependency array
// → No simulation restart when toggles change
```

---

## Implementation Steps

### Step 1: Extend GraphFilters Interface

**File: `src/hooks/useGraphFilters.ts`** (modify)

Add to `GraphFilters`:
```typescript
showNodes: boolean;       // Whether to show node circles
showEdges: boolean;       // Whether to show edge lines
```

Add to `DEFAULT_FILTERS`:
```typescript
showNodes: true,
showEdges: true,
```

Add URL param handling:
```typescript
// Initialize
showNodes: searchParams.get("nodes") !== "false",
showEdges: searchParams.get("edges") !== "false",

// Persist
if (!newFilters.showNodes) params.set("nodes", "false");
if (!newFilters.showEdges) params.set("edges", "false");
```

### Step 2: Add Controls to GraphControls

**File: `src/components/graph/GraphControls.tsx`** (modify)

Add before "Node labels" checkbox:
```tsx
<label className="mb-2 flex cursor-pointer items-center gap-2">
  <input
    type="checkbox"
    checked={filters.showNodes}
    onChange={(e) => onFilterChange("showNodes", e.target.checked)}
    className="rounded"
  />
  <span className="text-xs text-[var(--color-text-primary)]">Show nodes</span>
</label>

<label className="mb-2 flex cursor-pointer items-center gap-2">
  <input
    type="checkbox"
    checked={filters.showEdges}
    onChange={(e) => onFilterChange("showEdges", e.target.checked)}
    className="rounded"
  />
  <span className="text-xs text-[var(--color-text-primary)]">Show edges</span>
</label>
```

### Step 3: Pass New Props from Page to GraphView

**File: `src/app/(workspace)/graph/page.tsx`** (modify)

```tsx
<GraphView
  overrideData={filteredData}
  showLabels={filters.showLabels}
  showEdgeLabels={filters.showEdgeLabels}   // NEW
  showNodes={filters.showNodes}              // NEW
  showEdges={filters.showEdges}              // NEW
  onGraphRef={handleGraphRef}
  highlightedNodes={highlightedNodes}
/>
```

### Step 4: Add Props and Refs to GraphView

**File: `src/components/graph/GraphView.tsx`** (modify)

Add to props interface:
```typescript
showEdgeLabels?: boolean;
showNodes?: boolean;
showEdges?: boolean;
```

Add refs:
```typescript
const showNodesRef = useRef(showNodes);
const showEdgesRef = useRef(showEdges);
const showEdgeLabelsRef = useRef(showEdgeLabels);

useEffect(() => { showNodesRef.current = showNodes; }, [showNodes]);
useEffect(() => { showEdgesRef.current = showEdges; }, [showEdges]);
useEffect(() => { showEdgeLabelsRef.current = showEdgeLabels; }, [showEdgeLabels]);
```

### Step 5: Update nodeCanvasObject for Show/Hide Nodes

**File: `src/components/graph/GraphView.tsx`** (modify)

At the start of `nodeCanvasObject`:
```typescript
if (!showNodesRef.current) return; // Skip drawing entirely
```

### Step 6: Implement Edge Rendering

**File: `src/components/graph/GraphView.tsx`** (modify)

Option A — Use built-in visibility prop:
```typescript
<ForceGraph2D
  ...
  linkVisibility={() => showEdgesRef.current}
  ...
/>
```

Option B — Custom linkCanvasObject (if edge labels needed):
```typescript
const linkCanvasObject = useCallback(
  (linkObj: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    if (!showEdgesRef.current) return;

    const link = linkObj;
    const source = link.source;
    const target = link.target;

    // Draw edge line
    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(target.x, target.y);
    ctx.strokeStyle = getEdgeColor(theme);
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw arrow at target
    // ... arrow drawing logic ...

    // Draw label at midpoint (if enabled)
    if (showEdgeLabelsRef.current && globalScale > 1.2) {
      const midX = (source.x + target.x) / 2;
      const midY = (source.y + target.y) / 2;
      const fontSize = Math.max(10 / globalScale, 2);
      ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = theme === 'dark' ? 'rgba(229,231,235,0.6)' : 'rgba(55,53,47,0.6)';
      ctx.textAlign = 'center';
      ctx.fillText('→', midX, midY);
    }
  },
  [theme]  // Only theme in deps — no toggles
);
```

### Step 7: Force Canvas Repaint on Toggle Changes

Add for all four toggles:
```typescript
useEffect(() => {
  if (graphRef.current) {
    graphRef.current.centerAt(undefined, undefined, 0);
  }
}, [showNodes, showEdges, showLabels, showEdgeLabels]);
```

---

## Testing Requirements

### Unit Tests (8+ cases)

**File: `src/__tests__/components/graph/GraphView-toggles.test.tsx`**

- showNodes=false → nodeCanvasObject returns early (no drawing)
- showNodes=true → node circle drawn
- showEdges=false → edges not rendered
- showEdges=true → edges rendered with correct color
- showEdgeLabels=true → edge label drawn at midpoint
- showEdgeLabels=false → no edge label
- All toggle refs update correctly when props change
- No useCallback dependency includes toggle values

**File: `src/__tests__/hooks/useGraphFilters.test.ts`**

- showNodes defaults to true
- showEdges defaults to true
- URL param `?nodes=false` → showNodes = false
- resetFilters sets all to defaults

### Integration Tests (3+ cases)

- Toggle "Show nodes" off → graph renders only edges
- Toggle "Show edges" off → graph renders only nodes
- Toggle "Edge labels" on → labels appear at edge midpoints when zoomed in

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/hooks/useGraphFilters.ts` | Modify | Add showNodes, showEdges to interface and defaults |
| `src/components/graph/GraphControls.tsx` | Modify | Add "Show nodes" and "Show edges" checkboxes |
| `src/components/graph/GraphView.tsx` | Modify | Add props, refs, linkCanvasObject, node visibility |
| `src/app/(workspace)/graph/page.tsx` | Modify | Pass new props to GraphView |
| `src/components/graph/Graph3DView.tsx` | Modify | Apply same controls for 3D parity |
| Tests | Create | Unit + integration tests |

---

**Last Updated:** 2026-02-27
