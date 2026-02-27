# SKB-30.1: Convert Graph Sidebar to Compact Floating Window

**Story ID:** SKB-30.1
**Epic:** [EPIC-30 — Graph Sidebar Compact Window](EPIC-30-GRAPH-SIDEBAR-COMPACT-WINDOW.md)
**Points:** 5
**Priority:** Medium
**Status:** Draft

---

## Summary

The knowledge graph appears as a small square floating window in the top-right corner of the page, showing the graph and depth controls without a full-height overlay.

---

## Acceptance Criteria

- The graph appears as a ~300x300px (or similar square) window in the top-right corner
- The window has rounded corners and a subtle shadow (like a floating card)
- The window has a border matching the app theme
- The graph visualization fills the window (not just 200px of a larger container)
- Depth controls (the slider or +/- buttons) are visible below the graph inside the window
- A close button (X) is visible in the top-right corner of the window
- The toggle button in the page header still opens/closes the graph
- The page content below and to the left of the window is fully visible and interactive (no gray overlay, no blocked clicks)
- The window does NOT scroll with the page — it stays fixed at the top-right as the user scrolls
- The window does not overlap the page header/toolbar
- On narrow screens (< lg breakpoint), the graph window is hidden

---

## Current State (Problem)

The sidebar uses `absolute top-0 right-0 h-full w-[280px]` which creates a full-height overlay column. The graph visualization is only ~250px tall at the top, but the remaining page height is filled with an empty gray/dark background that:
- Hides page content behind it
- Blocks clicks on the underlying page
- Wastes vertical space
- Looks unfinished/broken

Screenshot reference: The "Connections (7)" panel with nodes, depth +/- buttons, and zoom controls sits at the top. Below it is a large empty dark area filling the entire rest of the page height.

---

## Implementation Approach

### 1. Change sidebar container CSS (`page.tsx`)

In `src/app/(workspace)/pages/[id]/page.tsx` (lines ~107-128):

**From:**
```
absolute top-0 right-0 h-full w-[280px] border-l bg-secondary overflow-y-auto
```

**To:**
```
absolute top-16 right-4 w-72 h-80 rounded-xl shadow-xl border bg-secondary overflow-hidden z-30
```

Key changes:
- Remove `h-full` (no more full height)
- Change `top-0` to `top-16` (below page header)
- Change `right-0` to `right-4` (slight inset from edge)
- Add `rounded-xl shadow-xl` for floating window appearance
- Change `border-l` to `border` (border on all sides)
- Change `overflow-y-auto` to `overflow-hidden` (no scrolling in compact window)
- Add `z-30` to layer above page content

### 2. Adjust `LocalGraphSidebar` component

- Change the graph area from fixed `height: 200px` to `flex-1` so it fills the compact window
- Ensure depth controls are compact and fit within the window
- Add a close (X) button to the header area

### 3. Reposition the toggle button

- The toggle button no longer needs to be at `right-[280px]` since the window is compact
- Keep a toggle in the page header area

### 4. Remove overlay shadow

- Remove the `sidebar-overlay-shadow` class if it adds a full-height shadow/overlay effect

---

## Files to Modify

| File | Change |
|------|--------|
| `src/app/(workspace)/pages/[id]/page.tsx` | Change sidebar CSS from full-height to compact floating window |
| `src/components/graph/LocalGraphSidebar.tsx` | Adjust graph area to fill container; add close button |
| `src/app/globals.css` or relevant CSS | Remove or adjust `sidebar-overlay-shadow` if it causes full-height effects |

---

## Do NOT Break

- Graph visualization functionality (zoom, pan, click nodes to navigate)
- Depth controls (must still work)
- Graph data loading from API
- Toggle button to show/hide the graph
- Page content scrolling (must not be blocked)
- Dark/light theme support
- The sidebar toggle transition animation (keep smooth 200ms open/close)

---

## Test Coverage

**Unit Tests:**
- Sidebar container has compact dimensions
- No `h-full` class present
- Has `rounded-xl shadow-xl` classes
- Close button renders and calls toggle handler

**Integration Tests:**
- Graph loads in compact window
- Depth controls functional inside compact window
- Toggle opens/closes the window

**E2E Tests:**
- Open graph, verify compact window appears at top-right
- Verify page content accessible underneath (click elements below the window)
- Close graph via X button and via toggle button
- Scroll page — window stays at top-right

---

## Verification Steps

1. Open any page, click the graph toggle button
2. A small square window appears in the top-right corner with the knowledge graph
3. The graph is interactive (can zoom, pan, click nodes)
4. Depth controls work inside the window
5. Click the X to close the window
6. The page content below the window is fully visible and clickable
7. Scroll down — the window stays at the top-right (does not scroll away)
8. No gray overlay or blocked area below the window
9. Test in both dark mode and light mode

---

**Last Updated:** 2026-02-27
