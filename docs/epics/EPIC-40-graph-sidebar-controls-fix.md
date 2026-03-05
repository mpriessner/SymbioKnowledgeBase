# EPIC-40: Graph Sidebar Layout and Controls Fix

## Goal

Fix four layout and interaction bugs in the compact local graph sidebar that appears
on individual page views, ensuring the graph renders centered, the legend displays
correctly, and all controls (2D/3D toggle, size slider, depth buttons) are clickable.

## Background

The `LocalGraphSidebar` component renders inside a fixed `w-72 h-80` container on
the page detail view. Several layout issues prevented proper use:

1. **Legend misplaced** -- The `GraphLegend` (showing "Xn . Ye") is positioned with
   `absolute bottom-4 left-4` inside `GraphView`, but the sidebar root div lacked
   `h-full`, so the containing chain had no proper height constraint and `bottom-4`
   resolved incorrectly (legend appeared at the top).

2. **Graph not centered on load** -- `GraphView.handleEngineStop` called
   `zoomToFit(400, 30)` with 30px padding, which is too generous for a ~240px-tall
   container. The result was the graph being pushed to the top-left corner.

3. **2D/3D toggle unclickable** -- The graph area div (`relative flex-1 min-h-0`)
   lacked `overflow-hidden`, so the `<canvas>` element overflowed its container and
   captured pointer events over the controls panel below it.

4. **Size slider unclickable** -- Same root cause as the toggle: canvas overflow
   covered the entire controls row.

## Stories

| ID | Title | Points |
|----|-------|--------|
| SKB-40.1 | Add `h-full` to LocalGraphSidebar root to fix legend and layout | 1 |
| SKB-40.2 | Add `overflow-hidden` to graph area and `z-10` to controls panel | 1 |
| SKB-40.3 | Add `fitPadding` prop to GraphView and use 10px for compact sidebar | 1 |
| SKB-40.4 | Add `hideLegend` prop to GraphView for sidebar context | 1 |

## Changes Made

### `src/components/graph/LocalGraphSidebar.tsx`

- **Line 101**: Added `h-full` to root div so flexbox height chain resolves correctly
  within the parent `h-80` container.
- **Line 169**: Added `overflow-hidden` to the graph area div to clip the canvas and
  prevent it from overlapping the controls panel.
- **Line 230**: Added `relative z-10 bg-[var(--bg-secondary)]` to the controls panel
  so it always renders above any residual canvas overflow.
- **Lines 224-225**: Passes `fitPadding={10}` and `hideLegend={true}` to `GraphView`
  for compact rendering.

### `src/components/graph/GraphView.tsx`

- **Props**: Added `fitPadding` (default 30) and `hideLegend` (default false) props.
- **Line 463**: `handleEngineStop` now uses `fitPadding` instead of hardcoded 30.
- **Lines 536-542**: `GraphLegend` rendering is conditional on `!hideLegend`.

## Success Criteria

- Graph renders centered within the sidebar on initial load
- 2D/3D toggle button responds to clicks and switches view mode
- Size slider responds to drag and changes node sizes
- Depth +/- buttons remain functional
- Legend does not appear in compact sidebar (it clutters the small view)
- Full-page graph view is unaffected (still shows legend, uses 30px padding)
- Works in both light and dark modes
