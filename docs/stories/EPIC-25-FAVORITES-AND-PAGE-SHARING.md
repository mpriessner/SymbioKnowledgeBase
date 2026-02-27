# Epic 25: Page Favorites & Sharing

**Epic ID:** EPIC-25
**Created:** 2026-02-25
**Total Story Points:** 24
**Priority:** High
**Status:** Done
**Completed:** 2026-02-27
**Notes:** All 3 stories implemented: page favorites with sidebar integration, share dialog with permission management, publish to web via public share links.

---

## Epic Overview

Epic 25 adds two major features to SymbioKnowledgeBase that bring it closer to Notion's page management experience:

1. **Page Favorites** — A star icon in the top-right of each page allows users to mark pages as favorites. Favorited pages appear in a dedicated "Favorites" section in the sidebar, positioned between "Recents" and "Private". The existing context menu already has a stubbed "Add to favorites" action (`PageContextMenu.tsx:150-154`) that will be wired up.

2. **Page Sharing & Permissions** — A "Share" button in the top-right of each page opens a dialog modeled after Notion's share panel. The dialog has two tabs:
   - **Share tab:** Invite members by email, view current members with their access levels, change permissions (Full access, Can edit, Can comment, Can view), copy shareable link, set general access (Only people invited / Anyone with link).
   - **Publish tab:** Publish a page publicly so anyone with the URL can view it, with options for SEO and allowing search engine indexing.

Currently, SymbioKnowledgeBase has:
- `PageHeader.tsx` with an Export Markdown button at top-right (`absolute right-4 top-2`)
- `PageContextMenu.tsx` with a stubbed "Add to favorites" action (line 150-154, uses `Star` icon from lucide-react)
- `useRecentPages` hook using localStorage for recent page tracking
- `PublicShareLink` model in Prisma (`schema.prisma:359-379`) for basic public link sharing
- No favorites model, no page-level permissions, no member-level sharing

This epic adds:
1. **Favorite star button** in the page header (next to Export)
2. **Favorites sidebar section** between Recents and Private
3. **Database-backed favorites** with per-user, per-tenant storage
4. **Share button** in the page header
5. **Share dialog** with member invite, permission management, and copy link
6. **Page permissions model** (Full access, Can edit, Can comment, Can view)
7. **Publish tab** for making pages publicly accessible

**Out of scope:**
- Group-based permissions (only individual user sharing)
- "Suggest" mode (edit suggestions / change tracking)
- Workspace-wide default permissions
- Page locking

**Dependencies:**
- Supabase auth with NextAuth (done)
- Page CRUD API (done)
- Sidebar with sections (done)
- PublicShareLink model (done — will be extended)

---

## Business Value

- **Productivity:** Favorites let power users pin their most-used pages for instant access, reducing navigation time
- **Collaboration Foundation:** Sharing with permissions is the cornerstone of team collaboration — essential for multi-user workspaces
- **Notion Parity:** Both features are core Notion interactions that users expect; their absence is immediately noticed
- **Growth Enabler:** Sharing with "Copy link" and public publish enables viral distribution of content

---

## Architecture Summary

```
Favorites Architecture:
───────────────────────

Database:
┌──────────────┐       ┌───────────────────┐       ┌──────────┐
│    User      │       │  PageFavorite     │       │   Page   │
│              │       │                   │       │          │
│  id ─────────┼──────▶│  userId           │       │  id ◀────┼──── pageId
│              │       │  pageId ──────────┼──────▶│          │
│              │       │  tenantId         │       │          │
│              │       │  createdAt        │       │          │
└──────────────┘       └───────────────────┘       └──────────┘
                       @@unique([userId, pageId])

UI Flow:
  Page header: [Export ↓] [★ Favorite] [Share]  [···]
                              │
                              ▼
              POST /api/pages/{id}/favorite  →  Toggle in DB
                              │
                              ▼
              Sidebar re-renders "Favorites" section

Sharing Architecture:
─────────────────────

Database:
┌──────────────┐       ┌───────────────────┐       ┌──────────┐
│    User      │       │  PageShare        │       │   Page   │
│              │       │                   │       │          │
│  id ─────────┼──────▶│  userId           │       │  id ◀────┼──── pageId
│              │       │  pageId ──────────┼──────▶│          │
│              │       │  tenantId         │       │          │
│              │       │  permission       │       │          │
│              │       │  (FULL_ACCESS |   │       │          │
│              │       │   CAN_EDIT |      │       │          │
│              │       │   CAN_COMMENT |   │       │          │
│              │       │   CAN_VIEW)       │       │          │
│              │       │  sharedBy         │       │          │
│              │       │  createdAt        │       │          │
└──────────────┘       └───────────────────┘       └──────────┘
                       @@unique([userId, pageId])

Share Dialog (Notion-style):
┌──────────────────────────────────────────────┐
│  ┌──────┐  ┌─────────┐                      │
│  │Share │  │ Publish  │         (tabs)       │
│  └──────┘  └─────────┘                      │
│                                              │
│  ┌────────────────────────────┐ ┌──────────┐│
│  │ Email or group, sep by ,   │ │  Invite  ││
│  └────────────────────────────┘ └──────────┘│
│                                              │
│  (M) Martin Priessner (You)    Full access ▾│
│  (J) jane@example.com          Can edit    ▾│
│                                              │
│  General access                              │
│  🔒 Only people invited          ▾          │
│                                              │
│  ⓘ Learn about sharing    🔗 Copy link      │
└──────────────────────────────────────────────┘
```

---

## Stories Breakdown

### SKB-25.1: Page Favorites — 5 points, High

**Delivers:** Star icon in the page header to toggle favorites, a "Favorites" section in the sidebar between Recents and Private, database-backed favorites with API, and wiring the existing context menu stub.

**Depends on:** Nothing (first story)

---

### SKB-25.2: Share Dialog & Page Permissions — 13 points, High

**Delivers:** A "Share" button in the page header that opens a Notion-style share dialog. Invite members by email, manage per-page permissions (Full access, Can edit, Can comment, Can view), view member list, set general access level, and copy shareable link.

**Depends on:** SKB-25.1 (share button sits next to favorite star in header)

---

### SKB-25.3: Publish to Web — 6 points, Medium

**Delivers:** A "Publish" tab in the share dialog that allows pages to be published publicly. Generates a public URL, provides toggle for search engine indexing, and extends the existing `PublicShareLink` model.

**Depends on:** SKB-25.2 (publish tab lives inside the share dialog)

---

## Test Coverage Requirements

| Story | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 25.1 | Star button renders; toggle updates state; favorites section appears in sidebar; context menu wired | Favorite API creates/deletes record; sidebar shows favorited pages; unfavorite removes from sidebar | Star a page → appears in favorites sidebar → unstar → disappears |
| 25.2 | Share dialog renders tabs; member list shows permissions; invite input validates email; permission dropdown works | Share API creates PageShare record; permission change updates DB; copy link generates URL | Click Share → invite user → see in member list → change permission → remove |
| 25.3 | Publish tab renders toggle; public URL shown; SEO options work | Publish API updates PublicShareLink; public URL serves page; unpublish revokes access | Publish page → open public URL in incognito → content visible → unpublish → 404 |

---

## Implementation Order

```
25.1 → 25.2 → 25.3

┌────────┐     ┌────────┐     ┌────────┐
│ 25.1   │────▶│ 25.2   │────▶│ 25.3   │
│Favorite│     │ Share  │     │Publish │
└────────┘     └────────┘     └────────┘
```

---

## Shared Constraints

- **Multi-Tenant Isolation:** All favorites and shares are scoped to the current tenant
- **Per-User Favorites:** Favorites are per-user, not global — each user has their own favorites list
- **TypeScript Strict:** No `any` types in new code
- **Theming:** All new UI elements support light and dark themes via CSS custom properties
- **Keyboard Navigation:** All buttons and dialogs must be keyboard-accessible
- **Optimistic Updates:** Favorite toggle should use optimistic updates for instant feedback
- **Existing Patterns:** Follow `usePages` / `useRecentPages` hook patterns, `withTenant` API middleware

---

## Files Created/Modified by This Epic

### New Files
- `src/components/page/FavoriteButton.tsx` — Star toggle button
- `src/components/page/ShareButton.tsx` — Share button component
- `src/components/page/ShareDialog.tsx` — Share dialog with tabs
- `src/components/page/ShareDialogMemberList.tsx` — Member list with permissions
- `src/components/page/ShareDialogInvite.tsx` — Email invite input
- `src/components/page/ShareDialogPublish.tsx` — Publish tab content
- `src/components/page/PermissionDropdown.tsx` — Permission level selector
- `src/hooks/useFavorites.ts` — Favorite pages hook (toggle, list)
- `src/hooks/usePageShares.ts` — Page sharing hook (CRUD, permissions)
- `src/app/api/pages/[id]/favorite/route.ts` — Favorite toggle API
- `src/app/api/pages/[id]/share/route.ts` — Share CRUD API
- `src/app/api/pages/[id]/publish/route.ts` — Publish API
- `src/app/api/favorites/route.ts` — List all favorites for sidebar
- Tests for each component and hook

### Modified Files
- `prisma/schema.prisma` — Add `PageFavorite`, `PageShare` models, `Permission` enum
- `src/components/workspace/PageHeader.tsx` — Add Favorite and Share buttons
- `src/components/workspace/Sidebar.tsx` — Add Favorites section
- `src/components/sidebar/PageContextMenu.tsx` — Wire "Add to favorites" action
- `src/types/page.ts` — Add `isFavorite`, sharing-related types

---

**Last Updated:** 2026-02-25
