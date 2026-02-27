# SKB-37.1: Auto-Center Graph with zoomToFit in LocalGraphSidebar

**Epic:** EPIC-37 — Local Graph Sidebar UI Fixes
**Points:** 2
**Priority:** High

## Problem

When the compact floating graph window loads on a document page, the graph is not centered. Nodes are shifted to the bottom-right corner, making it appear that the graph is empty or broken. The user only sees one or two nodes and a large empty dark area.

### Root Cause

In `GraphView.tsx`, the `handleEngineStop` callback (lines 380-391) pins the center node at `(0,0)` and calls `centerAt(0, 0, 1000)`, but it never calls `zoomToFit()`. With many connections (26+), nodes spread far beyond the small 288x320px container. The `centerAt` call centers on coordinate (0,0) but does not adjust the zoom level to fit all nodes.

Additionally, the `onClose` button (X icon) in `LocalGraphSidebar` is functional but not very discoverable. The user previously expected a minimize arrow on the left side of the window.

## Solution

### 1. Add zoomToFit after engine stabilizes

**File:** `src/components/graph/GraphView.tsx`

In `handleEngineStop`, after centering on the center node, call `zoomToFit` to ensure all nodes are visible within the container:

```typescript
const handleEngineStop = useCallback(() => {
  if (highlightCenter && pageId && graphRef.current) {
    const centerNode = graphData.nodes.find(
      (n: ForceGraphNode) => n.id === pageId
    );
    if (centerNode) {
      (centerNode as ForceGraphNode).fx = 0;
      (centerNode as ForceGraphNode).fy = 0;
    }
    // Fit all nodes into view, then center on the pinned center node
    graphRef.current.zoomToFit(400, 30);
  }
}, [highlightCenter, pageId, graphData.nodes]);
```

The padding of `30` gives breathing room around the edges. The `zoomToFit` should be called instead of (or after) `centerAt` so the zoom level adjusts automatically.

### 2. Add a minimize arrow to the floating window

**File:** `src/app/(workspace)/pages/[id]/page.tsx`

Replace or supplement the X close button with a more discoverable left-pointing chevron arrow on the left side of the floating window header that minimizes (hides) the window:

```tsx
{/* Inside the floating window container, add a minimize arrow */}
<button
  onClick={() => setShowRightSidebar(false)}
  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 ..."
  title="Minimize graph"
>
  <ChevronRight /> {/* Points right = "collapse to the right" */}
</button>
```

Alternatively, the `onClose` prop on `LocalGraphSidebar` can be wired to show a left-arrow icon instead of an X.

## Acceptance Criteria

- [ ] When a document page loads, the compact graph auto-fits all nodes within the visible area
- [ ] The center (current page) node is visible and roughly centered
- [ ] No nodes are cut off or invisible in the default view
- [ ] A visible minimize/collapse affordance allows the user to hide the floating window
- [ ] When minimized, a small toggle button appears to re-open the window (existing behavior)

## Files to Modify

| File | Change |
|------|--------|
| `src/components/graph/GraphView.tsx` | Replace `centerAt` with `zoomToFit` in `handleEngineStop` |
| `src/app/(workspace)/pages/[id]/page.tsx` | Optionally add a more discoverable minimize arrow |
| `src/components/graph/LocalGraphSidebar.tsx` | Optionally adjust `onClose` icon from X to chevron |

## Testing

1. Navigate to any page with 10+ connections
2. The floating graph window should show all nodes centered and visible
3. Click the minimize button — window should hide
4. Click the toggle button — window should reappear with graph still centered
5. Test with pages that have 1-2 connections and 20+ connections to verify scaling works
