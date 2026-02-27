# SKB-36.2: Multi-Select Pages for Bulk Operations

**Story ID:** SKB-36.2
**Epic:** [EPIC-36 — Sidebar UX Improvements](EPIC-36-SIDEBAR-UX-IMPROVEMENTS.md)
**Points:** 13
**Priority:** Medium
**Status:** Draft

---

## Summary

Users should be able to select multiple pages in the sidebar using standard keyboard modifiers (Cmd+Click for individual toggle, Shift+Click for range select) and then perform bulk operations on the selection — delete, move, favorite, duplicate — via a context menu or bulk action bar.

---

## Current Behavior

- Clicking a page in the sidebar navigates to it — there is no "select without navigating" mode
- Right-click context menu operates on a single page only
- To delete 10 pages, the user must right-click and delete each one individually
- No visual indication of multi-selection exists
- `SortableSidebarTreeNode.tsx` handles click via `handleClick` (line ~170) which calls `router.push`

---

## Acceptance Criteria

### Selection
- **Cmd+Click** (macOS) / **Ctrl+Click** (Windows/Linux): Toggle individual page selection without navigating
- **Shift+Click**: Select all pages between the last-clicked page and the current click (range select)
- **Click** (no modifier): Clear selection and navigate to the page (existing behavior)
- **Escape**: Clear all selections
- Selected pages show a highlighted background (distinct from the "active page" highlight)
- A small checkbox appears on hover or when any page is selected
- Selection count badge visible (e.g., "3 selected") at the top or bottom of the sidebar

### Bulk Operations (Context Menu)
- Right-click when multiple pages are selected shows a bulk context menu:
  - **Delete (X pages)** — deletes all selected pages with confirmation
  - **Add to favorites** — marks all selected as favorites
  - **Remove from favorites** — removes all selected from favorites
  - **Duplicate** — duplicates all selected pages
  - **Move to...** — opens a page picker to move all selected pages under a new parent
  - **Rename** — renames only the first-selected page (enters inline rename mode)
- If only one page is selected and right-clicked, the normal single-page context menu appears

### Bulk Drag-and-Drop
- When multiple pages are selected and the user drags one of them, all selected pages move together
- A badge on the drag preview shows the count (e.g., "3 pages")
- Dropping into a parent page nests all selected pages under it

### Edge Cases
- Selecting pages across different sections (Private, Teams, Agent) is allowed
- Selecting a parent and its children: deleting the parent also deletes children (no double-delete)
- If the currently-viewed page is in the selection and gets deleted, navigate to `/home`
- Undo support (if time allows — could be a follow-up story)

---

## Implementation Approach

### 1. Selection State Management

Create `src/hooks/useMultiSelect.ts`:

```typescript
interface UseMultiSelectReturn {
  selectedIds: Set<string>;
  lastClickedId: string | null;
  isSelected: (id: string) => boolean;
  handleClick: (id: string, event: React.MouseEvent) => void;
  clearSelection: () => void;
  selectAll: (ids: string[]) => void;
  selectionCount: number;
}
```

**Logic:**
- `handleClick` checks `event.metaKey` (Cmd) or `event.shiftKey`
- If Cmd: toggle `id` in `selectedIds`
- If Shift: compute range between `lastClickedId` and `id` using the flat tree order, add all to `selectedIds`
- If neither: clear selection, let normal navigation proceed
- Store `lastClickedId` for Shift+Click range calculation

### 2. Flat Tree Order for Range Select

The sidebar tree is hierarchical. For Shift+Click range selection, we need a flat ordering:
- Pre-order traversal of the visible (expanded) tree nodes
- Only include nodes that are visible (parent is expanded)
- Use this flat list to compute the range between two clicks

### 3. Visual Selection Indicators

In `SortableSidebarTreeNode.tsx`:
- Add conditional background: `bg-blue-50 dark:bg-blue-900/20` when selected
- Show checkbox on hover OR when `selectionCount > 0`:
  ```tsx
  {(isHovered || selectionCount > 0) && (
    <input type="checkbox" checked={isSelected} className="..." />
  )}
  ```
- Selected state is distinct from active page state (active = blue-100, selected = blue-50 with checkbox)

### 4. Bulk Context Menu

Modify `PageContextMenu.tsx` to accept `selectedCount` and `selectedIds`:
- When `selectedCount > 1`, show bulk menu items:
  - "Delete 3 pages" (with confirmation modal showing all page titles)
  - "Add all to favorites"
  - "Duplicate 3 pages"
  - "Move 3 pages to..."
- Rename only applies to the right-clicked page

### 5. Bulk Action Bar (Optional)

Create `src/components/sidebar/BulkActionBar.tsx`:
- Floating bar at the bottom of the sidebar when `selectionCount > 0`
- Shows: "3 pages selected" with [Delete] [Favorite] [Move] [Cancel] buttons
- Provides quick access without right-clicking

### 6. Bulk Drag-and-Drop

In the dnd-kit setup:
- When starting a drag on a selected page, include all `selectedIds` in the drag data
- Show a custom drag overlay with badge count
- On drop, move all selected pages to the target position

---

## Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useMultiSelect.ts` | Create — selection state management with Cmd/Shift click logic |
| `src/components/workspace/Sidebar.tsx` | Add multi-select hook; pass selection state to tree nodes; render BulkActionBar |
| `src/components/workspace/SortableSidebarTreeNode.tsx` | Add selection highlight, checkbox, Cmd/Shift click handling |
| `src/components/workspace/SidebarTreeNode.tsx` | Add selection support (non-sortable variant) |
| `src/components/sidebar/PageContextMenu.tsx` | Add bulk operation menu items when multiple selected |
| `src/components/sidebar/BulkActionBar.tsx` | Create — floating selection action bar |

---

## Do NOT Break

- Single-click navigation (when no modifier key is held)
- Single-page right-click context menu (when only one page selected)
- Drag-and-drop single page reordering
- Expand/collapse tree nodes
- Rename mode
- Favorite toggle on single page
- Sidebar section headers (Private, Teams, Agent)
- Page creation ("+") button functionality
- Search and filter in sidebar

---

## Test Coverage

**Unit Tests:**
- `useMultiSelect`: Cmd+Click toggles individual selection
- `useMultiSelect`: Shift+Click selects range based on flat tree order
- `useMultiSelect`: Click without modifier clears selection
- `useMultiSelect`: Escape clears selection
- Bulk context menu shows correct item count
- Bulk delete confirmation lists all selected page titles

**Integration Tests:**
- Cmd+Click 3 pages, right-click, "Delete 3 pages" → all deleted
- Shift+Click selects correct range of visible pages
- Bulk favorite marks all selected pages
- After bulk delete, navigate to `/home` if current page was deleted

**E2E Tests:**
1. Cmd+Click 3 pages — all show selected highlight
2. Right-click — bulk context menu appears with "Delete 3 pages"
3. Confirm delete — all 3 pages removed from sidebar
4. Cmd+Click 2 pages, click "Add to favorites" — both appear in favorites section
5. Shift+Click a range — all pages in between are selected
6. Press Escape — selection cleared
7. Normal click (no modifier) — selection cleared, navigates to page
8. Drag selected pages to a new parent — all move together

---

## Verification Steps

1. Open the sidebar with 10+ pages
2. Cmd+Click 3 non-adjacent pages — they should all show a selected highlight
3. Right-click on one of the selected pages — bulk context menu appears
4. Click "Delete 3 pages" — confirmation modal shows all 3 page titles
5. Confirm — all 3 pages are deleted
6. Create several more pages
7. Click the first page, then Shift+Click the fifth page — pages 1-5 are all selected
8. Right-click — "Add 5 to favorites" option visible
9. Click it — all 5 appear in favorites
10. Press Escape — selection cleared
11. Click any page normally — navigates to it, no selection

---

**Last Updated:** 2026-02-27
