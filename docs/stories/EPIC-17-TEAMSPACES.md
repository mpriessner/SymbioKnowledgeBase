# Epic 17: Teamspaces

**Epic ID:** EPIC-17
**Created:** 2026-02-22
**Total Story Points:** 34
**Priority:** Medium
**Status:** Planned

---

## Epic Overview

Epic 17 introduces team collaboration features by adding shared workspaces (teamspaces) within a tenant. Currently, all pages in SymbioKnowledgeBase are private to a single user within a tenant. Teamspaces allow multiple users within the same tenant to share and collaborate on pages, providing team-level organization and access control.

This epic delivers the teamspace data model, sidebar organization with private and team sections, page sharing and visibility controls, team management UI, and real-time presence indicators showing who is currently viewing or editing a page.

This epic covers collaboration features that extend the existing single-user model to support team workflows within multi-tenant organizations.

---

## Business Value

- Enables team collaboration within the existing multi-tenant structure — teams can share knowledge without compromising tenant isolation
- Private vs. team sections provide clear mental models: "my pages" vs. "team pages"
- Presence indicators reduce edit conflicts by showing who's currently viewing/editing
- Team management UI allows workspace admins to control access without developer intervention
- Unlocks use cases like research teams, department wikis, and project-based knowledge sharing

---

## Architecture Summary

```
Tenant Isolation Layer (existing)
        │
        ├── User A (tenant X)
        │    │
        │    ├── Private Pages (only A can see)
        │    │
        │    └── Teamspace "Research" (A, B, C can all see)
        │         └── Shared Pages
        │
        ├── User B (tenant X)
        │    │
        │    ├── Private Pages (only B can see)
        │    │
        │    └── Teamspace "Research" (same as above)
        │
        └── User C (tenant Y) — completely isolated from tenant X

Database Schema
───────────────

  New Tables:
  ┌────────────────────────────────────────┐
  │ teamspaces                              │
  │ - id, tenantId, name, icon, createdAt  │
  └────────────────────────────────────────┘
           │
           ▼ teamspaceId
  ┌────────────────────────────────────────┐
  │ teamspace_members                       │
  │ - id, teamspaceId, userId, role         │
  │   (OWNER, ADMIN, MEMBER, GUEST)        │
  └────────────────────────────────────────┘

  Modified Tables:
  ┌────────────────────────────────────────┐
  │ pages                                   │
  │ - add: teamspaceId? (nullable)          │
  │                                         │
  │ teamspaceId = null → private page       │
  │ teamspaceId = X    → team page          │
  └────────────────────────────────────────┘

Sidebar Layout
──────────────

  ┌──────────────────────────────┐
  │  🔒 Private                   │
  │    └─ My Page 1              │
  │    └─ My Page 2              │
  │                               │
  │  👥 Research Team             │
  │    └─ Shared Doc A           │
  │    └─ Shared Doc B           │
  │                               │
  │  🚀 Product Team              │
  │    └─ Roadmap                │
  │    └─ Feature Specs          │
  └──────────────────────────────┘

API Flow (Page Sharing)
───────────────────────

  PATCH /api/pages/:id/share
    { teamspaceId: "uuid" | null }
    │
    ├── Validate user has access to teamspace
    ├── Update page.teamspaceId
    └── Return updated page

  GET /api/pages
    │
    ├── Filter by userId (private pages)
    ├── Union with teamspace pages (via teamspace_members)
    └── Return combined result

Presence System
───────────────

  GET /api/pages/:id/presence
    → Returns: [{ userId, userName, lastSeen }]
    (polling every 5s or WebSocket)

  POST /api/pages/:id/presence/heartbeat
    ← Send every 3s while page is open
    (updates presence record)
```

---

## Stories Breakdown

### SKB-17.1: Teamspace Data Model — 8 points, Critical

**Delivers:** New Prisma models: `Teamspace` (id, tenantId, name, icon, createdAt), `TeamspaceMember` (id, teamspaceId, userId, role enum: OWNER, ADMIN, MEMBER, GUEST). Modify `Page` model to add optional `teamspaceId` field. Database migration with indexes. API routes: `POST /api/teamspaces` (create), `GET /api/teamspaces` (list), `PATCH /api/teamspaces/:id` (update), `DELETE /api/teamspaces/:id` (delete — only if empty or owner). Member management routes: `POST /api/teamspaces/:id/members` (add), `DELETE /api/teamspaces/:id/members/:userId` (remove), `PATCH /api/teamspaces/:id/members/:userId` (update role). All queries scoped by tenant_id. Update page queries to include teamspace filtering.

**Depends on:** EPIC-02 (auth and tenant isolation must exist)

---

### SKB-17.2: Sidebar Team Sections — 5 points, High

**Delivers:** Sidebar component refactored to show two sections: "Private" (existing personal pages where teamspaceId IS NULL), and one section per teamspace the user is a member of. Each teamspace section shows: header with team icon + name, expandable tree of pages scoped to that teamspace (teamspaceId = X). Create page button within each teamspace context (creates page with teamspaceId pre-set). Fetch teamspaces from `GET /api/teamspaces` and pages from `GET /api/pages?teamspaceId=X`. Collapsible sections with state persistence in localStorage.

**Depends on:** SKB-17.1 (teamspace data model must exist)

---

### SKB-17.3: Page Sharing & Visibility — 8 points, High

**Delivers:** Share button on page header. Share modal with options: "Private" (teamspaceId = null), "Move to Team" (select teamspace dropdown, sets teamspaceId). Page permissions within teamspace based on TeamspaceMember role: VIEW (read-only), EDIT (edit blocks), FULL_ACCESS (edit + share + delete). Permission checks in `PATCH /api/pages/:id` and `DELETE /api/pages/:id` endpoints. Share link generation: `POST /api/pages/:id/share-link` creates a public read-only link (new `PublicShareLink` model with token, pageId, expiresAt). Public link rendering at `/shared/:token` (no auth required, read-only).

**Depends on:** SKB-17.1 (teamspace data model), SKB-17.2 (sidebar team sections)

---

### SKB-17.4: Team Management UI — 5 points, Medium

**Delivers:** Settings modal "Teams" section. Create teamspace form (name, icon picker). Edit teamspace (rename, change icon). Invite members by email: input email → lookup user by email within tenant → add to teamspace with role selector (ADMIN, MEMBER, GUEST). Role management: dropdown per member to change role (requires ADMIN or OWNER). Remove member button (requires ADMIN or OWNER, cannot remove OWNER). Leave team button (removes self from teamspace_members, disabled if OWNER and other members exist). Transfer ownership: select new owner → updates role to OWNER, demotes current owner to ADMIN. All actions call `/api/teamspaces/:id/members` endpoints. Error handling for "user not found", "already a member", "cannot remove last owner".

**Depends on:** SKB-17.1 (teamspace data model)

---

### SKB-17.5: Presence Indicators — 8 points, Medium

**Delivers:** Presence system showing who is currently viewing/editing a page. New `PagePresence` model (id, pageId, userId, tenantId, lastHeartbeat timestamp). API endpoints: `POST /api/pages/:id/presence/heartbeat` (updates lastHeartbeat to now), `GET /api/pages/:id/presence` (returns users with lastHeartbeat within last 10 seconds). Client sends heartbeat every 5 seconds via `useEffect` interval while page is open. Page header shows avatar dots for active users (stacked, max 5 visible, "+N more" indicator). "X is editing" indicator if lastHeartbeat < 10s. Polling every 5s to fetch presence (or WebSocket upgrade in future). Cleanup: cron job or background task removes presence records older than 1 minute.

**Depends on:** SKB-17.2 (sidebar team sections — presence only matters for team pages), SKB-17.3 (page sharing — presence only matters for shared pages)

---

## Test Coverage Requirements

| Story | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 17.1 | Prisma model validation, teamspace member role enum values, page teamspaceId filtering | Create teamspace → add member → query pages by teamspace, tenant isolation verified | API: POST /api/teamspaces returns 201, GET /api/teamspaces returns user's teams |
| 17.2 | Sidebar renders private and team sections, page tree filtered by teamspaceId | - | Sidebar shows "Private" section and two team sections for user in 2 teams |
| 17.3 | Share modal renders with team options, permission check logic (VIEW, EDIT, FULL_ACCESS) | Move page to team → page.teamspaceId updated, other team members can now see it | Share page to team → navigate as different user → page visible, edit permission enforced |
| 17.4 | Team management form validation, invite email lookup within tenant | Invite member → member added to teamspace_members, role assigned | Create team in UI → invite member by email → member sees team in sidebar |
| 17.5 | Heartbeat updates lastHeartbeat timestamp, presence query filters by 10s window | Send heartbeat → GET /api/pages/:id/presence returns user, wait 15s → user removed | Open page as User A → User B opens same page → both see each other's avatars |

---

## Implementation Order

```
17.1 → 17.2 → 17.3 (sequential)
       └────▶ 17.4 (parallel with 17.3 after 17.2)
              └────▶ 17.5 (after 17.3 and 17.4)

17.1  Teamspace Data Model (foundation)
  │
  ├──▶ 17.2  Sidebar Team Sections
  │      │
  │      ├──▶ 17.3  Page Sharing & Visibility
  │      │
  │      └──▶ 17.4  Team Management UI
  │             │
  │             └──▶ 17.5  Presence Indicators
```

---

## Shared Constraints

- All database queries must include `tenant_id` for multi-tenant isolation
- Teamspace queries must verify user membership via `teamspace_members` join
- API responses follow the standard envelope: `{ data, meta }` for success, `{ error, meta }` for failure
- TypeScript strict mode — no `any` types allowed
- All UI components use Tailwind utility classes only — no custom CSS classes
- Presence heartbeat interval: 5 seconds (client-side)
- Presence timeout: 10 seconds (server considers user "away" after 10s without heartbeat)
- Maximum teamspace members per team: 1000 (enforced in API)
- Page sharing permission hierarchy: OWNER > ADMIN > MEMBER > GUEST (GUEST = read-only)

---

## Files Created/Modified by This Epic

### New Files
- `prisma/migrations/XXX_add_teamspaces.sql` — Teamspace and TeamspaceMember tables
- `src/app/api/teamspaces/route.ts` — Create and list teamspaces
- `src/app/api/teamspaces/[id]/route.ts` — Update and delete teamspace
- `src/app/api/teamspaces/[id]/members/route.ts` — Add member to teamspace
- `src/app/api/teamspaces/[id]/members/[userId]/route.ts` — Remove or update member
- `src/app/api/pages/[id]/share/route.ts` — Move page between private and teamspace
- `src/app/api/pages/[id]/share-link/route.ts` — Generate public share link
- `src/app/api/pages/[id]/presence/route.ts` — Get current presence for page
- `src/app/api/pages/[id]/presence/heartbeat/route.ts` — Update presence heartbeat
- `src/components/sidebar/TeamSection.tsx` — Teamspace section in sidebar
- `src/components/page/ShareModal.tsx` — Page sharing UI
- `src/components/page/PresenceIndicators.tsx` — Avatar dots for active users
- `src/components/settings/TeamManagement.tsx` — Team management UI in settings
- `src/components/settings/CreateTeamModal.tsx` — Create teamspace modal
- `src/components/settings/InviteMemberModal.tsx` — Invite member modal
- `src/hooks/usePresence.ts` — Presence heartbeat and polling hook
- `src/hooks/useTeamspaces.ts` — TanStack Query hook for teamspaces
- `src/types/teamspace.ts` — Teamspace, TeamspaceMember, TeamspaceRole types
- `src/__tests__/api/teamspaces/route.test.ts`
- `src/__tests__/api/pages/share/route.test.ts`
- `src/__tests__/api/pages/presence/route.test.ts`
- `src/__tests__/components/sidebar/TeamSection.test.tsx`
- `src/__tests__/components/page/ShareModal.test.tsx`
- `src/__tests__/components/page/PresenceIndicators.test.tsx`
- `tests/e2e/teamspaces.spec.ts`

### Modified Files
- `prisma/schema.prisma` — Add Teamspace, TeamspaceMember, PagePresence models; add teamspaceId to Page
- `src/components/sidebar/Sidebar.tsx` — Refactor to show Private and Team sections
- `src/app/(workspace)/pages/[id]/page.tsx` — Add ShareModal and PresenceIndicators
- `src/app/(workspace)/settings/page.tsx` — Add Teams section
- `src/app/api/pages/route.ts` — Update query to include teamspace filtering
- `src/types/api.ts` — Add teamspace-related API response types

---

**Last Updated:** 2026-02-22
