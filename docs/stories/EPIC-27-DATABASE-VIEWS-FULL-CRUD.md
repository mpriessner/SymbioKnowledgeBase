# Epic 27: Database Views — Full CRUD & Interactivity

**Epic ID:** EPIC-27
**Created:** 2026-02-25
**Total Story Points:** 42
**Priority:** High
**Status:** In Progress (~85% complete)
**Notes:** SKB-27.1 (Row Delete) done — RowContextMenu with confirmation in all views. SKB-27.2 (Gallery Inline Editing) done. SKB-27.3 (List View Menu + Editing) done. SKB-27.5 (DnD Reorder) done — Gallery and List views with @dnd-kit. SKB-27.4 (Timeline Inline Editing) partially done — infrastructure exists but full inline property UI in sidebar incomplete. SKB-27.6 (Empty States) partially done — empty states exist but messaging is inconsistent across views.

**Remaining work:**
- Complete timeline view inline title/property editing in sidebar (SKB-27.4)
- Standardize empty state messages across all database views (SKB-27.6)

---

## Epic Overview

The database has 6 different views (Table, Board, List, Calendar, Gallery, Timeline) but most are missing key functionality. Users can look at data but cannot fully interact with it. This epic makes every view fully functional: users can add items, edit items inline, delete items, and drag things around where it makes sense.

**Current state (from investigation):**

| View | Add | View | Edit | Delete | Drag |
|------|-----|------|------|--------|------|
| Table | Yes | Yes | Yes (inline) | NO | N/A |
| Board | Yes | Yes | Yes (drag) | NO | Yes |
| List | Yes | Yes | Checkbox only | NO | NO (menu button does nothing) |
| Calendar | Yes | Yes | Yes (drag dates) | NO | Yes |
| Gallery | Yes | Yes | NO | NO | NO |
| Timeline | Yes | Yes | Yes (drag dates) | NO | NO inline |

**Key finding:** The backend API fully supports all CRUD operations. The `deleteRow` mutation exists in `useDatabaseRows.ts` but is never called by any view. The gap is entirely in the frontend components.

---

## Business Value

- Users cannot delete incorrect data entries — they accumulate junk
- Gallery view is essentially read-only after creation — users can't fix mistakes
- List view has a menu button that does nothing when clicked — feels broken
- No view lets users delete a row without going to the database admin

---

## Architecture Summary

```
Backend (COMPLETE — no changes needed):
  POST   /api/databases/[id]/rows       → Create row
  GET    /api/databases/[id]/rows       → List rows
  PUT    /api/databases/[id]/rows/[rid] → Update row
  DELETE /api/databases/[id]/rows/[rid] → Delete row

Hook (COMPLETE — no changes needed):
  useDatabaseRows.ts → createRow, updateRow, deleteRow mutations all exist

Frontend (NEEDS WORK):
  Each view component needs:
  1. Delete capability (right-click menu or action button)
  2. Gallery needs inline editing
  3. List needs its menu to actually work
  4. Shared RowContextMenu component for consistency
```

---

## Stories Breakdown

### SKB-27.1: Add Row Delete to All Database Views — 8 points, High

**Delivers:** Users can delete any row from any database view via a right-click context menu or action button.

**Acceptance Criteria:**
- In Table view: right-click a row to see "Delete" option; click it to delete
- In Board view: right-click a card to see "Delete" option; click it to delete
- In List view: the existing "..." menu button now shows "Delete" option that works
- In Calendar view: right-click an event pill to see "Delete" option
- In Gallery view: right-click a card to see "Delete" option
- In Timeline view: right-click a bar to see "Delete" option
- All deletions show a confirmation dialog ("Delete this row?" with Cancel/Delete buttons)
- After deletion the item disappears without a full page reload
- A toast notification confirms "Row deleted"

**Implementation approach:**
1. Create a shared `RowContextMenu` component (similar to `PageContextMenu`) with "Delete" (and later "Edit", "Duplicate")
2. Wire `deleteRow.mutate(rowId)` from `useDatabaseRows` hook into each view
3. Add `onContextMenu` handlers to: table rows, board cards, list rows, calendar event pills, gallery cards, timeline bars
4. Add confirmation dialog before delete

**Files to modify:**
| File | Change |
|------|--------|
| NEW `src/components/database/RowContextMenu.tsx` | Create shared context menu component |
| `src/components/database/TableView.tsx` | Add right-click on rows, wire delete |
| `src/components/database/BoardCard.tsx` | Add right-click on cards, wire delete |
| `src/components/database/ListRow.tsx` | Implement the existing "..." menu with delete |
| `src/components/database/CalendarEventPill.tsx` | Add right-click on events, wire delete |
| `src/components/database/GalleryCard.tsx` | Add right-click on cards, wire delete |
| `src/components/database/TimelineBar.tsx` | Add right-click on bars, wire delete |

**Do NOT break:**
- Existing add-row functionality in any view
- Existing inline editing in Table view
- Existing drag-and-drop in Board, Calendar, Timeline views
- The `deleteRow` mutation in `useDatabaseRows.ts` (do not modify, just call it)
- Optimistic updates and query invalidation

---

### SKB-27.2: Add Inline Editing to Gallery View — 8 points, High

**Delivers:** Users can edit data directly on gallery cards without having to open the page.

**Acceptance Criteria:**
- Click a gallery card title to edit it inline (text input replaces the title)
- Press Enter or click away to save the edit
- Press Escape to cancel the edit
- Double-click a property value on a card to edit it inline
- Changes save immediately (optimistic update — card updates before server confirms)
- If a card has a cover image, clicking the image still opens the page (no accidental edits)

**Implementation approach:**
1. Add `isEditing` state to `GalleryCard.tsx`
2. Title: single-click to start editing, render an input field
3. Properties: double-click to start editing, render the appropriate `PropertyEditor` (text input, select, date picker, etc.) based on the property type — reference how `TableView` does inline editing
4. Wire `updateRow.mutate()` on save
5. Keep the card-click-to-open-page behavior, but only when not in editing mode

**Files to modify:**
| File | Change |
|------|--------|
| `src/components/database/GalleryCard.tsx` | Add inline editing for title and properties |
| `src/components/database/GalleryView.tsx` | Pass updateRow handler to cards |

**Do NOT break:**
- Card cover image display
- Card size toggle (small/medium/large)
- Property visibility toggle
- Card click to navigate to page (when not editing)
- Add new row button at the bottom

---

### SKB-27.3: Fix List View Menu & Add Inline Editing — 6 points, Medium

**Delivers:** The "..." menu button on each list row actually works, and users can edit properties inline.

**Acceptance Criteria:**
- Click the "..." button on any list row — a dropdown menu appears with: "Edit", "Delete", "Open in new tab"
- "Delete" shows confirmation then removes the row
- "Edit" makes the row's properties editable inline
- "Open in new tab" opens the page in a new browser tab
- Click a property value directly to edit it (like Table view)
- Checkbox toggle continues to work as before

**Implementation approach:**
1. In `ListRow.tsx`: implement the existing `showMenu` state that currently does nothing
2. Render a dropdown menu using the same pattern as `RowContextMenu` from SKB-27.1
3. Add inline property editing — render `PropertyEditor` components on click, similar to TableView's pattern
4. Wire `updateRow.mutate()` for saves and `deleteRow.mutate()` for deletes

**Files to modify:**
| File | Change |
|------|--------|
| `src/components/database/ListRow.tsx` | Implement menu dropdown, add inline property editing |
| `src/components/database/ListView.tsx` | Pass updateRow and deleteRow handlers to rows |

**Do NOT break:**
- Checkbox toggle functionality
- Row click to navigate to page
- Keyboard navigation (arrow keys)
- Add new row button at the bottom

---

### SKB-27.4: Add Inline Property Editing to Timeline View — 5 points, Medium

**Delivers:** Users can edit non-date properties on timeline rows without opening the page.

**Acceptance Criteria:**
- In the left sidebar of the timeline (where row titles are listed), click a title to edit it inline
- Click a property value in the sidebar to edit it inline
- Changes save immediately
- Drag-to-move and drag-to-resize bars continue to work for date changes
- The "..." button or right-click on a sidebar row gives access to "Delete" and "Edit"

**Implementation approach:**
1. The timeline view has a left sidebar listing rows with titles — add click-to-edit on titles
2. Add a small property panel or expandable section per row in the sidebar
3. Wire `updateRow.mutate()` for saves
4. Ensure date changes from drag operations remain working alongside inline editing

**Files to modify:**
| File | Change |
|------|--------|
| `src/components/database/TimelineView.tsx` | Add inline editing to sidebar row titles and properties |
| `src/components/database/TimelineBar.tsx` | Ensure drag operations don't conflict with editing |

**Do NOT break:**
- Drag-to-move entire bar (changes start and end dates)
- Drag-to-resize bar ends (changes individual start or end date)
- Time axis rendering and zoom
- Add new row button

---

### SKB-27.5: Add Drag-and-Drop Reordering to Gallery and List Views — 8 points, Medium

**Delivers:** Users can drag gallery cards and list rows to reorder them.

**Acceptance Criteria:**
- Gallery view: drag a card to rearrange its position in the grid
- List view: drag a row up or down to reorder
- The new order persists after page refresh
- Visual feedback during drag (card/row lifts, drop target highlighted)
- Drag handles are visible on hover (grip icon on left side of list rows, top of gallery cards)

**Implementation approach:**
1. Use `@dnd-kit` library (already in the project for Board and Calendar views)
2. Gallery: wrap cards in `SortableContext`, add `useSortable` to each card
3. List: wrap rows in `SortableContext`, add `useSortable` to each row
4. On drop: call `updateRow.mutate()` with updated `position` field (or create a reorder API call)
5. Reference `BoardView.tsx` for the existing DnD pattern

**Files to modify:**
| File | Change |
|------|--------|
| `src/components/database/GalleryView.tsx` | Add DnD context and sortable cards |
| `src/components/database/GalleryCard.tsx` | Add useSortable hook, drag handle |
| `src/components/database/ListView.tsx` | Add DnD context and sortable rows |
| `src/components/database/ListRow.tsx` | Add useSortable hook, drag handle |

**Do NOT break:**
- Gallery card click-to-open behavior (drag vs click distinction)
- Gallery card size toggle
- List row click-to-open behavior
- List row checkbox toggle
- Board view drag-and-drop (separate DnD context)

---

### SKB-27.6: Database View Polish & Empty States — 7 points, Low

**Delivers:** Every database view shows helpful empty states and consistent loading/error behavior.

**Acceptance Criteria:**
- When a database has no rows, each view shows a friendly empty state:
  - Table: "No rows yet. Click + to add your first row."
  - Board: "No items. Add one to get started." (with add button)
  - List: "Nothing here yet. Add your first item."
  - Calendar: "No events scheduled. Click a date to add one."
  - Gallery: "No cards yet. Click + to add one."
  - Timeline: "No items on the timeline. Add one to get started."
- Loading state: each view shows a skeleton/shimmer while data loads
- Error state: if the API call fails, show "Failed to load data. Try again." with a retry button
- All add-row buttons are consistently placed and styled across views

**Files to modify:**
| File | Change |
|------|--------|
| `src/components/database/TableView.tsx` | Add empty state |
| `src/components/database/BoardView.tsx` | Add empty state |
| `src/components/database/ListView.tsx` | Add empty state |
| `src/components/database/CalendarView.tsx` | Add empty state |
| `src/components/database/GalleryView.tsx` | Add empty state |
| `src/components/database/TimelineView.tsx` | Add empty state |

**Do NOT break:**
- Any existing functionality in any view
- View switching via ViewSwitcher component
- Database schema display

---

## Test Coverage Requirements

| Story | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 27.1 | RowContextMenu renders with Delete option; deleteRow called on confirm | Delete API returns 204; row removed from query cache | Right-click row in each view, click Delete, confirm row disappears |
| 27.2 | GalleryCard enters edit mode on click; saves on Enter | updateRow API called with new values; card re-renders | Click card title, type new name, press Enter, verify saved |
| 27.3 | ListRow menu renders; delete and edit options work | Menu actions call correct mutations | Click "..." on list row, select delete, confirm removed |
| 27.4 | Timeline sidebar title editable on click | updateRow called; timeline bar re-renders | Click title in timeline sidebar, edit, verify saved |
| 27.5 | DnD context renders for Gallery and List | Reorder persists; positions updated | Drag card to new position, refresh, verify order |
| 27.6 | Empty states render when rows array is empty | Loading skeleton shows during fetch | Create empty database, verify each view shows empty state |

---

## Implementation Order

```
27.1 (delete — unblocks all views) → 27.2 & 27.3 (parallel) → 27.4 → 27.5 → 27.6

         ┌──────┐
         │ 27.2 │
    ┌──→ │Gallery│ ──┐
    │    │ Edit │    │    ┌──────┐    ┌──────┐    ┌──────┐
┌──────┐ └──────┘    ├──→│ 27.4 │──→ │ 27.5 │──→ │ 27.6 │
│ 27.1 │             │   │ TL   │    │ DnD  │    │Polish│
│Delete│ ┌──────┐    │   │ Edit │    │ Gall │    │Empty │
│ All  │ │ 27.3 │    │   └──────┘    │ List │    │States│
└──┬───┘ │ List │ ──┘               └──────┘    └──────┘
   └──→  │ Menu │
         └──────┘
```

---

## Shared Constraints

- **Backend is complete:** Do NOT modify API routes or the `useDatabaseRows` hook — only wire up existing mutations in view components
- **Consistent UX:** All context menus should look and behave the same across views (shared `RowContextMenu` component)
- **Optimistic updates:** All mutations should use optimistic updates for instant feedback (already implemented in the hook)
- **Theming:** All new UI elements must work in both light and dark themes
- **Accessibility:** Context menus must be keyboard-navigable; inline edit fields must be tabbable

---

## Files Modified by This Epic

| File | Action | Description |
|------|--------|-------------|
| NEW `src/components/database/RowContextMenu.tsx` | Create | Shared right-click menu for all views |
| `src/components/database/TableView.tsx` | Modify | Add right-click delete, empty state |
| `src/components/database/BoardView.tsx` | Modify | Add right-click delete, empty state |
| `src/components/database/BoardCard.tsx` | Modify | Add context menu trigger |
| `src/components/database/ListView.tsx` | Modify | DnD, empty state, pass handlers |
| `src/components/database/ListRow.tsx` | Modify | Implement menu, inline edit, DnD |
| `src/components/database/CalendarView.tsx` | Modify | Add right-click delete, empty state |
| `src/components/database/CalendarEventPill.tsx` | Modify | Add context menu trigger |
| `src/components/database/GalleryView.tsx` | Modify | DnD, empty state, pass handlers |
| `src/components/database/GalleryCard.tsx` | Modify | Inline editing, context menu, DnD |
| `src/components/database/TimelineView.tsx` | Modify | Inline editing, empty state |
| `src/components/database/TimelineBar.tsx` | Modify | Add context menu trigger |

---

**Last Updated:** 2026-02-25
