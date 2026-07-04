# A70-05 — Workspace settings quick wins (rename workspace, real General settings page)

## Provenance & ownership
- **Project owner:** Martin Priessner (martin.priessner@scisymbio.ai)
- **Created by:** Agent 70
- **Created:** 2026-07-03
- **Status:** implemented (pending live verify)
- **Assigned to / currently owned by:** Agent 70 (implement after review)
- **Related / parallel work:** `EPIC-04-SETTINGS-COMPLETION.md`, `SKB-12.1-settings-modal.md`. External invitations split to [A70-19](2026-07-03-a70-19-external-member-invitations.md); 2FA/passkeys split to [A70-20](2026-07-03-a70-20-account-security-mfa.md).

## Problem
Two long-standing "coming soon" stubs make the product feel unfinished the
moment a user opens Settings: the workspace name field is hard-coded to
"SymbioKnowledgeBase" and disabled, and the whole Settings → General page is a
placeholder card. Both are small once a rename-tenant endpoint exists.

## Evidence
- `src/components/workspace/SettingsModal.tsx:352-361` — disabled name input,
  hard-coded value.
- `src/app/(workspace)/settings/general/page.tsx:21` — "coming soon" placeholder.
- No tenant-rename endpoint exists.
- **Active-workspace resolution (corrected in round 2):** `getTenantContext`
  ALREADY resolves the `skb_active_workspace` cookie, verifies TenantMember
  membership, and sets `ctx.tenantId` to it (`src/lib/tenantContext.ts:96-110`)
  — so a PATCH keyed on `ctx.tenantId` already targets the workspace the user
  is looking at. The workspaces GET's separate `activeId` computation
  (`workspaces/route.ts:38-40`) is only for the `isCurrent` display flag.
- **Role subtlety (the real trap):** `ctx.role` is the GLOBAL `dbUser.role`
  (`tenantContext.ts:115`), NOT the per-workspace `TenantMember.role` (owner
  seeded at `workspaces/route.ts:20`). The admin gate must query
  `TenantMember.role` for `(userId, ctx.tenantId)` explicitly — keying off
  `ctx.role` would allow/reject the wrong users.

## Scope
1. `PATCH /api/workspaces/current`: rename the active workspace using
   `ctx.tenantId` (already cookie-resolved — see Evidence). zod-validated
   name (1–100 chars trimmed). **Restrict to workspace owner/admin by
   querying `TenantMember.role` for the resolved tenant** — do NOT use
   `ctx.role` (global role, wrong scope).
2. SettingsModal: enable the name field, load the real active-tenant name,
   save on blur/submit with optimistic update + toast. On success,
   **invalidate/refetch the workspaces list query** (source of the sidebar
   dropdown name) — not just modal-local state, or the sidebar stays stale
   until reload.
3. Settings → General page: replace the placeholder with a real form hosting
   the same workspace-name control (+ read-only workspace id, created date).
   Non-admin members see the name read-only with a hint.

## Acceptance criteria
- AC1: Renaming persists across reload and updates the sidebar workspace
  dropdown without a manual refresh.
- AC2: After switching workspaces, rename targets the workspace currently
  shown (covered by `getTenantContext`'s cookie resolution — regression test
  confirms).
- AC3: Validation errors surface inline; server enforces them; a user whose
  `TenantMember.role` is not owner/admin gets 403 and a read-only field —
  including when their GLOBAL role is admin (regression test for the
  ctx.role trap).
- AC4: A user cannot rename a tenant they don't belong to (404/403).
- AC5: tsc + vitest green; unit tests for the rename route (per-workspace
  role gate).

## Affected files (expected)
- new `src/app/api/workspaces/current/route.ts` (or PATCH on existing route)
- `src/components/workspace/SettingsModal.tsx`
- `src/app/(workspace)/settings/general/page.tsx`

## Verification
Unit tests + live check: rename, reload, name persists everywhere; switch
workspace then rename → correct tenant renamed. Playwright screenshot.

## Reviewer Feedback / Codex (round 1) — FALLBACK: Claude Opus
*(Codex CLI broken: native binary ENOENT; lens covered by Claude Opus subagent per /story fallback rules.)*
- **(Critical)** `ctx.tenantId` may differ from the cookie-selected active workspace (`workspaces/route.ts:38-40`) — a rename keyed on ctx.tenantId could rename the WRONG tenant after a switch. → Cookie-first target resolution (Scope 1, AC2).
- Role gate: `TenantMember.role` exists (owner seeded) — restrict rename to owner/admin instead of leaving it open. → Scope 1, AC3.
- Sidebar dropdown reads the workspaces list payload — invalidate that query or the name stays stale. → Scope 2, AC1.

## Reviewer Feedback / GLM (round 2 — runtime lens, glm-5.2)
- **(Critical, corrects round 1)** The round-1 "cookie-first resolution" fix was a FALSE premise: `getTenantContext` already resolves `skb_active_workspace` into `ctx.tenantId` with membership verification (`tenantContext.ts:96-110`); the GET's `activeId` computation is display-only. → Scope reverted to plain `ctx.tenantId`.
- **(Real trap kept)** `ctx.role` is the global `dbUser.role` (`tenantContext.ts:115`), not `TenantMember.role` — the admin gate must query the per-workspace role explicitly. → Scope 1, AC3 regression test.

## Revision History
- 2026-07-03 — Initial draft (Agent 70).
- 2026-07-03 — Round-1 regression review (Opus fallback for Codex): cookie-first tenant resolution, owner/admin gate, workspaces-query invalidation.
- 2026-07-03 — Round-2 GLM runtime review: round-1 cookie premise corrected (ctx.tenantId already cookie-resolved); per-workspace role gate pinned. Status: Reviewed — ready to implement.
- 2026-07-03 — Implemented: PATCH /api/workspaces/current (per-workspace owner/admin gate on TenantMember.role, zod 1–100 trimmed name); shared WorkspaceGeneralSettings component wired into SettingsModal + Settings→General page; useWorkspaces rename mutation (optimistic + workspaces-query invalidation) + createdAt added to workspaces GET payload. tsc clean, vitest 2251 pass / 38 skip; 10 new route tests incl. the ctx.role global-admin trap. Pending live/Playwright verify.
