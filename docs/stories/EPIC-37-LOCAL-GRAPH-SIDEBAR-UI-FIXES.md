# EPIC-37: Local Graph Sidebar UI Fixes

## Overview

The compact floating graph window (LocalGraphSidebar) on document pages has several UI issues that degrade usability. The graph is not centered in the container, the minimize functionality is not discoverable, the legend overflows the small window, and the legend position needs adjustment.

## Problems Identified

1. **Graph not centered** — The graph nodes are shifted to the bottom-right corner instead of being centered in the floating window. With many connections (26+), the force simulation spreads nodes beyond the small container, and there is no automatic `zoomToFit` after the simulation finishes.

2. **Missing minimize/collapse arrow** — The floating window previously had a visible minimize arrow but it is no longer apparent to the user. The close (X) button exists but the user expects a left-pointing arrow or similar affordance to minimize the window.

3. **Legend at wrong position** — The `GraphLegend` is positioned at `bottom-4 right-4` inside the graph container. In the small floating window, this overlaps with zoom controls and is visually cramped.

4. **Legend overflows container** — When the legend is expanded, it grows upward from the bottom and extends outside the visible area of the small floating window, making the color labels unreadable.

## Stories

| ID | Title | Points |
|----|-------|--------|
| SKB-37.1 | Auto-center graph with zoomToFit in LocalGraphSidebar | 2 |
| SKB-37.2 | Fix legend position and overflow in compact graph window | 3 |

## Total Points: 5

## Key Files

| File | Purpose |
|------|---------|
| `src/components/graph/LocalGraphSidebar.tsx` | Compact floating graph — needs auto-zoomToFit trigger |
| `src/components/graph/GraphView.tsx` | Core graph — `handleEngineStop` does `centerAt` but no `zoomToFit` |
| `src/components/graph/GraphLegend.tsx` | Legend positioning and expand direction |
| `src/app/(workspace)/pages/[id]/page.tsx` | Floating window container with open/close toggle |
