# A70-07 — Fix cross-tenant page lookup in knowledge extractor + isolation test sweep

## Provenance & ownership
- **Project owner:** Martin Priessner (martin.priessner@scisymbio.ai)
- **Created by:** Agent 70
- **Created:** 2026-07-03
- **Status:** draft (improvement — do not implement yet; reviewed round 1)
- **Assigned to / currently owned by:** unassigned
- **Related / parallel work:** `SKB-45.6-multi-tenant-isolation-verification.md`, `tests/api/tenantIsolation.test.ts` (DB-gated), 2026-06-13 audit stories.

## Problem
The knowledge extractor accepts a `tenantId` parameter and then ignores it for
its page lookup: `prisma.page.findUnique({ where: { id: pageId } })`. Reached
from the agent route with a request-supplied pageId, a caller in tenant A can
probe tenant B's page ids and learn existence + title (downstream content read
IS tenant-filtered, so disclosure is bounded — but the repo invariant "every
tenant-scoped query filters by tenantId" is broken).

## Evidence
- `src/lib/chemistryKb/knowledgeExtractor.ts:284-289` — findUnique without
  tenantId; title used at :293.
- Entry: `src/app/api/agent/pages/extract-knowledge/route.ts:79` forwards
  `parsed.data.pageId` from the request body.
- Callers verified (review round 1): only two — the route above and the bulk
  path (`knowledgeExtractor.ts:426`), whose page ids come from a `findMany`
  already scoped by tenantId (`:393-398`). The tighter filter cannot break the
  bulk path.

## Scope
1. Replace with `findFirst({ where: { id: pageId, tenantId }, select: ... })`.
   **Error contract:** the route maps errors to 404 by string-sniffing
   `msg.includes("not found")` (`extract-knowledge/route.ts:91`) — the new
   miss-path throw MUST keep the literal substring `not found` (keep the
   existing `Page ${pageId} not found` message), or the route silently turns
   404s into 500s.
2. Repo sweep for the same pattern: `findUnique({ where: { id` on
   TENANT-SCOPED models only (Page, Block, Database, DocumentVersion,
   FileAttachment, PageLink, Notification...) outside generated code.
   **Explicitly excluded from conversion:** non-tenant-scoped models (User,
   Tenant, ApiKey, Invitation-token lookups), lookups that are cross-tenant
   BY DESIGN (auth/key resolution, health, admin provisioning), AND
   token-keyed public lookups — notably `PublicShareLink.token`
   (`@@unique`, `prisma/schema.prisma:413`) and invitation tokens, which MUST
   resolve without a tenant filter (a published share link is fetched with no
   tenant context; adding tenantId breaks public sharing/invite acceptance).
   The sweep is judgment-applied, not mechanical. Fix or justify each hit in
   the PR description.
3. Extend `tests/api/tenantIsolation.test.ts` with an extract-knowledge case:
   tenant A calling with a tenant-B pageId gets 404 and no title leak.

## Acceptance criteria
- AC1: Cross-tenant pageId probe returns 404 (not 500) with no metadata.
- AC2: Sweep documented; no remaining unjustified tenant-less lookups on
  tenant-scoped models.
- AC3: Bulk extraction (`runFullBatchMode` path) behavior unchanged.
- AC4: tsc + vitest green (DB-gated isolation suite passes with DATABASE_URL).

## Affected files (expected)
- `src/lib/chemistryKb/knowledgeExtractor.ts`
- any files found in the sweep
- `tests/api/tenantIsolation.test.ts`

## Verification
DB-gated isolation tests + manual curl probe with two seeded tenants.

## Reviewer Feedback / Codex (round 1) — FALLBACK: Claude Opus
*(Codex CLI broken: native binary ENOENT; lens covered by Claude Opus subagent per /story fallback rules.)*
- **(Critical)** Route maps 404 via `msg.includes("not found")` (`route.ts:91`) — refactored error text must keep that substring or cross-tenant probes 500 instead of 404. → Fixed (Scope 1, AC1).
- Bulk caller (`knowledgeExtractor.ts:426`) verified same-tenant (ids from tenant-scoped findMany at :393-398) — swap is regression-safe. → Recorded in Evidence + AC3.
- Sweep blast-radius: many by-id `findUnique`s are legitimately tenant-agnostic; scope now explicitly excludes non-tenant-scoped models and by-design cross-tenant lookups. → Fixed (Scope 2).

## Reviewer Feedback / GLM (round 2 — runtime lens, glm-5.2)
- Core fix verified sound (throw at `knowledgeExtractor.ts:290`, contract at `route.ts:91`, bulk caller tenant-scoped). One gap: sweep exclusions omitted `PublicShareLink.token` (`schema.prisma:413`) and invitation tokens — adding tenantId to those breaks public sharing/invites. → Exclusion list extended (Scope 2).

## Revision History
- 2026-07-03 — Initial draft (Agent 70).
- 2026-07-03 — Round-1 regression review (Opus fallback for Codex): pinned 404 error contract, documented safe bulk caller, bounded the sweep scope.
- 2026-07-03 — Round-2 GLM runtime review: token-keyed public lookups added to sweep exclusions. Status: Reviewed (draft — not to be implemented yet).
