# Story SKB-02 — Complete auth-event logging coverage (wire the remaining gaps)

## Provenance & ownership
- **Project owner:** Martin Priessner (martin.priessner@scisymbio.ai)
- **Created by:** Agent 83 (from Fable audit `docs/audits/auth-flow-trace.md`, finding A5) — **rewritten after review (rev-skb-02): the original "restore the deleted function" premise was stale.**
- **Created:** 2026-07-11
- **Status:** ready
- **Assigned to / currently owned by:** Sonnet implementer (branch `audit/skb-02-auth-event-logging-gaps` off `origin/main`)
- **Related / parallel work:** sibling SKB-01 (different files); audit `docs/audits/auth-flow-trace.md` A5 (stale — see note below)

## ⚠️ Corrected premise (verified against origin/main via git history)

The audit's "zero references to `logAuthEvent` in `src/`" was read from a branch (`feat/a70-finish-track`) that forked **before PR #4 (`9c36a6f`) merged**. **On `origin/main`, `logAuthEvent` already exists and is wired** — do NOT re-create it:
- `src/lib/agent/audit.ts:75` — `export async function logAuthEvent(action, resource, principal?, details?)` EXISTS, reusing the existing **`AuditLog`** table (its `tenantId`/`userId` are already **nullable** so anonymous 401s persist instead of FK-violating — migration `20260613170100`). **No new `AuthEvent` model ever existed; do NOT add one; no migration needed.**
- `src/lib/apiAuth.ts` — already calls `logAuthEvent` on key-usage-failure paths.
- `src/app/auth/callback/route.ts:245` — already calls `logAuthEvent("oauth.exchange_failed", …)`.

History trail (for context): original `b9ea418` (2026-06-13) → extended `0d0399c` → **lost in merge `d6896fd`** (conflict resolution dropped the function while callers/tests survived) → **recovered in PR #4 `9c36a6f`**, but the recovery did **not** re-include the `withAgentAuth` (`auth.ts`) wiring.

## Problem — the REAL remaining gaps (confirmed absent on origin/main)

1. **`withAgentAuth` (`src/lib/agent/auth.ts`) does not call `logAuthEvent` at all.** The June-13 wiring for `auth.success` / `auth.reject` on the agent-API path was part of what merge `d6896fd` lost and PR #4 did NOT recover (its diff touched `audit.ts`/`apiAuth.ts`/`ensureUserExists.ts`, not `auth.ts`).
2. **`getTenantContext` (`src/lib/tenantContext.ts`) — its 401 rejections are unlogged** (zero `logAuthEvent` references).
3. **OAuth success is not logged** — `callback/route.ts` logs only `oauth.exchange_failed`, not success.
4. **No login / logout / session events exist anywhere** (no historical precedent — this is genuinely NEW, small work).

## Fix approach

**Step 0 — confirm current state against origin/main** (NOT "restore"): read `src/lib/agent/audit.ts` (the existing `logAuthEvent` signature + the `try/catch`-swallow non-throwing pattern), and confirm the 3 gaps above by grep. Match the existing signature exactly — do NOT re-declare or diverge it (two call sites already depend on it).

**Step 1 — wire the four gaps, reusing the existing `logAuthEvent`:**
- (a) **`withAgentAuth` (`auth.ts`):** log `auth.reject` (AWAITED) and `auth.success` (**fire-and-forget / `void`, NOT awaited**) — this is the original `b9ea418` pattern and is load-bearing: awaiting on the success path adds DB latency to every hot `/api/agent/*` GET. Match that exactly.
- (b) **`getTenantContext` (`tenantContext.ts`):** log the 401 rejection paths (`:48` header-present-but-unresolved, and the fail-closed branch) with an anonymous principal.
- (c) **`callback/route.ts`:** add an `oauth.success` (or equivalent) event alongside the existing failure log.
- (d) **login / logout / session events:** add small events at successful session establishment and sign-out (new; keep minimal and consistent with the existing action-naming convention).
- All calls must preserve the existing **non-throwing, non-blocking** contract (try/catch swallow + `log.error`) — reuse it, don't reinvent.

## Acceptance criteria
- `withAgentAuth` emits an `AuditLog` row on both a successful agent-API auth (fire-and-forget) and a rejection (awaited), matching the original pattern.
- `getTenantContext` 401s produce an `AuditLog` row (anonymous principal allowed via the nullable FKs).
- OAuth **success** is logged in addition to the existing failure event.
- A login and a logout each produce an event.
- No new Prisma model or migration is added (reuse `AuditLog`).
- A logging failure never turns a successful auth into a failure, and never adds latency to the agent success path (success stays fire-and-forget).
- `logAuthEvent`'s signature and its two existing call sites (`apiAuth.ts`, `callback/route.ts`) are unchanged/unbroken.

## Affected files
- `src/lib/agent/auth.ts` (add success/reject wiring)
- `src/lib/tenantContext.ts` (log 401s)
- `src/app/auth/callback/route.ts` (log OAuth success)
- login/logout call sites (locate — likely `src/lib/supabase/middleware.ts` and/or the sign-out route)
- Tests under the Vitest suite (there is precedent: `src/__tests__/api/auth-callback.test.ts`)
- **Do NOT touch** `prisma/schema.prisma` (no model change) or `src/lib/agent/audit.ts`'s `logAuthEvent` signature.

## Regression guards — do NOT break
- Do NOT re-declare or change `logAuthEvent` — reuse it; a diverging signature breaks `apiAuth.ts` + `callback/route.ts`.
- Preserve **await-reject / fire-and-forget-success** in `withAgentAuth` — do not await the success log.
- Logging must be non-throwing/non-blocking (existing pattern) — a logger error must never turn a 200 into a 500 or a 401 into a 500.
- Do NOT change auth *decisions* — only *record* events.
- Do NOT import from `@prisma/client`; use `@/generated/prisma/client`.
- ⚠️ This file set (`audit.ts`/`auth.ts`/`apiAuth.ts`/`tenantContext.ts`) already lost code once to a bad merge (`d6896fd`) — resolve any merge near other work on these files with extra care.

## Test plan
- Unit (Vitest): agent-API success → fire-and-forget event; agent-API reject → awaited event; `getTenantContext` 401 → anonymous event; OAuth success → event; login + logout → events; a thrown logger does not propagate into the auth path.
- Manual (owner): perform a login, a logout, a bad-token agent request, and an OAuth sign-in → confirm corresponding `AuditLog` rows.
