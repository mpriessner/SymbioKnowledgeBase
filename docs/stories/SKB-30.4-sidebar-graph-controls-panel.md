# SKB-30.4: Sidebar Graph Controls Panel

**Story ID:** SKB-30.4
**Epic:** [EPIC-30 — Graph Sidebar Compact Window](EPIC-30-GRAPH-SIDEBAR-COMPACT-WINDOW.md)
**Points:** 5
**Priority:** Medium
**Status:** Draft

---

## Summary

The sidebar graph (LocalGraphSidebar) should have a small settings/controls panel below the graph canvas. This panel provides a 2D/3D view toggle, zoom controls, and a node size slider — allowing users to customize the graph visualization without leaving the page.

---

## Current State

**File:** `src/components/graph/LocalGraphSidebar.tsx`

The sidebar graph currently has:
- Depth controls (- / + buttons, top-left overlay, lines 125-154)
- Zoom controls (zoom in / zoom out / fit-to-view, top-right overlay, lines 157-188)
- Fixed 200px height canvas with `GraphView` (2D only, line 192-199)

**Missing:**
- No 2D/3D toggle — only 2D (`GraphView`) is used; `Graph3DView` exists but isn't wired in
- No node size slider — node sizes are hardcoded (`getNodeRadius(linkCount, 3)` in GraphView)
- Controls float as overlays on the graph canvas, which works but can obscure nodes in a small graph

**Related components:**
- `src/components/graph/GraphView.tsx` — 2D graph (uses `react-force-graph-2d`, `getNodeRadius(node.linkCount, 3)` at line 216)
- `src/components/graph/Graph3DView.tsx` — 3D graph (uses `react-force-graph-3d`, fixed `nodeRelSize={4}` at line 184)
- `src/lib/graph/colorPalette.ts` — `getNodeRadius(linkCount, baseRadius)` function (lines 49-54)

---

## Acceptance Criteria

- A small controls panel appears below the graph canvas in the sidebar
- The panel includes:
  1. **2D / 3D toggle** — switches between `GraphView` (2D) and `Graph3DView` (3D)
  2. **Node size slider** — adjusts the base radius of all nodes (range: 1-10, default: 3)
  3. **Existing depth controls** — moved from the overlay to the panel (cleaner layout)
- The 3D view works within the sidebar's compact dimensions
- The node size slider affects nodes in real-time (no save/reload needed)
- Controls panel is collapsible or always visible (depending on space)
- Zoom controls remain as overlay on the graph (they relate to the canvas directly)
- Settings persist in localStorage so the user's preferences are remembered

---

## Implementation Approach

### 1. Add 2D/3D toggle state

In `LocalGraphSidebar.tsx`:

```typescript
const [is3D, setIs3D] = useState(false);
const [nodeSize, setNodeSize] = useState(3); // base radius
```

Render either `GraphView` or `Graph3DView` based on `is3D`:

```tsx
{is3D ? (
  <Graph3DView pageId={pageId} depth={depth} height={200} nodeRelSize={nodeSize} />
) : (
  <GraphView pageId={pageId} depth={depth} height={200} baseNodeRadius={nodeSize} />
)}
```

### 2. Pass node size to graph components

**GraphView.tsx:** Accept a `baseNodeRadius` prop and use it instead of the hardcoded `3`:
```typescript
getNodeRadius(node.linkCount, baseNodeRadius) // instead of getNodeRadius(node.linkCount, 3)
```

**Graph3DView.tsx:** Accept a `nodeRelSize` prop (already exists at line 184, just make it dynamic).

### 3. Add controls panel below graph

```tsx
{/* Controls panel */}
<div className="px-3 py-2 border-t border-[var(--border-default)] flex items-center gap-3">
  {/* 2D/3D toggle */}
  <button onClick={() => setIs3D(!is3D)} className="text-xs ...">
    {is3D ? '3D' : '2D'}
  </button>

  {/* Node size slider */}
  <label className="flex items-center gap-1 text-xs">
    <span>Size</span>
    <input
      type="range"
      min={1} max={10} value={nodeSize}
      onChange={(e) => setNodeSize(Number(e.target.value))}
      className="w-16 h-1"
    />
  </label>

  {/* Depth controls (moved from overlay) */}
  <div className="flex items-center gap-1 ml-auto">
    <button onClick={decreaseDepth}>-</button>
    <span>{depth}</span>
    <button onClick={increaseDepth}>+</button>
  </div>
</div>
```

### 4. Persist settings

```typescript
useEffect(() => {
  localStorage.setItem('skb-graph-sidebar-settings', JSON.stringify({ is3D, nodeSize }));
}, [is3D, nodeSize]);
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/graph/LocalGraphSidebar.tsx` | Add 2D/3D toggle, node size slider, controls panel below graph; conditionally render GraphView or Graph3DView |
| `src/components/graph/GraphView.tsx` | Accept `baseNodeRadius` prop instead of hardcoded `3` |
| `src/components/graph/Graph3DView.tsx` | Accept dynamic `nodeRelSize` prop |

---

## Do NOT Break

- Graph data loading (useGraphData hook)
- Node click navigation
- Zoom in/out/fit controls
- Depth controls (+ / -)
- Graph rendering performance
- "Open full graph" link
- Collapse/expand sidebar graph section
- Dark/light theme support

---

## Test Coverage

**Unit Tests:**
- 2D/3D toggle switches between GraphView and Graph3DView
- Node size slider updates baseNodeRadius prop
- Settings persist in localStorage

**Integration Tests:**
- GraphView renders with custom baseNodeRadius
- Graph3DView renders with custom nodeRelSize
- Controls panel visible below graph canvas

**E2E Tests:**
1. Open a page with connections
2. Sidebar graph shows 2D view (default)
3. Click "3D" toggle — graph switches to 3D
4. Adjust node size slider — nodes change size in real-time
5. Refresh page — settings are remembered
6. Switch back to "2D" — graph returns to 2D view

---

## Verification Steps

1. Open any page that has graph connections
2. The sidebar graph shows the 2D graph (default)
3. Below the graph, a controls panel is visible with:
   - 2D/3D toggle button
   - Node size slider
   - Depth controls (- / number / +)
4. Click the 3D toggle — the graph switches to a 3D view
5. Drag the node size slider — nodes get larger or smaller in real-time
6. Adjust depth — more or fewer connected nodes appear
7. Refresh the page — your 2D/3D and node size settings are preserved
8. Test in both light and dark mode

---

**Last Updated:** 2026-02-27
