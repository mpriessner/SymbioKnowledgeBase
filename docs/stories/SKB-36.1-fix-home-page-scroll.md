# Story SKB-36.1: Fix Home Page Scroll

**Epic:** Epic 36 - UI Bug Fixes — Home Page Scroll & Dark Mode Visibility
**Story ID:** SKB-36.1
**Story Points:** 2 | **Priority:** High | **Status:** Draft
**Depends On:** Nothing

---

## User Story

As a SymbioKnowledgeBase user, I want to scroll through the entire "All Pages" list on the home page, so that I can see and access all my pages regardless of how many exist.

---

## Acceptance Criteria

### Scroll Behavior
- [ ] The home page "All Pages" section scrolls vertically to show all pages
- [ ] Scrolling is smooth and native (no custom scroll libraries needed)
- [ ] The sidebar remains fixed and does not scroll with the main content
- [ ] The breadcrumb bar at the top remains visible while scrolling content
- [ ] All four home page sections (Greeting, Recently Visited, Quick Actions, All Pages) are accessible by scrolling
- [ ] Works correctly with any number of pages (tested with 10, 20, 50+)

### Layout Integrity
- [ ] The sidebar width and behavior are unchanged
- [ ] No horizontal scrollbar appears on the main content area
- [ ] The recently visited horizontal scroll still works correctly
- [ ] No visual glitches when scrolling (no content clipping, no z-index issues)
- [ ] Other workspace pages (page editor, graph view, settings) are unaffected

---

## Root Cause Analysis

```
Current layout structure (broken):
──────────────────────────────────

<div class="flex h-screen w-screen overflow-hidden">   ← clips ALL overflow
  <Sidebar />
  <main class="workspace-main flex-1 min-w-0 flex flex-col">  ← no overflow scroll
    <BreadcrumbsWrapper />
    {children}                                          ← home page content grows past viewport
  </main>
</div>

Problem:
- The outer div has `overflow-hidden` to prevent the sidebar layout from breaking
- But `main` has no `overflow-y: auto`, so when {children} is taller than viewport, it's clipped
- The home page (`src/app/(workspace)/home/page.tsx`) uses `min-h-full` on its root container
- With many pages in "All Pages", content exceeds viewport height → clipped → can't scroll
```

---

## Architecture Overview

```
Fixed layout structure:
───────────────────────

<div class="flex h-screen w-screen overflow-hidden">   ← KEEP: prevents sidebar overflow
  <Sidebar />
  <main class="workspace-main flex-1 min-w-0 flex flex-col overflow-hidden">
    <BreadcrumbsWrapper />                              ← stays fixed at top
    <div class="flex-1 overflow-y-auto">                ← NEW: scrollable content wrapper
      {children}                                        ← scrolls within this container
    </div>
  </main>
</div>

Why this works:
- Outer div still clips sidebar overflow (intentional)
- BreadcrumbsWrapper stays pinned at top of main
- New wrapper div takes remaining flex space (flex-1) and enables vertical scroll
- Children render inside the scrollable area
- Sidebar is completely unaffected
```

---

## Implementation Steps

### Step 1: Wrap Children in Scrollable Container

**File: `src/app/(workspace)/layout.tsx`** (modify)

Current code (line 15-20):
```tsx
<div className="flex h-screen w-screen overflow-hidden">
  <Sidebar />
  <main className="workspace-main flex-1 min-w-0 flex flex-col">
    <BreadcrumbsWrapper />
    {children}
  </main>
</div>
```

Changed code:
```tsx
<div className="flex h-screen w-screen overflow-hidden">
  <Sidebar />
  <main className="workspace-main flex-1 min-w-0 flex flex-col overflow-hidden">
    <BreadcrumbsWrapper />
    <div className="flex-1 overflow-y-auto">
      {children}
    </div>
  </main>
</div>
```

Changes:
1. Add `overflow-hidden` to `<main>` — ensures main itself doesn't overflow; delegates scrolling to the inner wrapper
2. Wrap `{children}` in a `<div className="flex-1 overflow-y-auto">` — this div takes remaining vertical space and allows vertical scrolling

### Step 2: Verify Home Page Content Renders Correctly

**File: `src/app/(workspace)/home/page.tsx`** (no changes expected)

The home page root container uses `min-h-full` which means:
- In the old layout: it tried to be at least as tall as the viewport but was clipped
- In the new layout: it can grow beyond the wrapper height and scroll naturally

Verify that `min-h-full` still works correctly — it should fill the scrollable area when content is short, and grow naturally when content is long.

### Step 3: Verify Other Workspace Pages

Check that these pages still render correctly with the new scroll wrapper:
- **Page editor** (`src/app/(workspace)/pages/[id]/page.tsx`) — should scroll its own content
- **Graph view** (`src/app/(workspace)/graph/page.tsx`) — typically fills viewport, should be unaffected
- **Settings** (`src/app/(workspace)/settings/page.tsx`) — may have its own scroll

Each page may have its own `overflow-y-auto` or fixed-height containers. The new wrapper should not interfere because:
- If a child has `h-full` or `flex-1`, it will fill the wrapper
- If a child has its own `overflow-y-auto`, the outer scroll and inner scroll should coexist (but verify no double-scrollbar)

### Step 4: Test Edge Cases

- **Empty state:** No pages → home page is short → no scroll needed → verify no empty space issues
- **Few pages:** 3-5 pages → content fits viewport → verify no unnecessary scrollbar
- **Many pages:** 20+ pages → content exceeds viewport → verify scroll works
- **Window resize:** Shrink window → scroll appears → expand → scroll disappears (or scrollbar shrinks)
- **Mobile viewport:** If responsive, verify scroll works at narrow widths

---

## Testing Requirements

### Manual Verification (Primary)

Since this is a CSS layout fix, manual visual verification is the most effective test:

1. Open the home page with 15+ pages created
2. Verify the "All Pages" section extends below the fold
3. Scroll down → all pages visible
4. Scroll up → greeting and recently visited sections visible
5. Sidebar remains fixed during scroll
6. Breadcrumb bar remains visible during scroll
7. Navigate to a page editor → verify editor scrolls correctly
8. Navigate to graph view → verify graph fills viewport correctly
9. Resize browser window → scroll behavior adapts

### Unit Tests (2 cases)

**File: `src/__tests__/app/layout.test.tsx`**

- Layout renders with scroll wrapper around children
- Main element has `overflow-hidden` class

### Visual Regression (if available)

- Screenshot home page with 20+ pages → compare before/after
- Screenshot page editor → verify unchanged
- Screenshot graph view → verify unchanged

---

## Risk Assessment

**Risk: Double scrollbar on page editor**
- The page editor may have its own `overflow-y-auto` on the editor container
- If both the wrapper and the editor scroll, users get confusing double scrollbars
- **Mitigation:** The page editor likely uses `h-full` to fill available space, so the wrapper scroll won't activate. Verify during testing.

**Risk: Graph view height changes**
- The graph view expects to fill the exact viewport height for the canvas
- Adding a scroll wrapper could change the available height
- **Mitigation:** The graph view likely uses `h-full` or `flex-1` to fill space. The wrapper's `flex-1` gives it the same available space as before. Verify during testing.

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/app/(workspace)/layout.tsx` | Modify | Add overflow-hidden to main, wrap children in scrollable div |

---

**Last Updated:** 2026-02-27
