# A70-19 — Real member invitations (external email invites + pending membership)

## Provenance & ownership
- **Project owner:** Martin Priessner (martin.priessner@scisymbio.ai)
- **Created by:** Agent 70
- **Created:** 2026-07-03
- **Status:** draft (improvement — do not implement yet)
- **Assigned to / currently owned by:** unassigned
- **Related / parallel work:** `SKB-23.3-invite-members-placeholder-and-polish.md` (created the stub), `SKB-17.x` teamspaces, `S41-x` shared-auth stories (auth hub is ExpTube Supabase — invites must fit that flow).

## Problem
"Invite teammates" is a disabled dialog with a "coming soon" note, and page
sharing can only target users ALREADY in the tenant (unknown emails 404).
There is no way to bring a new person into a workspace from the product.

## Evidence
- `src/components/workspace/InviteMembersDialog.tsx:87-101` — disabled stub.
- `src/app/api/pages/[id]/share/route.ts:120-131` — intra-tenant resolution only.

## Scope
1. `Invitation` model (tenantId, email, role, token, invitedBy, expiresAt,
   acceptedAt) + CRUD API (create/list/revoke; rate-limited).
2. Invite flow: dialog accepts emails + role; creates invitations; SKB runs
   against ExpTube's local Supabase (no email infra guaranteed) → v1 generates
   a copyable invite LINK per invitee (email sending optional behind env flag).
3. Accept flow: `/invite/[token]` page — signed-in user with matching/any email
   (decide in review) joins the tenant with the invited role; expired/revoked
   tokens rejected.
4. Share dialog: unknown email offers "Invite to workspace" instead of 404.
5. Pending invites list in Settings → Members with revoke.

## Acceptance criteria
- AC1: Invite by email produces a link; a second Supabase user opening it joins
  the tenant and appears in members.
- AC2: Revoked/expired tokens fail safely; tokens single-use.
- AC3: Only members with appropriate role can invite (decide threshold).
- AC4: tsc + vitest green; token lifecycle unit tests; migration included.

## Affected files (expected)
- `prisma/schema.prisma` + migration
- new `src/app/api/invitations/*`, `src/app/invite/[token]/page.tsx`
- `src/components/workspace/InviteMembersDialog.tsx`, share dialog

## Verification
Two-account live test against local Supabase.
