# SKB-30.3: Align Page Header Buttons with Breadcrumbs

**Story ID:** SKB-30.3
**Epic:** [EPIC-30 — Graph Sidebar Compact Window](EPIC-30-GRAPH-SIDEBAR-COMPACT-WINDOW.md)
**Points:** 3
**Priority:** Medium
**Status:** Draft

---

## Summary

The Share, Favorite, and Download/Export buttons in the page header are positioned at a different vertical level than the breadcrumb bar (Home > Parent > Page Title). The breadcrumbs sit in one row and the action buttons float separately below/above them. They should all be on the same horizontal line for a clean, consistent header.

---

## Current Problem

**Layout structure (two separate vertical levels):**

```
┌────────────────────────────────────────────────────────┐
│  🏠 > Parent > Page Title                              │  ← Breadcrumbs (BreadcrumbsWrapper)
├────────────────────────────────────────────────────────┤
│                                    [↓] [★] [Share]     │  ← Action buttons (PageHeader)
│                                                        │
│  📄 Page Title (editable h1)                           │
└────────────────────────────────────────────────────────┘
```

**Root cause:**

The breadcrumbs and action buttons live in completely separate components with independent positioning:

1. **Breadcrumbs:** Rendered by `BreadcrumbsWrapper` inside the workspace layout (`layout.tsx`), sitting *above* the page content as a normal flow element with `py-2`

2. **Action buttons:** Rendered inside `PageHeader.tsx` (line 113) using `absolute right-4 top-2 z-10` — positioned absolutely within the scrollable content area, not relative to the breadcrumb bar

Because the breadcrumbs are in the layout and the buttons are absolutely positioned inside the page scroll container, they end up at different heights.

**Files involved:**
- `src/app/(workspace)/layout.tsx` — renders `<BreadcrumbsWrapper />` then `{children}`
- `src/components/workspace/BreadcrumbsWrapper.tsx` — renders breadcrumb nav with `py-2`
- `src/components/workspace/Breadcrumbs.tsx` — breadcrumb row: `flex items-center w-full content-pad py-2`
- `src/components/workspace/PageHeader.tsx` — action buttons: `absolute right-4 top-2 z-10` (line 113)
- `src/app/(workspace)/pages/[id]/page.tsx` — page view container

---

## Desired Layout

```
┌────────────────────────────────────────────────────────┐
│  🏠 > Parent > Page Title          [↓] [★] [Share]    │  ← Same row, same height
├────────────────────────────────────────────────────────┤
│                                                        │
│  📄 Page Title (editable h1)                           │
│                                                        │
│  Page content...                                       │
└────────────────────────────────────────────────────────┘
```

---

## Acceptance Criteria

- The breadcrumbs (Home icon, parent links, current page name) and the action buttons (Download, Favorite, Share) appear on the same horizontal line
- The breadcrumbs are left-aligned, action buttons are right-aligned, within the same row
- On narrow screens, the breadcrumbs truncate (existing ellipsis behavior) before overlapping buttons
- The action buttons do NOT scroll with the page content — they stay fixed at the top
- Both dark and light mode display correctly
- The graph sidebar toggle arrow does not overlap the action buttons (relates to SKB-30.2)

---

## Implementation Approach

### Option A: Move action buttons into the breadcrumb bar

1. **`Breadcrumbs.tsx`** — Accept an optional `actions` slot or render children
2. **`BreadcrumbsWrapper.tsx`** — Pass the action buttons (Download, Favorite, Share) as a right-aligned section
3. **`PageHeader.tsx`** — Remove the `absolute right-4 top-2 z-10` action buttons div; move the button JSX to a new exported component (e.g., `PageActions`)
4. **`layout.tsx` or `page.tsx`** — Wire `PageActions` into the breadcrumb bar

### Option B: Create a unified top bar component

1. Create a `PageTopBar` component that contains both breadcrumbs (left) and action buttons (right) in a single `flex items-center justify-between` row
2. Render `PageTopBar` in `page.tsx` or `layout.tsx` as a non-scrolling fixed header
3. Remove the absolute positioning from `PageHeader.tsx`

### Recommended: Option A

It's less disruptive — the breadcrumb bar already exists as a non-scrolling element in the layout. We just need to add the action buttons to its right side.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/workspace/PageHeader.tsx` | Remove absolute-positioned action buttons div (line 113); export action buttons as separate component |
| `src/components/workspace/Breadcrumbs.tsx` | Add right-aligned slot for action buttons; change to `flex items-center justify-between` |
| `src/components/workspace/BreadcrumbsWrapper.tsx` | Pass page data and render action buttons in the breadcrumb bar |
| `src/app/(workspace)/pages/[id]/page.tsx` | Possibly pass page data up to the breadcrumb bar |

---

## Do NOT Break

- Breadcrumb navigation (clicking ancestors)
- Breadcrumb truncation with "..." for deep hierarchies
- Page title editing (contentEditable h1 in PageHeader)
- Cover image and icon management in PageHeader
- Share dialog functionality
- Favorite toggle
- Export/Download functionality
- Graph sidebar toggle (SKB-30.2)
- Dark/light mode theming

---

## Test Coverage

**Unit Tests:**
- Action buttons render inside the breadcrumb bar, not as absolute-positioned elements
- Breadcrumbs and action buttons are in the same flex container

**Integration Tests:**
- Action buttons visible at same Y position as breadcrumbs
- Buttons remain accessible when scrolling page content

**E2E Tests:**
1. Open a page with a deep breadcrumb path
2. Verify Share, Favorite, Download buttons are on the same row as breadcrumbs
3. Scroll page content — buttons stay at the top
4. Click Share — dialog opens correctly
5. Click Favorite — toggles correctly
6. Click Download — export works

---

## Verification Steps

1. Open any page with at least one parent (so breadcrumbs show)
2. The Home icon, breadcrumb path, and the Share/Favorite/Download buttons should all be on the same horizontal line
3. Scroll the page content down — the buttons should stay fixed at the top
4. Click each button to verify they still work
5. Test with both short and long breadcrumb paths
6. Test in dark mode

---

**Last Updated:** 2026-02-27
