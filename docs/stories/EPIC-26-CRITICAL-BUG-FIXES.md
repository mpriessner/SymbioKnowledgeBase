# Epic 26: Critical Bug Fixes (Delete Redirect & Database Creation)

**Epic ID:** EPIC-26
**Created:** 2026-02-25
**Total Story Points:** 8
**Priority:** Critical
**Status:** Draft

---

## Epic Overview

Two critical bugs prevent basic workflows from functioning:

1. **Page delete redirects outside the workspace.** When a user right-clicks a page in the sidebar and chooses "Delete", after the page is deleted, the app navigates to `/` (the unauthenticated landing page) instead of `/home` (the workspace home). This ejects the user from their workspace and they must navigate back in.

2. **Creating a database from the sidebar "+" menu shows "page not found".** When a user clicks "+" in the sidebar and selects "Database", the sidebar code calls `router.push("/databases")` — but that route does not exist. Only `/databases/[id]` exists for viewing a specific database. The correct flow should create a new page with a database and navigate to it.

---

## Business Value

- **Delete redirect:** Users lose context and trust when the app boots them to the login page after a routine action
- **Database creation:** Users cannot create new databases from the primary entry point (sidebar "+" button), blocking a core workflow

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

## Test Coverage Requirements

| Story | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 26.1 | After delete, `router.push` called with `/home` not `/` | Delete page API returns 204; sidebar refreshes; navigation correct | Right-click delete on current page lands on home; delete non-current page stays on current |
| 26.2 | `handleNewDatabase` calls create page + create database APIs | POST page returns 201; POST database returns 201; navigation to `/databases/{id}` works | Click "+ > Database" creates and opens a functional database |

---

## Implementation Order

```
26.1 (quick fix) → 26.2 (requires API calls)

┌──────┐    ┌──────┐
│ 26.1 │ →  │ 26.2 │
│ Del  │    │ DB   │
│ Nav  │    │ Create│
└──────┘    └──────┘
```

---

## Shared Constraints

- **No Breaking Changes:** All existing delete and database creation flows must continue working
- **Error Handling:** If database creation fails, show a toast error and don't leave user on a broken page
- **Loading State:** Show a spinner or loading indicator while the database is being created

---

## Files Modified by This Epic

| File | Action | Description |
|------|--------|-------------|
| `src/components/sidebar/PageContextMenu.tsx` | Modify | Fix redirect from `/` to `/home` |
| `src/components/workspace/Sidebar.tsx` | Modify | Replace broken `router.push("/databases")` with create-then-navigate flow |

---

**Last Updated:** 2026-02-25
