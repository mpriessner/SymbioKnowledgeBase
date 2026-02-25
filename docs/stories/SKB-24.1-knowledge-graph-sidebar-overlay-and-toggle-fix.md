# Story SKB-24.1: Knowledge Graph Sidebar Overlay & Toggle Repositioning

**Epic:** Epic 24 - Knowledge Graph Sidebar Layout Fix
**Story ID:** SKB-24.1
**Story Points:** 5 | **Priority:** High | **Status:** Draft
**Depends On:** None (standalone fix)

---

## User Story

As a SymbioKnowledgeBase user, I want the knowledge graph sidebar to float over my page content instead of pushing it to the left, and I want the sidebar toggle button to not overlap with the Export Markdown button, So that I can view the knowledge graph without losing content width and can easily access both buttons.

---

## Acceptance Criteria

### Sidebar Overlay Behavior
- [ ] When the right sidebar is open, the main page content retains its full width (does not shrink)
- [ ] The sidebar renders as an overlay positioned on the right edge, floating above the content
- [ ] The sidebar has a visible background (`var(--bg-secondary)`) so content beneath is not distracting
- [ ] The sidebar casts a subtle shadow on its left edge for visual separation from the content beneath
- [ ] Content below the sidebar height is fully visible and not blocked
- [ ] The sidebar is scrollable independently if its content exceeds viewport height
- [ ] The main content area remains scrollable with the sidebar open
- [ ] Closing the sidebar removes the overlay — content returns to completely unobstructed
- [ ] The sidebar transition (open/close) remains smooth (200ms duration)

### Toggle Button Repositioning
- [ ] The sidebar toggle button (chevron) is positioned **below** the Export Markdown button
- [ ] There is clear visual separation between the Export button and the toggle button (at least 8px gap)
- [ ] The toggle button is at approximately `top-12` or `top-14` (below export at `top-2`)
- [ ] When the sidebar is collapsed, the "show sidebar" toggle button is also below the export button position
- [ ] Both buttons are independently clickable without overlap
- [ ] Both buttons have correct hover states and are visually distinct

### Visual Requirements
- [ ] Sidebar overlay has a left border: `border-l border-[var(--border-default)]`
- [ ] Sidebar overlay has a left shadow: `shadow-[-4px_0_12px_rgba(0,0,0,0.08)]` (light) / `shadow-[-4px_0_16px_rgba(0,0,0,0.25)]` (dark)
- [ ] Sidebar background: `var(--bg-secondary)` (matches current)
- [ ] Sidebar width: `280px` when open, `0` when closed (matches current)
- [ ] Toggle button maintains current styling (rounded-l, bg-secondary, border)

### Responsive & Edge Cases
- [ ] Sidebar remains hidden on screens below `lg` breakpoint (existing behavior preserved)
- [ ] On narrow lg-width screens, the overlay does not extend beyond the viewport
- [ ] When sidebar is open and user scrolls main content, sidebar stays fixed in position
- [ ] Keyboard accessibility: toggle button remains focusable and operable with Enter/Space
- [ ] The LocalGraphSidebar component inside the sidebar is unaffected (same controls, same graph)

### No Regressions
- [ ] Graph depth controls (+/-) still work
- [ ] Graph zoom controls (in/out/fit) still work
- [ ] "Full graph" link still navigates to `/graph`
- [ ] Connections section still collapses/expands
- [ ] Export Markdown button still downloads the `.md` file
- [ ] Page title editing still works
- [ ] Block editor still works with sidebar open
- [ ] Backlinks panel still renders below editor
- [ ] Local graph (bottom, expandable) still renders below backlinks

---

## Architecture Overview

```
Current Layout (page.tsx lines 70-146):
──────────────────────────────────────────

<div className="flex flex-1 w-full h-full min-h-0">
  ┌─────────────────────────────────┐  ┌──────────┐
  │ <div className="flex-1 min-w-0  │  │ <div     │
  │   overflow-y-auto">             │  │  w-[280] │
  │   Main content (shrinks)        │  │  flex-col │
  │ </div>                          │  │  ...>    │
  │                                 │  │  Sidebar │
  └─────────────────────────────────┘  └──────────┘
  ← flex-1 shrinks when sidebar     →  ← 280px   →

Target Layout:
──────────────────────────────────────────

<div className="relative flex-1 w-full h-full min-h-0">
  ┌──────────────────────────────────────────────┐
  │ <div className="w-full overflow-y-auto">     │
  │   Main content (FULL WIDTH always)           │
  │                              ┌──────────┐    │
  │                              │ <div     │    │
  │                              │ absolute │    │
  │                              │ right-0  │    │
  │                              │ top-0    │    │
  │                              │ w-[280]  │    │
  │                              │ h-full   │    │
  │                              │ z-30     │    │
  │                              │ Sidebar  │    │
  │                              └──────────┘    │
  │   Content continues below at full width      │
  └──────────────────────────────────────────────┘

Button Positioning (current → target):
──────────────────────────────────────────

Current:
  Export button:    absolute right-4 top-2 z-10    (PageHeader.tsx:111)
  Toggle (open):   absolute right-[280px] top-4 z-20  (page.tsx:110)
  Toggle (closed): fixed right-0 top-4 z-20           (page.tsx:138)
  → OVERLAP at top-right corner

Target:
  Export button:    absolute right-4 top-2 z-10    (unchanged)
  Toggle (open):   absolute right-[280px] top-12 z-30  (moved down)
  Toggle (closed): fixed right-0 top-12 z-30           (moved down)
  → Clear separation: export at top-2, toggle at top-12
```

---

## Implementation Steps

### Step 1: Convert Sidebar from Flex Item to Overlay

**File: `src/app/(workspace)/pages/[id]/page.tsx`** (modify lines 70-146)

Change the outer container and sidebar positioning:

```typescript
// BEFORE: Flex row where sidebar takes space
<div className="flex flex-1 w-full h-full min-h-0">
  <div className="flex-1 min-w-0 overflow-y-auto">
    {/* Main content */}
  </div>
  <div className={`hidden lg:flex flex-col ... ${showRightSidebar ? "w-[280px]" : "w-0 overflow-hidden"}`}>
    {/* Sidebar — flex item, pushes content */}
  </div>
</div>

// AFTER: Relative container with absolutely-positioned sidebar
<div className="relative flex-1 w-full h-full min-h-0">
  <div className="w-full h-full overflow-y-auto">
    {/* Main content — always full width */}
  </div>
  <div className={`
    hidden lg:flex flex-col
    absolute top-0 right-0 h-full
    border-l border-[var(--border-default)]
    bg-[var(--bg-secondary)]
    transition-all duration-200
    z-30
    ${showRightSidebar
      ? "w-[280px] shadow-[-4px_0_12px_rgba(0,0,0,0.08)]"
      : "w-0 overflow-hidden"}
  `}>
    {/* Sidebar — overlay, floats above content */}
  </div>
</div>
```

Key changes:
- Outer div: `flex` → `relative` (establishes positioning context)
- Main content div: `flex-1 min-w-0` → `w-full h-full` (always takes full width)
- Sidebar div: Remove flex participation, add `absolute top-0 right-0 h-full z-30`
- Add left shadow for depth: `shadow-[-4px_0_12px_rgba(0,0,0,0.08)]`

### Step 2: Reposition Toggle Button Below Export

**File: `src/app/(workspace)/pages/[id]/page.tsx`** (modify lines 108-117 and 136-144)

Move toggle buttons from `top-4` to `top-12`:

```typescript
// Toggle when sidebar is OPEN (line ~108-117)
// BEFORE:
<button className="absolute right-[280px] top-4 z-20 ..."

// AFTER:
<button className="absolute right-[280px] top-12 z-30 ..."

// Toggle when sidebar is CLOSED (line ~136-144)
// BEFORE:
<button className="hidden lg:flex fixed right-0 top-4 z-20 ..."

// AFTER:
<button className="hidden lg:flex fixed right-0 top-12 z-30 ..."
```

Key changes:
- `top-4` → `top-12` (moves from 16px to 48px — well below export at 8px)
- `z-20` → `z-30` (ensures toggle is above the sidebar overlay)

### Step 3: Add Dark Theme Shadow Variant

**File: `src/app/(workspace)/pages/[id]/page.tsx`** (modify sidebar div)

For dark theme, use a darker, more spread shadow. This can be handled with CSS or a theme-aware class:

```typescript
// Option A: Use Tailwind dark: variant
<div className={`
  ...
  ${showRightSidebar
    ? "w-[280px] shadow-[-4px_0_12px_rgba(0,0,0,0.08)] dark:shadow-[-4px_0_16px_rgba(0,0,0,0.25)]"
    : "w-0 overflow-hidden"}
`}>
```

If the project uses `[data-theme="dark"]` rather than Tailwind's `dark:` variant, add a CSS class instead:

```typescript
// Option B: CSS custom property approach
<div className={`
  ...
  ${showRightSidebar ? "w-[280px] sidebar-overlay-shadow" : "w-0 overflow-hidden"}
`}>
```

With corresponding CSS in `globals.css`:
```css
.sidebar-overlay-shadow {
  box-shadow: -4px 0 12px rgba(0, 0, 0, 0.08);
}

[data-theme="dark"] .sidebar-overlay-shadow {
  box-shadow: -4px 0 16px rgba(0, 0, 0, 0.25);
}
```

### Step 4: Ensure Main Content Scroll Is Independent

**File: `src/app/(workspace)/pages/[id]/page.tsx`** (verify)

The main content area must scroll independently of the sidebar. The sidebar should also scroll if its content overflows:

```typescript
// Main content
<div className="w-full h-full overflow-y-auto">
  {/* Scrolls independently */}
</div>

// Sidebar — add overflow-y-auto
<div className={`
  hidden lg:flex flex-col
  absolute top-0 right-0 h-full
  overflow-y-auto
  ...
`}>
```

### Step 5: Adjust Content Right Padding When Sidebar Is Open (Optional)

To prevent the rightmost content from being hidden beneath the overlay, consider adding right padding to the main content when the sidebar is open. This is optional — the user explicitly requested overlay behavior, meaning content beneath the sidebar is acceptable:

```typescript
// If padding is desired (optional):
<div className={`w-full h-full overflow-y-auto ${showRightSidebar ? "pr-[280px] lg:pr-0" : ""}`}>
```

**Note:** Based on the user's request ("overlap of the knowledge graph over the text"), NO right padding should be added. The sidebar should simply overlay the content.

---

## Testing Requirements

### Unit Tests (8+ cases)

**File: `src/__tests__/components/page/PageViewLayout.test.tsx`**

- Sidebar container has `absolute` positioning when open
- Sidebar container has `right-0 top-0` classes
- Main content container has `w-full` (not `flex-1 min-w-0`)
- Sidebar has `z-30` z-index class
- Sidebar has shadow class when open
- Sidebar has no shadow when closed
- Toggle button (open state) has `top-12` positioning
- Toggle button (closed state) has `top-12` positioning
- Toggle button z-index is `z-30`
- Export button z-index is `z-10` (lower than toggle)

### Integration Tests (6+ cases)

**File: `src/__tests__/integration/sidebar-overlay.test.tsx`**

- Open sidebar: main content width does not change (measure computed width)
- Open sidebar: sidebar overlays content (has `position: absolute`)
- Close sidebar: sidebar width is 0, no overlay visible
- Toggle button and Export button do not overlap (check bounding rects)
- Sidebar open → scroll main content → sidebar remains in position
- Dark theme: sidebar has darker shadow

### Visual / E2E Tests (3+ cases)

**File: `src/__tests__/e2e/sidebar-overlay.test.ts`**

- Open page → open sidebar → screenshot: content is full-width beneath sidebar
- Click Export button → downloads file (not blocked by toggle)
- Click toggle to close sidebar → toggle moves to right edge → click to reopen

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/app/(workspace)/pages/[id]/page.tsx` | Modify | Convert sidebar to overlay, reposition toggle buttons |
| `src/app/globals.css` | Possibly Modify | Add `.sidebar-overlay-shadow` class for theme-aware shadow |
| `src/__tests__/components/page/PageViewLayout.test.tsx` | Create | Unit tests for layout classes |
| `src/__tests__/integration/sidebar-overlay.test.tsx` | Create | Integration tests for overlay behavior |
| `src/__tests__/e2e/sidebar-overlay.test.ts` | Create | E2E tests for visual correctness |

---

## Reference: Current File Locations

| Element | File | Line(s) | Current Value |
|---------|------|---------|---------------|
| Page layout container | `page.tsx` | 71 | `flex flex-1 w-full h-full min-h-0` |
| Main content area | `page.tsx` | 73 | `flex-1 min-w-0 overflow-y-auto` |
| Right sidebar container | `page.tsx` | 98-105 | `hidden lg:flex flex-col ... w-[280px]` |
| Toggle button (open) | `page.tsx` | 108-117 | `absolute right-[280px] top-4 z-20` |
| Toggle button (closed) | `page.tsx` | 136-144 | `fixed right-0 top-4 z-20` |
| Export Markdown button | `PageHeader.tsx` | 111 | `absolute right-4 top-2 z-10` |
| LocalGraphSidebar | `LocalGraphSidebar.tsx` | 28-206 | Full component (unchanged) |

---

**Last Updated:** 2026-02-25
