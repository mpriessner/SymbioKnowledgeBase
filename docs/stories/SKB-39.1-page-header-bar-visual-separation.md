# SKB-39.1: Visual Separation and Action Alignment in Page Header Bar

**Epic:** EPIC-39 — Page Header Bar Polish
**Points:** 2
**Priority:** High

## Problem

The page header bar (breadcrumb row with Home icon, page ancestry trail, and action
buttons) has no visual distinction from the scrollable page content below. This makes
the Download, Favorite, and Share buttons appear to be "on the page" rather than in the
persistent header.

In the current layout (`src/app/(workspace)/layout.tsx`), the `BreadcrumbsWrapper` sits
above the scrollable `<div className="flex-1 overflow-y-auto">`, but the `<nav>` element
in `Breadcrumbs.tsx` only applies `content-pad py-2` — no border, background, or shadow
to separate it from the content area.

### Current Layout Structure

```
WorkspaceLayout (layout.tsx)
  ├─ BreadcrumbsWrapper (non-scrollable header)
  │   └─ Breadcrumbs <nav className="flex items-center justify-between w-full content-pad py-2">
  │       ├─ Home > breadcrumb trail (left)
  │       └─ PageActions: Download, Favorite, Share (right)  ← visually ambiguous
  └─ <div className="flex-1 overflow-y-auto"> (scrollable content)
      └─ PageView → PageHeader, PageContent, etc.
```

### What the User Sees

The breadcrumb trail ("Home > Changelog") and action buttons (Download, Favorite, Share)
sit directly above the page content (cover image, icon, title) with no visual boundary.
The buttons look like they belong to the page itself.

## Solution

### 1. Add a bottom border to the breadcrumb nav

**File:** `src/components/workspace/Breadcrumbs.tsx`

Add a subtle bottom border to the `<nav>` element to visually separate the header bar
from the scrollable content:

```diff
- <nav aria-label="Breadcrumb" className="flex items-center justify-between w-full content-pad py-2">
+ <nav aria-label="Breadcrumb" className="flex items-center justify-between w-full content-pad py-2 border-b border-[var(--border-default)]">
```

### 2. Add a light background to the header bar

Optionally, give the header bar a distinct background color to reinforce its role as a
persistent toolbar:

```diff
- <nav aria-label="Breadcrumb" className="flex items-center justify-between w-full content-pad py-2 border-b border-[var(--border-default)]">
+ <nav aria-label="Breadcrumb" className="flex items-center justify-between w-full content-pad py-2 border-b border-[var(--border-default)] bg-[var(--bg-primary)]">
```

### 3. Ensure action buttons have consistent styling

**File:** `src/components/workspace/PageHeader.tsx` (`PageActions` component)

The action buttons already use appropriate sizing (`h-4 w-4` icons, `p-1.5` padding).
Verify they align vertically with the breadcrumb text and Home icon. If needed, add
`items-center` to ensure vertical alignment (already present in the `gap-1` flex
container).

## Design Notes

- The border should be subtle (1px, using `--border-default` CSS variable) to match
  Notion's approach of minimal visual weight
- Background tint is optional — a simple bottom border alone may suffice
- In dark mode, the border and background should use the dark-mode values from the
  existing CSS variable system

## Acceptance Criteria

- [ ] The breadcrumb header bar has a visible bottom border separating it from page content
- [ ] Download, Favorite, and Share buttons are visually on the same row as breadcrumbs
- [ ] The header bar does not scroll with the page content (already the case)
- [ ] Works correctly in both light and dark modes
- [ ] No visual regression on pages without breadcrumbs (e.g., `/home`)

## Files to Modify

| File | Change |
|------|--------|
| `src/components/workspace/Breadcrumbs.tsx` | Add `border-b border-[var(--border-default)]` (and optionally `bg-[var(--bg-primary)]`) to `<nav>` |
| `src/components/workspace/PageHeader.tsx` | Verify `PageActions` alignment (likely no change needed) |

## Testing

1. Navigate to any page with a breadcrumb trail (e.g., a nested page)
2. Verify a subtle bottom border separates the header bar from the page content
3. Verify Download, Favorite, and Share buttons are clearly in the header row
4. Scroll the page content — header should remain fixed with border visible
5. Switch between light and dark modes — border should be visible in both
6. Navigate to `/home` — no breadcrumb bar should render (existing behavior)
7. Navigate to a page with a long breadcrumb trail (4+ ancestors) — verify truncation still works with the border
