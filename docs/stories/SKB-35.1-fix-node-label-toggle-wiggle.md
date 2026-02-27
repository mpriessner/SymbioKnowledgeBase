# Story SKB-35.1: Fix Node Label Toggle Wiggle

**Epic:** Epic 35 - Graph Display Toggles Fix
**Story ID:** SKB-35.1
**Story Points:** 3 | **Priority:** High | **Status:** Draft
**Depends On:** Nothing

---

## User Story

As a SymbioKnowledgeBase user, I want to toggle node labels on and off in the knowledge graph without the nodes wiggling or re-settling, so that I can switch between clean and labeled views without disrupting my exploration.

---

## Acceptance Criteria

### Label Toggle Behavior
- [ ] Clicking the "Node labels" checkbox instantly shows/hides labels on all nodes
- [ ] Nodes do NOT move, wiggle, or re-settle when labels are toggled
- [ ] The force simulation does NOT restart (d3 alpha stays at 0)
- [ ] Toggle is immediate — no animation delay
- [ ] Labels still obey the existing zoom threshold: only visible when `globalScale > 0.8`
- [ ] Highlighted nodes (from search) always show labels regardless of toggle state

### Root Cause Fix
- [ ] `showLabels` is removed from the `nodeCanvasObject` dependency array
- [ ] Instead, `showLabels` is stored in a `useRef` that the callback reads directly
- [ ] The `nodeCanvasObject` function reference remains stable across showLabels changes
- [ ] `ForceGraph2D` does not re-heat the simulation because the callback identity is unchanged

### URL State Persistence
- [ ] Toggle state continues to be persisted in URL params (`?labels=false`)
- [ ] Refreshing the page preserves the toggle state

---

## Architecture Overview

```
Current (broken):
─────────────────

showLabels (state) changes
  → nodeCanvasObject useCallback dependency array includes showLabels
  → New function reference created
  → ForceGraph2D receives new nodeCanvasObject prop
  → Force simulation re-heats (alpha = 1)
  → Nodes wiggle/re-settle


Fixed:
──────

showLabels (state) changes
  → showLabelsRef.current = showLabels  (ref updated)
  → nodeCanvasObject useCallback dependency array does NOT include showLabels
  → Function reference unchanged
  → ForceGraph2D prop unchanged → no re-render → no simulation restart
  → Canvas still repaints (ForceGraph2D's internal animation loop)
  → nodeCanvasObject reads showLabelsRef.current on next frame
  → Labels appear/disappear smoothly, nodes stay in place
```

---

## Implementation Steps

### Step 1: Add Ref for showLabels

**File: `src/components/graph/GraphView.tsx`** (modify)

Before the `nodeCanvasObject` callback, add:

```typescript
// Use ref so that toggling labels doesn't recreate the callback
// (which would restart the force simulation)
const showLabelsRef = useRef(showLabels);
useEffect(() => {
  showLabelsRef.current = showLabels;
}, [showLabels]);
```

### Step 2: Update nodeCanvasObject to Read from Ref

**File: `src/components/graph/GraphView.tsx`** (modify)

In the `nodeCanvasObject` callback (line 256), change:
```typescript
// Before:
if ((showLabels && globalScale > 0.8) || isHighlighted) {

// After:
if ((showLabelsRef.current && globalScale > 0.8) || isHighlighted) {
```

### Step 3: Remove showLabels from Dependency Array

**File: `src/components/graph/GraphView.tsx`** (modify)

Change the dependency array (line 283):
```typescript
// Before:
[highlightCenter, pageId, showLabels, theme, highlightedNodes]

// After:
[highlightCenter, pageId, theme, highlightedNodes]
```

### Step 4: Trigger Canvas Repaint Without Simulation Restart

After toggling `showLabels`, the ForceGraph2D's internal animation loop will naturally repaint the canvas on the next frame. If the simulation has already cooled down and stopped rendering, we may need to force a repaint. Add:

```typescript
// Force a single-frame repaint when labels toggle (without restarting simulation)
useEffect(() => {
  if (graphRef.current) {
    // Nudge alpha just barely above 0 to trigger one repaint cycle
    // without restarting the full simulation
    const fg = graphRef.current;
    if (fg.d3ReheatSimulation) {
      // DON'T use reheat — that restarts the simulation
      // Instead, directly trigger a re-render of the canvas
    }
    // Force re-render by touching a dummy state or calling zoom
    fg.centerAt(undefined, undefined, 0); // No-op center with 0 duration
  }
}, [showLabels]);
```

### Step 5: Apply Same Fix to Graph3DView (if applicable)

**File: `src/components/graph/Graph3DView.tsx`** (modify)

Apply the same ref pattern if `Graph3DView` has a similar dependency issue.

---

## Testing Requirements

### Unit Tests (4+ cases)

**File: `src/__tests__/components/graph/GraphView.test.tsx`**

- `nodeCanvasObject` draws label when showLabelsRef.current = true and globalScale > 0.8
- `nodeCanvasObject` does NOT draw label when showLabelsRef.current = false
- `nodeCanvasObject` always draws label for highlighted nodes regardless of showLabels
- `nodeCanvasObject` callback reference is stable across showLabels changes (same function identity)

### Integration Tests (2+ cases)

- Toggle showLabels → nodes do not change position (x, y coordinates unchanged)
- Toggle showLabels → labels appear/disappear on next canvas frame

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/graph/GraphView.tsx` | Modify | Use ref for showLabels, remove from deps |
| `src/components/graph/Graph3DView.tsx` | Modify | Apply same ref pattern |
| Tests | Create | Unit + integration tests |

---

**Last Updated:** 2026-02-27
