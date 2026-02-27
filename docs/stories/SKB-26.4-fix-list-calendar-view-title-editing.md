# SKB-26.4: Fix List & Calendar View Title Editing

**Story ID:** SKB-26.4
**Epic:** [EPIC-26 — Critical Bug Fixes](EPIC-26-CRITICAL-BUG-FIXES.md)
**Points:** 6
**Priority:** Critical
**Status:** Draft

---

## Summary

In the List view and Calendar view, clicking on an item's title navigates the user away from the database to the page view, instead of allowing them to edit the title inline. This makes it impossible to rename items without leaving the database. Additionally, the List view should always show checkboxes next to items for task tracking.

---

## Current Problems

### Problem 1: List view — clicking title navigates away

**File:** `src/components/database/ListView.tsx` (lines 91-99)

```typescript
const handleRowClick = useCallback(
  (row: { id: string; pageId: string | null }) => {
    setSelectedRowId(row.id);
    if (row.pageId) {
      router.push(`/pages/${row.pageId}`);  // ← navigates away on ANY click
    }
  },
  [router]
);
```

The entire row has `onClick={() => handleRowClick(row)}` (line 241), so clicking anywhere on the row — including the title text — triggers navigation to the page.

**Title rendering** (`ListRow.tsx` lines 54-57):
```tsx
<span className="flex-1 min-w-0 text-sm font-medium text-[var(--text-primary)] truncate">
  {title || "Untitled"}
</span>
```
The title is a plain `<span>` — no input field, no editing mode.

### Problem 2: Calendar view — clicking event navigates away

**File:** `src/components/database/CalendarView.tsx` (lines 246-251)

```typescript
const handleRowClick = useCallback(
  (_rowId: string, pageId: string | null) => {
    if (pageId) router.push(`/pages/${pageId}`);  // ← navigates away
  },
  [router]
);
```

The click chain: `CalendarEventPill.onClick()` → `CalendarDayCell.onRowClick()` → `handleRowClick()` → `router.push()`.

### Problem 3: List view checkboxes only show with CHECKBOX column

**File:** `src/components/database/ListRow.tsx` (lines 40-52)

Checkboxes only render when `hasCheckbox` is true, which requires a CHECKBOX-type column in the database schema. Users expect checkboxes to always be visible in the List view for task tracking, regardless of the schema.

---

## Acceptance Criteria

### List View:
- Single-click on a list item title enters inline edit mode (title becomes an input field)
- Press Enter or click away to save the edit
- Press Escape to cancel the edit
- Double-click on a list item title opens the linked page (navigates to `/pages/{pageId}`)
- Checkboxes appear next to every list item, regardless of whether a CHECKBOX column exists
- Checking/unchecking a checkbox persists the state
- The existing "..." menu button still works (even though it currently does nothing — that's a separate story)
- Adding new items still works

### Calendar View:
- Single-click on a calendar event pill enters inline edit mode (title becomes an input field)
- Press Enter or click away to save the edit
- Press Escape to cancel the edit
- Double-click on a calendar event opens the linked page
- Drag-to-move events between dates still works (must not conflict with click-to-edit)

---

## Implementation Approach

### List View Changes

**1. `ListView.tsx` — Change click behavior:**
- Remove `router.push()` from `handleRowClick`
- Add a `handleRowDoubleClick` that calls `router.push(/pages/${pageId})`
- Pass both handlers to `ListRow`

**2. `ListRow.tsx` — Add inline title editing:**
- Add `isEditing` state (boolean)
- On single-click of the title span: set `isEditing = true`, render an `<input>` instead of `<span>`
- Auto-focus the input and select all text
- On Enter: call `onTitleSave(rowId, newTitle)` and set `isEditing = false`
- On Escape: revert to original title and set `isEditing = false`
- On blur (click away): save and close
- Add `e.stopPropagation()` on the title click to prevent the row's double-click handler from firing

**3. `ListRow.tsx` — Always show checkboxes:**
- Remove the `hasCheckbox` conditional — always render the checkbox
- If no CHECKBOX column exists in the schema, create a virtual checkbox state managed locally or add a default checkbox column on first use
- Alternative simpler approach: always show checkboxes using the existing checkbox column logic, and if no checkbox column exists, auto-create one when the List view is first opened

### Calendar View Changes

**4. `CalendarView.tsx` — Change click behavior:**
- Remove `router.push()` from `handleRowClick`
- Add `handleRowDoubleClick` for navigation
- Pass edit handler to `CalendarDayCell` → `CalendarEventPill`

**5. `CalendarEventPill.tsx` — Add inline title editing:**
- On single-click: show an input field over the pill text
- On Enter/blur: save via `updateRow` mutation
- On Escape: cancel
- Ensure drag-to-move (mousedown + drag) doesn't trigger click-to-edit — use a small drag threshold or timer

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/database/ListView.tsx` | Remove navigation from single-click; add double-click handler; pass edit handlers to ListRow |
| `src/components/database/ListRow.tsx` | Add inline title editing; always show checkboxes; add `isEditing` state |
| `src/components/database/CalendarView.tsx` | Remove navigation from single-click; add double-click handler |
| `src/components/database/CalendarEventPill.tsx` | Add inline title editing on single-click |
| `src/components/database/CalendarDayCell.tsx` | Pass double-click and edit handlers through to pills |

---

## Do NOT Break

- Adding new items in both List and Calendar views
- Checkbox toggle functionality (already working in ListRow when checkbox column exists)
- Calendar drag-to-move events between dates
- Calendar drag-to-resize events
- Table view inline editing (separate component, should not be affected)
- Board view card drag-and-drop
- The `updateRow` mutation in `useDatabaseRows.ts` (just call it, don't modify it)
- Keyboard navigation in List view (arrow keys)
- View switching between Table/Board/List/Calendar/Gallery/Timeline

---

## Test Coverage

**Unit Tests:**
- ListRow: single-click title renders input field; Enter saves; Escape cancels
- ListRow: checkboxes render even without CHECKBOX column
- CalendarEventPill: single-click enters edit mode; double-click navigates
- No `router.push` called on single-click in either view

**Integration Tests:**
- `updateRow` mutation called with new title on save
- Double-click on list item navigates to correct page
- Checkbox state persists after toggle

**E2E Tests:**
1. Open database in List view, click item title → input appears
2. Type new name, press Enter → title saved, stays in database view
3. Double-click a list item → navigates to the page
4. Checkboxes visible on all items, toggle works
5. Open Calendar view, click event → input appears
6. Type new name, press Enter → saved
7. Double-click event → navigates to page
8. Drag event to different date → still works

---

## Verification Steps

1. Create a new database with some items
2. Switch to List view
3. Click on "Untitled" title — it should turn into an editable input field (NOT navigate away)
4. Type "My Task", press Enter — title saves, you stay in the database
5. Verify a checkbox appears next to every item
6. Toggle a checkbox — it should persist
7. Double-click on an item title — NOW it navigates to the page
8. Go back, switch to Calendar view
9. Click on a calendar event — it should turn into an editable input
10. Type a new name, press Enter — saves, stays in database
11. Double-click the event — navigates to the page
12. Drag an event to a different date — drag still works correctly

---

**Last Updated:** 2026-02-27
