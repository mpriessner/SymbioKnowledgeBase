# Epic 30: Graph Sidebar — Compact Floating Window

**Epic ID:** EPIC-30
**Created:** 2026-02-25
**Total Story Points:** 5
**Priority:** Medium
**Status:** Draft

---

## Epic Overview

The knowledge graph sidebar currently takes the **full height** of the page when opened. Below the actual graph area (which is only 200px tall), the rest of the sidebar is empty/grayed out space. The user wants the graph to appear as a **small, compact square window** in the top-right corner — showing just the graph and its controls, without the full-height gray overlay filling the rest of the page.

**Current behavior:**
```
┌─────────────────────────────────────────────────┐
│  Page Content                        │ Graph   │
│                                      │ (200px) │
│                                      │─────────│
│                                      │         │
│                                      │ (empty  │
│                                      │  gray   │
│                                      │  space) │
│                                      │         │
│                                      │         │
└─────────────────────────────────────────────────┘
```

**Desired behavior:**
```
┌─────────────────────────────────────────────────┐
│  Page Content                     ┌───────────┐ │
│                                   │   Graph   │ │
│                                   │  (square) │ │
│                                   │  Controls │ │
│                                   └───────────┘ │
│                                                 │
│  Page content continues underneath,             │
│  no gray overlay below the graph                │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Current CSS:** `absolute top-0 right-0 h-full w-[280px]` — full-height overlay
**Desired CSS:** `absolute top-16 right-4 w-72 h-72 rounded-lg shadow-lg` — compact floating window

---

## Business Value

- Less visual clutter — the graph window doesn't dominate the page
- More content visible while graph is open
- Professional appearance matching modern app patterns (floating panels)
- The grayed-out empty space below the graph is wasted and confusing

---

## Stories Breakdown

### SKB-30.1: Convert Graph Sidebar to Compact Floating Window — 5 points, Medium

**Delivers:** The knowledge graph appears as a small square floating window in the top-right corner of the page, showing the graph and depth controls without a full-height overlay.

**Acceptance Criteria:**
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

**Implementation approach:**
1. In `src/app/(workspace)/pages/[id]/page.tsx` (lines ~107-128):
   - Change the sidebar container from:
     ```
     absolute top-0 right-0 h-full w-[280px] border-l bg-secondary overflow-y-auto
     ```
   - To:
     ```
     absolute top-16 right-4 w-72 h-80 rounded-xl shadow-xl border bg-secondary overflow-hidden z-30
     ```
   - Remove `h-full` (no more full height)
   - Add `rounded-xl shadow-xl` for floating window appearance
   - Change `border-l` to `border` (border on all sides)
   - Change `overflow-y-auto` to `overflow-hidden` (no scrolling in compact window)
2. Adjust the `LocalGraphSidebar` component:
   - Change the graph area from fixed `height: 200px` to `flex-1` so it fills the compact window
   - Ensure depth controls are compact and fit within the window
   - Add a close (X) button to the header
3. Reposition or remove the toggle button:
   - The toggle button no longer needs to be at `right-[280px]` since the window is compact
   - Keep a toggle in the page header area
4. Remove the `sidebar-overlay-shadow` class if it adds a full-height shadow/overlay effect

**Files to modify:**
| File | Change |
|------|--------|
| `src/app/(workspace)/pages/[id]/page.tsx` | Change sidebar CSS from full-height to compact floating window |
| `src/components/graph/LocalGraphSidebar.tsx` | Adjust graph area to fill container; add close button |
| `src/app/globals.css` or relevant CSS | Remove or adjust `sidebar-overlay-shadow` if it causes full-height effects |

**Do NOT break:**
- Graph visualization functionality (zoom, pan, click nodes to navigate)
- Depth controls (must still work)
- Graph data loading from API
- Toggle button to show/hide the graph
- Page content scrolling (must not be blocked)
- Dark/light theme support
- The sidebar toggle transition animation (keep smooth 200ms open/close)

**Verification:**
1. Open any page, click the graph toggle button
2. A small square window appears in the top-right corner with the knowledge graph
3. The graph is interactive (can zoom, pan, click nodes)
4. Depth controls work inside the window
5. Click the X to close the window
6. The page content below the window is fully visible and clickable
7. Scroll down — the window stays at the top-right (does not scroll away)
8. No gray overlay or blocked area below the window

---

## Test Coverage Requirements

| Story | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 30.1 | Sidebar container has compact dimensions; no `h-full` class; has `rounded-xl shadow-xl` | Graph loads in compact window; depth controls functional | Open graph, verify compact window, verify page content accessible underneath, close graph |

---

## Shared Constraints

- **No Breaking Changes:** Graph functionality (zoom, pan, node clicks, depth control) must all work in the smaller container
- **Theming:** Floating window must look correct in both light and dark themes (shadow, border, background)
- **Responsive:** Hidden on screens < lg breakpoint (existing behavior)
- **Z-Index:** Window must be above page content but below modals/dialogs/dropdowns
- **Performance:** No change to graph rendering performance — same canvas size or smaller

---

## Files Modified by This Epic

| File | Action | Description |
|------|--------|-------------|
| `src/app/(workspace)/pages/[id]/page.tsx` | Modify | Change sidebar from full-height to compact floating window CSS |
| `src/components/graph/LocalGraphSidebar.tsx` | Modify | Adjust graph to fill container; add close button |
| CSS files | Possibly Modify | Remove full-height overlay shadow |

---

**Last Updated:** 2026-02-25
