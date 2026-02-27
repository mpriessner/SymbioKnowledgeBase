# SKB-30.2: Align Toggle Arrows & Keep Header Buttons Visible

**Story ID:** SKB-30.2
**Epic:** [EPIC-30 — Graph Sidebar Compact Window](EPIC-30-GRAPH-SIDEBAR-COMPACT-WINDOW.md)
**Points:** 3
**Priority:** Medium
**Status:** Draft

---

## Summary

The graph sidebar expand/collapse toggle arrows should be at the same vertical height. The sidebar should start below the page header action buttons (Share, Favorite, Download/Export) so those buttons remain visible and clickable when the graph sidebar is open.

---

## Current Problems

### Problem 1: Toggle arrows at different heights

The expand arrow (shown when sidebar is closed) and the collapse arrow (shown when sidebar is open) appear at different vertical positions, even though both use `top-12`:

- **Expand button** (line ~142 in `page.tsx`): `fixed right-0 top-12` — positioned relative to the **viewport**
- **Collapse button** (line ~131 in `page.tsx`): `absolute right-[280px] top-12` — positioned relative to the **parent container**

Because one is `fixed` and one is `absolute`, they reference different coordinate systems. If the parent container has any offset from the viewport top, the buttons won't align.

### Problem 2: Sidebar covers page header buttons

The sidebar container uses `absolute top-0 right-0 h-full` (line ~107 in `page.tsx`), which starts at pixel 0 of its parent — overlapping the page header area where the Share, Favorite, and Download buttons live.

The page header buttons are positioned at `absolute right-4 top-2` inside `PageHeader.tsx` (line ~112). When the sidebar opens, it visually covers these buttons because:
- Sidebar: `z-30`, starts at `top-0`
- Header buttons: `z-10`, at `top-2`

```
CURRENT (sidebar overlaps header buttons):
┌──────────────────────────────────────────────┐
│  Title              [Share][Fav][DL] ← HIDDEN│ ← header buttons under sidebar
│                              │ Graph sidebar │
│                              │ covers these  │
│                              │               │
└──────────────────────────────────────────────┘

DESIRED (sidebar starts below header):
┌──────────────────────────────────────────────┐
│  Title              [Share][Fav][DL] ← visible│ ← always accessible
│                              ┌───────────────│
│                              │ Graph sidebar │
│                              │ starts below  │
│                              └───────────────│
└──────────────────────────────────────────────┘
```

---

## Acceptance Criteria

- The expand arrow (>) and collapse arrow (<) are at exactly the same vertical position on screen
- Both arrows should be at the **lower** position (matching where the collapse arrow currently appears)
- When the graph sidebar is open, the Share, Favorite, and Download/Export buttons in the page header are fully visible and clickable
- The sidebar container starts below the page header action buttons area
- The toggle arrow does not overlap or cover any header buttons
- Both dark and light mode display correctly
- The transition animation (open/close) still works smoothly

---

## Implementation Approach

### Fix 1: Unify toggle button positioning

Both buttons should use the same positioning scheme (`absolute`, not `fixed`) and the same `top` value that clears the page header buttons:

**In `page.tsx`:**
- **Expand button** (line ~142): change from `fixed right-0 top-12` to `absolute right-0 top-16` (or whatever value clears the header)
- **Collapse button** (line ~131): change from `absolute right-[280px] top-12` to `absolute right-[280px] top-16`
- Both use `absolute` and the same `top-16` value — guaranteed alignment

### Fix 2: Lower the sidebar container start position

**In `page.tsx`:**
- **Sidebar container** (line ~107): change from `absolute top-0 right-0 h-full` to `absolute top-14 right-0` (or `top-16`)
- The `top` value should place the sidebar below the header buttons row
- Adjust `h-full` to `h-[calc(100%-3.5rem)]` (or use bottom-0) so the sidebar fills the remaining height correctly

### Fix 3: Ensure header buttons z-index

**In `PageHeader.tsx`:**
- Verify the header buttons container (`absolute right-4 top-2 z-10`) has a z-index equal to or greater than the sidebar, OR
- The sidebar simply starts below them (no overlap = no z-index issue)

---

## Files to Modify

| File | Change |
|------|--------|
| `src/app/(workspace)/pages/[id]/page.tsx` | Align both toggle buttons to same `top` value; lower sidebar start to `top-14` or `top-16`; make both buttons use `absolute` positioning |
| `src/components/workspace/PageHeader.tsx` | Optionally increase z-index on action buttons if needed |

---

## Do NOT Break

- Graph sidebar open/close toggle functionality
- Graph visualization (zoom, pan, click nodes)
- Depth controls (+ / - buttons)
- Graph data loading from API
- Page content scrolling
- Dark/light theme support
- Smooth 200ms open/close transition animation
- Page header breadcrumb and title display
- Share dialog, Favorite toggle, and Download/Export functionality

---

## Test Coverage

**Unit Tests:**
- Both toggle buttons have the same `top-*` class value
- Sidebar container does not use `top-0`
- Both buttons use `absolute` positioning (not mixed `fixed`/`absolute`)

**Integration Tests:**
- Header buttons (Share, Favorite, Download) are visible and clickable when sidebar is open
- Toggle buttons appear at the same Y coordinate

**E2E Tests:**
1. Open a page, verify Share/Favorite/Download buttons visible
2. Click the expand arrow to open graph sidebar
3. Share/Favorite/Download buttons are still visible and clickable
4. The expand arrow and collapse arrow appear at the same height
5. Click collapse arrow — sidebar closes, expand arrow returns at same position
6. Click Share button while sidebar is open — Share dialog opens (not blocked)

---

## Verification Steps

1. Open any page with content
2. Note the position of the graph toggle arrow (>) on the right edge
3. Click it to expand the sidebar
4. The collapse arrow (<) should be at exactly the same height as where the expand arrow was
5. The Share, Favorite, and Download buttons in the header should all be visible
6. Click the Share button — it should open the share dialog (proving it's not covered)
7. Close the sidebar — verify the expand arrow returns to the same position
8. Test in both dark and light mode

---

**Last Updated:** 2026-02-27
