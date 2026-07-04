# A70-10 — Page comments (the CAN_COMMENT permission currently grants nothing)

## Provenance & ownership
- **Project owner:** Martin Priessner (martin.priessner@scisymbio.ai)
- **Created by:** Agent 70
- **Created:** 2026-07-03
- **Status:** draft (improvement — do not implement yet)
- **Assigned to / currently owned by:** unassigned
- **Related / parallel work:** `SKB-25.2-share-dialog-and-page-permissions.md` (defined CAN_COMMENT), `SKB-16.x` notifications (comment notifications should reuse triggers).

## Problem
`CAN_COMMENT` is a defined permission level, selectable in the share dialog and
stored in the schema — but comments do not exist: no Comment model, no API, no
UI. Users can grant a permission to a feature that isn't there. Comments are a
core Notion collaboration staple.

## Evidence
- Permission surfaced: `src/components/page/PermissionDropdown.tsx:14-23`;
  `Permission` enum (note: named `Permission`, not `PermissionLevel`) at
  `prisma/schema.prisma:87-92` (CAN_COMMENT at :90), stored on
  `PageShare.permission` (`schema.prisma:620`).
- Repo-wide grep: no Comment model/route/component.
- Implementation note: locate and reuse the existing permission-CHECK helper
  used by the share/page-access path (the draft only cites storage) — the
  comment routes must enforce through the same check, not a new one.

## Scope
1. `Comment` model: id, tenantId, pageId, authorId, body (plain/rich-lite),
   optional parentCommentId (one-level threads), resolved flag, timestamps.
2. CRUD API under `/api/pages/[id]/comments` (tenant-scoped; CAN_COMMENT or
   higher required to create; author-or-admin to edit/delete; resolve toggle).
3. UI: comments panel on the page (right side or below title), thread display,
   resolve/unresolve, unresolved-count badge in the page header.
4. Notifications: comment-on-your-page + reply-to-your-comment via the existing
   notification triggers.
5. Agent API parity: expose list/create in the agent surface (audit-logged),
   consistent with other agent endpoints.

## Out of scope
- Block-anchored inline comments (anchor to a block id) — note as follow-up;
  v1 is page-level threads. Mentions-in-comments reuse existing mention logic
  only if trivial.

## Acceptance criteria
- AC1: A CAN_COMMENT user can comment but not edit the page; CAN_VIEW cannot
  comment.
- AC2: Threads render, resolve hides by default with a "show resolved" toggle.
- AC3: Author gets a notification on replies; page followers on new comments.
- AC4: Tenant isolation on every query; tests for permission matrix.
- AC5: tsc + vitest green; migration included.

## Affected files (expected)
- `prisma/schema.prisma` + migration
- new `src/app/api/pages/[id]/comments/*`
- new `src/components/page/CommentsPanel.tsx`
- notification trigger wiring

## Verification
Unit tests for the permission matrix + live two-user check.
