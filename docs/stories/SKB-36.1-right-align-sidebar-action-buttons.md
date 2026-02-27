# SKB-36.1: Right-Align Sidebar Action Buttons

**Story ID:** SKB-36.1
**Epic:** [EPIC-36 — Sidebar UX Improvements](EPIC-36-SIDEBAR-UX-IMPROVEMENTS.md)
**Points:** 3
**Priority:** Medium
**Status:** Draft

---

## Summary

The "+" (create subpage) and "..." (more options) buttons in the sidebar page tree should be right-aligned within each row, so they always appear at the same horizontal position regardless of the page title length.

---

## Current Problem

**File:** `src/components/workspace/SortableSidebarTreeNode.tsx` (lines 303-330)

The action buttons are rendered immediately after the title span in the flex container:

```
[drag] [▶] [📄] [Page Title Text...] [...] [+]
                 ↑ flex-1 truncate    ↑ right here
```

The title uses `flex-1 truncate`, which means it takes all available space and the buttons sit directly after the truncated text. However, because the buttons are only rendered on hover (`isHovered && !activeId`), when they appear, they correctly push to the right edge since `flex-1` absorbs space.

**The actual issue:** Both `SidebarTreeNode.tsx` and `SortableSidebarTreeNode.tsx` use `flex-shrink-0` on the buttons but the button group lacks a wrapper to keep them consistently positioned. When different rows have different nesting depths (indentation via `paddingLeft`), the available width varies, and the buttons land at different X positions.

**Current layout per component:**
- `SidebarTreeNode.tsx` (line 146): Only "+" button, rendered after `flex-1` title
- `SortableSidebarTreeNode.tsx` (line 303): "..." then "+" buttons, rendered after `flex-1` title

---

## Desired Layout

```
CURRENT (buttons at different X per row):
│ 📄 Short Title        [...] [+]            │
│ 📄 A Much Longer Page Title [...] [+]      │
│   📄 Nested Page Name    [...] [+]          │

DESIRED (buttons always at rightmost edge):
│ 📄 Short Title                   [...] [+] │
│ 📄 A Much Longer Page Ti...      [...] [+] │
│   📄 Nested Page Name            [...] [+] │
```

---

## Acceptance Criteria

- The "..." and "+" buttons appear at the same horizontal position across all sidebar rows, regardless of title length or nesting depth
- Buttons are right-aligned within the sidebar row
- The page title truncates to accommodate the button space
- Hover-to-show behavior still works
- Drag handle, expand chevron, and page icon remain left-aligned
- Both `SidebarTreeNode` and `SortableSidebarTreeNode` behave consistently
- Dark and light mode display correctly

---

## Implementation Approach

The `flex-1 truncate` on the title already pushes subsequent items to the right. The fix is to ensure the action buttons are wrapped in a container that is always positioned at the right edge:

**In both `SortableSidebarTreeNode.tsx` and `SidebarTreeNode.tsx`:**

1. Wrap the action buttons in a `<div className="ml-auto flex items-center flex-shrink-0">`:

```tsx
{/* Action buttons - always right-aligned */}
<div className="ml-auto flex items-center flex-shrink-0">
  {isHovered && !activeId && (
    <>
      <button className="w-5 h-5 ..." onClick={handleMoreClick}>
        <MoreHorizontal />
      </button>
      <button className="w-5 h-5 ... mr-1" onClick={handleCreateChild}>
        <Plus />
      </button>
    </>
  )}
</div>
```

2. The `ml-auto` ensures the button container is pushed to the far right
3. The buttons still only render on hover, but the container always exists (zero width when empty), ensuring consistent spacing
4. Alternatively, reserve the button width even when not hovered using `invisible` instead of conditional rendering:

```tsx
<div className="ml-auto flex items-center flex-shrink-0">
  <button className={`w-5 h-5 ... ${isHovered ? 'visible' : 'invisible'}`}>
    <MoreHorizontal />
  </button>
  <button className={`w-5 h-5 ... mr-1 ${isHovered ? 'visible' : 'invisible'}`}>
    <Plus />
  </button>
</div>
```

This approach reserves space for the buttons at all times, so the title always truncates at the same point.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/workspace/SortableSidebarTreeNode.tsx` | Wrap action buttons in `ml-auto flex-shrink-0` container; use `invisible`/`visible` instead of conditional render |
| `src/components/workspace/SidebarTreeNode.tsx` | Same treatment for the "+" button |

---

## Do NOT Break

- Single-click to navigate to page
- Double-click to rename (if implemented)
- Right-click context menu
- Drag-and-drop reordering
- Expand/collapse child pages
- Hover-to-reveal button behavior
- Tree indentation for nested pages
- Page icon and title display
- Rename mode (inline input)
- Tooltip on truncated titles

---

## Test Coverage

**Unit Tests:**
- Action buttons are wrapped in a container with `ml-auto` or equivalent
- Buttons use `invisible`/`visible` classes instead of conditional rendering
- Button container has `flex-shrink-0` class

**Integration Tests:**
- Two rows with different title lengths have action buttons at the same X coordinate
- Nested (indented) rows still have buttons at the right edge

**E2E Tests:**
1. Open sidebar with multiple pages of varying title lengths
2. Hover over each page — the "..." and "+" buttons appear at the same X position
3. Hover over a deeply nested page — buttons still at the right edge
4. Click "+" — creates subpage correctly
5. Click "..." — context menu opens correctly

---

## Verification Steps

1. Open the sidebar with several pages at different nesting levels and with different title lengths
2. Hover over each page item
3. The "..." and "+" buttons should appear at the same horizontal position (right edge of the sidebar)
4. Test with a page that has a very long title — it should truncate, and buttons should still be at the right edge
5. Test with a deeply nested page (3+ levels) — buttons still right-aligned

---

**Last Updated:** 2026-02-27
