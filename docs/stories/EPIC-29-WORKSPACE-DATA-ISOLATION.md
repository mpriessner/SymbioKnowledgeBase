# Epic 29: Workspace Data Isolation

**Epic ID:** EPIC-29
**Created:** 2026-02-25
**Total Story Points:** 10
**Priority:** High
**Status:** Not Started
**Notes:** Neither story has been implemented. No cache clearing on workspace creation (SKB-29.1) or workspace switching (SKB-29.2). Users may see stale data from other workspaces after switching.

**Remaining work:**
- SKB-29.1: Clear React Query cache on workspace creation, create welcome page
- SKB-29.2: Full client state reset on workspace switch (queryClient.clear(), loading state, scope verification)

---

## Epic Overview

When a user creates a new workspace and switches to it, they see the same pages and data as the original workspace. A new workspace should start completely empty (except for a default welcome page), so the user can fill it with fresh content.

**Root cause:** The backend data isolation is correctly implemented — all API queries filter by `tenantId`. The issue is likely that:
1. After workspace creation, the `skb_active_workspace` cookie is set, but the client-side query cache still holds the old workspace's data
2. The `window.location.reload()` after creation should clear the cache, but the dev-mode auth fallback (`userId: "dev-user"`) may resolve to the wrong tenant
3. The seed scripts create pages under the default tenant — when switching workspaces, the page tree API correctly returns empty results, but the sidebar may show cached data

**Investigation confirmed:** The backend (`tenantContext.ts`) properly resolves the active workspace from the cookie and validates membership. The `POST /api/workspaces` creates an empty tenant with only the creator as a member. The issue is in the client-side data flow after creation/switching.

---

## Business Value

- Users expect a new workspace to be a blank slate — seeing old data is confusing and breaks trust
- Multi-workspace support is a key feature for separating projects, teams, or clients
- Data leaking between workspaces (even visually) feels like a bug

---

## Stories Breakdown

### SKB-29.1: Ensure Clean State After Workspace Creation — 5 points, High

**Delivers:** Creating a new workspace switches to it and shows an empty workspace with only a welcome page.

**Acceptance Criteria:**
- Click workspace dropdown, select "Create workspace", enter a name, confirm
- The app reloads and shows the new workspace name in the sidebar header
- The sidebar shows only a default "Welcome to {workspace name}" page (auto-created)
- The "All Pages" section on the Home screen shows only the welcome page
- The Graph view shows only the welcome page node
- No pages from the previous workspace appear anywhere
- The recently visited section is empty (or shows only the new welcome page)

**Implementation approach:**
1. In `WorkspaceCreateDialog.tsx`: after successful POST to `/api/workspaces`, ensure the response sets the `skb_active_workspace` cookie (already done server-side)
2. Before `window.location.reload()`, clear the React Query cache: `queryClient.clear()` — this ensures no stale data from the previous workspace
3. In the workspace POST handler (`/api/workspaces/route.ts`): after creating the tenant, also create a default welcome page with a simple welcome block, so the new workspace isn't completely empty
4. Verify the `withTenant` middleware correctly reads the new cookie value on reload

**Files to modify:**
| File | Change |
|------|--------|
| `src/components/workspace/WorkspaceCreateDialog.tsx` | Clear query cache before reload |
| `src/app/api/workspaces/route.ts` | Create default welcome page in new workspace |
| `src/hooks/useWorkspaces.ts` | Ensure cache invalidation on workspace switch |

**Do NOT break:**
- Existing workspace data — switching back to the original workspace must show all its pages
- The `skb_active_workspace` cookie flow
- The seed scripts (they create data for the default tenant only)
- Dev-mode auth fallback behavior

**Verification:**
1. Start in the default workspace with 44+ pages
2. Create a new workspace called "Test Project"
3. After reload: sidebar shows "Test Project" name, only a welcome page visible
4. Home screen shows only the welcome page
5. Switch back to original workspace — all 44 pages reappear
6. Switch to "Test Project" again — still only the welcome page

---

### SKB-29.2: Fix Workspace Switching to Fully Reset Client State — 5 points, High

**Delivers:** Switching between workspaces reliably shows only that workspace's data with no stale content.

**Acceptance Criteria:**
- From workspace dropdown, select a different workspace
- The app reloads and shows the selected workspace's data
- No pages, databases, or notifications from the previous workspace appear
- The sidebar tree is freshly loaded from the API (not cached)
- The "recently visited" section only shows pages from the current workspace
- Rapid switching (back and forth) does not cause data mixing

**Implementation approach:**
1. In the workspace switch handler: call `queryClient.clear()` before triggering reload
2. Verify the switch API (`/api/workspaces/switch`) sets the cookie correctly
3. Add a loading state during workspace switch (brief spinner overlay) to prevent seeing stale data
4. In `useRecentPages` hook: ensure recent pages are scoped to the current workspace (tenant)
5. In `Sidebar.tsx`: verify the page tree query key includes the workspace/tenant context so React Query treats different workspaces as different queries

**Files to modify:**
| File | Change |
|------|--------|
| `src/components/workspace/WorkspaceDropdown.tsx` | Clear query cache before workspace switch reload |
| `src/hooks/useWorkspaces.ts` | Add loading state for switch; ensure cache clearing |
| `src/hooks/useRecentPages.ts` | Scope recent pages to current workspace |
| `src/components/workspace/Sidebar.tsx` | Verify query keys include workspace context |

**Do NOT break:**
- Workspace membership validation (can't switch to a workspace you're not a member of)
- Cookie-based workspace persistence (refresh should stay in same workspace)
- Page creation — new pages must go to the active workspace
- Teamspace display — teamspaces are per-workspace

---

## Test Coverage Requirements

| Story | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 29.1 | Welcome page created on workspace creation; query cache cleared | POST workspace returns 201; welcome page exists; page tree returns only welcome page | Create workspace, verify empty sidebar, switch back, verify original data intact |
| 29.2 | Switch clears cache; recent pages scoped to workspace | Cookie set correctly; page tree returns correct data per workspace | Switch workspace 3 times, verify correct data each time |

---

## Implementation Order

```
29.1 (creation) → 29.2 (switching — can test after creation works)

┌──────┐    ┌──────┐
│ 29.1 │ →  │ 29.2 │
│Create│    │Switch│
│Clean │    │Clean │
└──────┘    └──────┘
```

---

## Shared Constraints

- **Data safety:** This epic must NEVER delete data from another workspace — it only controls what is displayed
- **Cookie management:** All workspace context flows through the `skb_active_workspace` cookie
- **Dev mode:** The dev-mode fallback (`userId: "dev-user"`) must respect the active workspace cookie
- **Performance:** Cache clearing on switch is a one-time cost — acceptable for correctness

---

## Files Modified by This Epic

| File | Action | Description |
|------|--------|-------------|
| `src/components/workspace/WorkspaceCreateDialog.tsx` | Modify | Clear cache before reload |
| `src/components/workspace/WorkspaceDropdown.tsx` | Modify | Clear cache on workspace switch |
| `src/app/api/workspaces/route.ts` | Modify | Create welcome page in new workspace |
| `src/hooks/useWorkspaces.ts` | Modify | Cache management and loading state |
| `src/hooks/useRecentPages.ts` | Modify | Scope to current workspace |

---

**Last Updated:** 2026-02-25
