# Epic 26: Critical Bug Fixes

**Epic ID:** EPIC-26
**Created:** 2026-02-25
**Total Story Points:** 16
**Priority:** Critical
**Status:** Draft

---

## Epic Overview

Four bugs prevent basic workflows from functioning:

1. **Page delete redirects outside the workspace.** When a user right-clicks a page in the sidebar and chooses "Delete", after the page is deleted, the app navigates to `/` (the unauthenticated landing page) instead of `/home` (the workspace home). This ejects the user from their workspace and they must navigate back in.

2. **Creating a database from the sidebar "+" menu shows "page not found".** When a user clicks "+" in the sidebar and selects "Database", the sidebar code calls `router.push("/databases")` — but that route does not exist. Only `/databases/[id]` exists for viewing a specific database. The correct flow should create a new page with a database and navigate to it.

3. **Search dialog doesn't close when clicking outside.** Both the Quick Switcher (Cmd+K) and Enhanced Search (Cmd+Shift+F) dialogs can only be closed by pressing Escape. Clicking the dark backdrop area outside the dialog does nothing. Users expect clicking outside a modal to dismiss it.

4. **List and Calendar view items navigate away instead of allowing inline editing.** In the List view and Calendar view, clicking on an item's title to rename it causes the app to navigate to the page (leaving the database view entirely). Users expect to edit the title in place. Additionally, the List view should always show checkmarks next to items for task tracking.

---

## Business Value

- **Delete redirect:** Users lose context and trust when the app boots them to the login page after a routine action
- **Database creation:** Users cannot create new databases from the primary entry point (sidebar "+" button), blocking a core workflow
- **Search dismiss:** Users get stuck in the search dialog and must know to press Escape — clicking outside does nothing, which violates standard modal UX patterns
- **List/Calendar editing:** Users cannot rename items in List or Calendar views without being ejected from the database — a basic editing workflow is completely broken

---

## Root Cause Analysis

### Delete Redirect
- **File:** `src/components/sidebar/PageContextMenu.tsx`, line 176
- **Bug:** `router.push("/")` — hardcoded to root instead of `/home`
- **Fix:** Change to `router.push("/home")`

### Database Creation
- **File:** `src/components/workspace/Sidebar.tsx`, lines 55-58
- **Bug:** `router.push("/databases")` — route does not exist
- **Fix:** Create a new page + database via API (matching how `PageCreationMenu.tsx` does it), then navigate to the created database page

### Search Dialog Click-Outside Dismiss
- **Files:** `src/components/search/SearchDialog.tsx` (line ~224) and `src/components/search/EnhancedSearchDialog.tsx` (line ~279)
- **Bug:** The outer wrapper uses `onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}` — but a child backdrop `div` (`absolute inset-0 bg-black/50`) sits inside the wrapper and intercepts the click. When the user clicks the backdrop, `e.target` is the backdrop (child), not the outer wrapper (`e.currentTarget`), so `onClose()` never fires.
- **Fix:** Add `onClick={onClose}` directly to the backdrop `div`, or add `pointer-events-none` to the backdrop so clicks pass through to the parent wrapper

### List & Calendar View Title Click Navigates Away
- **Files:** `src/components/database/ListView.tsx` (lines 91-99) and `src/components/database/CalendarView.tsx` (lines 246-251)
- **Bug:** Both views call `router.push(/pages/${pageId})` on ANY row/event click. Clicking the title to edit it navigates away from the database entirely. No inline editing exists — the title is a plain `<span>` with no input field.
- **Fix:** Single-click on title should enter inline edit mode (replace `<span>` with `<input>`), double-click or separate "Open" action should navigate to the page. Additionally, the List view should always display checkboxes next to items (not only when a CHECKBOX column exists in the schema).

---

## Stories Breakdown

### SKB-26.1: Fix Page Delete Navigation — 2 points, Critical

**Delivers:** After deleting a page, the user stays in the workspace (redirected to `/home`) instead of being sent to the landing page.

**Acceptance Criteria:**
- Right-click any page in the sidebar, click Delete, confirm
- If the deleted page was the one you were viewing, you land on the Home screen with sidebar visible
- If you were viewing a different page, you stay on that page (no redirect at all)
- The sidebar refreshes to no longer show the deleted page
- Works for pages in Private, Teams, and Agent sections

**Files to modify:**
| File | Change |
|------|--------|
| `src/components/sidebar/PageContextMenu.tsx` | Line 176: change `router.push("/")` to `router.push("/home")` |

**Verification:**
1. Open a page, right-click it in the sidebar, delete it
2. Confirm you land on `/home` (not `/`)
3. Sidebar no longer shows the deleted page
4. Repeat while viewing a different page — confirm no redirect happens

**Do NOT break:**
- Delete confirmation dialog must still appear
- Page data must still be removed from database
- Sidebar tree must still refresh after deletion
- Undo/toast notifications (if any) must still work

---

### SKB-26.2: Fix Database Creation from Sidebar Menu — 6 points, Critical

**Delivers:** Clicking "+" then "Database" in the sidebar creates a new database page and navigates to it, instead of showing "page not found".

**Acceptance Criteria:**
- Click "+" in the sidebar, select "Database"
- A new page is created with a database attached
- The app navigates to `/databases/{new-id}` showing the new empty database
- The new page appears in the sidebar under the correct section
- The database has a default "Table" view with a basic schema (Title column at minimum)

**Implementation approach:**
1. In `Sidebar.tsx`, replace `router.push("/databases")` with logic that:
   - POST to `/api/pages` to create a new page (title: "Untitled Database")
   - POST to `/api/databases` to create a database linked to that page with a default schema
   - Navigate to `/databases/{database.id}`
2. Reference `PageCreationMenu.tsx` lines 285-287 (`handleCreateDatabaseView`) for the working pattern
3. Ensure the sidebar tree query is invalidated so the new page appears

**Files to modify:**
| File | Change |
|------|--------|
| `src/components/workspace/Sidebar.tsx` | Replace `handleNewDatabase` to create page + database via API, then navigate to it |

**Do NOT break:**
- The existing "Database" creation flow inside `PageCreationMenu.tsx` (inline on a page) must continue to work
- Sidebar tree refresh must work
- Database view container and table view must render for the new database
- Page title must be editable after creation

**Verification:**
1. Click "+" in sidebar, select "Database"
2. A new database page opens (no "page not found" error)
3. The database shows an empty table view
4. The new page appears in the sidebar
5. You can add rows to the table

---

### SKB-26.3: Fix Search Dialog Click-Outside Dismiss — 2 points, Medium

**Delivers:** Clicking outside the search dialog (on the dark backdrop) closes it, matching standard modal behavior.

**Details:** See [SKB-26.3 story file](SKB-26.3-fix-search-dialog-click-outside-dismiss.md)

---

### SKB-26.4: Fix List & Calendar View Title Editing — 6 points, Critical

**Delivers:** Clicking on an item title in the List view or Calendar view allows inline editing instead of navigating away. List view always shows checkboxes for task tracking.

**Details:** See [SKB-26.4 story file](SKB-26.4-fix-list-calendar-view-title-editing.md)

---

## Test Coverage Requirements

| Story | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 26.1 | After delete, `router.push` called with `/home` not `/` | Delete page API returns 204; sidebar refreshes; navigation correct | Right-click delete on current page lands on home; delete non-current page stays on current |
| 26.2 | `handleNewDatabase` calls create page + create database APIs | POST page returns 201; POST database returns 201; navigation to `/databases/{id}` works | Click "+ > Database" creates and opens a functional database |
| 26.3 | Backdrop div has `onClick={onClose}` or `pointer-events-none`; `onClose` called on backdrop click | Both SearchDialog and EnhancedSearchDialog close on backdrop click | Open Cmd+K, click outside → closes; open Cmd+Shift+F, click outside → closes |
| 26.4 | Title click enters edit mode (input rendered); no `router.push` on title click; checkboxes render in List view | `updateRow` called on title save; navigation only on double-click/Open action | Click title in List/Calendar → edit inline; checkboxes visible in List; double-click opens page |

---

## Implementation Order

```
26.1 (quick fix) → 26.2 (requires API calls)
26.3 and 26.4 are independent — can run in parallel

┌──────┐    ┌──────┐
│ 26.1 │ →  │ 26.2 │
│ Del  │    │ DB   │
│ Nav  │    │Create │
└──────┘    └──────┘

┌──────┐    ┌──────┐
│ 26.3 │    │ 26.4 │  (both parallel)
│Search│    │ List │
│Dismiss│   │ Cal  │
└──────┘    └──────┘
```

---

## Shared Constraints

- **No Breaking Changes:** All existing delete, database creation, and search flows must continue working
- **Error Handling:** If database creation fails, show a toast error and don't leave user on a broken page
- **Loading State:** Show a spinner or loading indicator while the database is being created

---

## Files Modified by This Epic

| File | Action | Description |
|------|--------|-------------|
| `src/components/sidebar/PageContextMenu.tsx` | Modify | Fix redirect from `/` to `/home` |
| `src/components/workspace/Sidebar.tsx` | Modify | Replace broken `router.push("/databases")` with create-then-navigate flow |
| `src/components/search/SearchDialog.tsx` | Modify | Fix backdrop click to call `onClose` |
| `src/components/search/EnhancedSearchDialog.tsx` | Modify | Fix backdrop click to call `onClose` |
| `src/components/database/ListView.tsx` | Modify | Change click handler: single-click title → inline edit, double-click → navigate |
| `src/components/database/ListRow.tsx` | Modify | Add inline title editing input, always show checkboxes |
| `src/components/database/CalendarView.tsx` | Modify | Change event click: single-click → inline edit, double-click → navigate |
| `src/components/database/CalendarEventPill.tsx` | Modify | Add inline title editing to event pill |

---

**Last Updated:** 2026-02-27
