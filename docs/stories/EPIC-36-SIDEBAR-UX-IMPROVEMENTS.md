# Epic 36: Sidebar UX Improvements

**Epic ID:** EPIC-36
**Created:** 2026-02-27
**Total Story Points:** 16
**Priority:** Medium
**Status:** Draft

---

## Epic Overview

Two UX improvements to the sidebar page tree:

1. **Action buttons misaligned.** The "+" (create subpage) and "..." (more options) buttons that appear on hover sit immediately after the page title text. When page titles have different lengths, the buttons appear at different horizontal positions. They should be right-aligned within the sidebar row so they always appear at the same X position, creating a clean visual column.

2. **No multi-select support.** Users cannot select multiple pages at once. To delete, move, or favorite several pages, each must be operated on individually. Standard Cmd+Click (toggle individual) and Shift+Click (range select) behavior should be supported, with bulk operations available via context menu.

---

## Business Value

- **Button alignment:** Reduces visual jitter and makes the sidebar feel polished. Users can build muscle memory for button positions since they're always in the same spot.
- **Multi-select:** Dramatically speeds up bulk operations. Reorganizing a workspace with many pages is currently tedious — each page must be moved individually. Multi-select enables batch delete, batch favorite, batch move, and batch duplicate.

---

## Stories

| ID | Story | Points | Priority | File |
|----|-------|--------|----------|------|
| SKB-36.1 | Right-Align Sidebar Action Buttons | 3 | Medium | [SKB-36.1](SKB-36.1-right-align-sidebar-action-buttons.md) |
| SKB-36.2 | Multi-Select Pages for Bulk Operations | 13 | Medium | [SKB-36.2](SKB-36.2-multi-select-pages-for-bulk-operations.md) |

---

## Implementation Order

```
36.1 should be done first (simple CSS fix), then 36.2 (complex feature):

┌──────┐    ┌──────┐
│ 36.1 │ →  │ 36.2 │
│Button│    │Multi │
│Align │    │Select│
└──────┘    └──────┘
```

36.1 is a prerequisite for 36.2 because multi-select will add checkboxes to the row layout, and the button alignment must be settled first.

---

## Shared Constraints

- **No Breaking Changes:** Existing single-click navigation, drag-and-drop reordering, and context menu must all continue working
- **Theming:** All new elements (selection highlights, checkboxes) must work in both light and dark mode
- **Performance:** Multi-select state management must not cause re-renders of the entire tree on each selection change
- **Accessibility:** Keyboard support for multi-select (Shift+Arrow keys for range, Space to toggle)

---

## Test Coverage Requirements

| Story | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 36.1 | Action buttons use `ml-auto` or equivalent right-alignment; buttons at same X across different title lengths | Buttons visible on hover at consistent position | Hover over pages with short/long titles, verify buttons aligned |
| 36.2 | Multi-select state tracks selected IDs; Cmd+Click toggles individual; Shift+Click selects range | Bulk delete removes all selected; bulk favorite marks all; bulk move relocates all | Select 3 pages with Cmd+Click, right-click, bulk delete — all removed |

---

## Files Modified by This Epic

| File | Action | Description |
|------|--------|-------------|
| `src/components/workspace/SortableSidebarTreeNode.tsx` | Modify | Right-align action buttons; add multi-select checkbox; handle Cmd/Shift click |
| `src/components/workspace/SidebarTreeNode.tsx` | Modify | Right-align action buttons; add multi-select support |
| `src/components/workspace/Sidebar.tsx` | Modify | Add multi-select state management; pass selection handlers to tree nodes |
| `src/components/sidebar/PageContextMenu.tsx` | Modify | Add bulk operation menu items when multiple pages selected |
| `src/components/sidebar/BulkActionBar.tsx` | Create | Floating bar showing count and bulk action buttons |
| `src/hooks/useMultiSelect.ts` | Create | Hook for Cmd+Click/Shift+Click selection logic |

---

**Last Updated:** 2026-02-27
