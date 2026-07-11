# Story SKB-01 — Constant-time comparison for `SYNC_SERVICE_KEY`

## Provenance & ownership
- **Project owner:** Martin Priessner (martin.priessner@scisymbio.ai)
- **Created by:** Agent 83 (from Fable audit `docs/audits/auth-flow-trace.md`, finding A9)
- **Created:** 2026-07-11
- **Status:** ready
- **Assigned to / currently owned by:** Sonnet implementer (branch `audit/skb-01-constant-time-sync-key` off `origin/main`)
- **Related / parallel work:** sibling SKB-02 (auth-event logging) — different files; mirror story ET-02 does the same for ExpTube

## Problem

SKB's two sync routes compare the incoming `Authorization: Bearer` token to `process.env.SYNC_SERVICE_KEY` with plain `===`:
- `src/app/api/sync/experiments/route.ts:52`
- `src/app/api/sync/reconcile/route.ts:17-18`

`timingSafeEqual` is used nowhere in the repo. The `SYNC_SERVICE_KEY` holder can write into any tenant (the sync routes trust `X-Tenant-ID`), so this is a high-value secret and the byte-wise short-circuit of `===` leaks timing.

## Fix approach (surgical, mirror of ET-02)

1. Add a small constant-time comparison helper (e.g. `src/lib/auth/constantTimeEqual.ts` — only if a comparable util doesn't already exist) using Node's `crypto.timingSafeEqual`:
   - guard both operands are present (env key set + header token present) → fail closed (401 / false) if not;
   - length-compare first (unequal length → mismatch);
   - `crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))`.
2. Use it in both `authenticateSync` call sites (`sync/experiments/route.ts:43-53` and `sync/reconcile/route.ts:11-18`), replacing the `===` checks.
3. Preserve the existing fail-closed behavior when `SYNC_SERVICE_KEY` is unset (audit: currently returns `false` when unset — keep that). Also add a test that `SYNC_SERVICE_KEY=""` (empty) stays fail-closed.

**Runtime (verified by review):** neither sync route exports `runtime = "edge"` — both default to the **Node** runtime, so `node:crypto` / `timingSafeEqual` is usable as-is (no runtime declaration needed). Compare **byte length of UTF-8 buffers**, not JS string `.length`; do not trim/normalize the token. Both routes confirmed present on origin/main (experiments' `authenticateSync` ~`:40-53`, reconcile's ~`:15-22` — line hints only).

## Acceptance criteria
- A correct `SYNC_SERVICE_KEY` still authenticates both sync routes.
- An incorrect key is rejected in constant time.
- Unset `SYNC_SERVICE_KEY` → fail closed, as today.

## Affected files
- `src/app/api/sync/experiments/route.ts` (`authenticateSync`, `:43-53`)
- `src/app/api/sync/reconcile/route.ts` (`:11-18`)
- `src/lib/auth/constantTimeEqual.ts` (new small util, if none exists)
- Test under the repo's Vitest suite covering valid/invalid/unset.

## Regression guards — do NOT break
- Preserve fail-closed on unset env key (do not accidentally allow-all when key is missing).
- Do NOT change tenant resolution (`X-Tenant-ID` / `DEFAULT_TENANT_ID`) in these routes.
- Do NOT touch the API-key (`skb_live_`) or Supabase-session auth paths (`tenantContext.ts`, `apiAuth.ts`, `agent/auth.ts`) — this story is only the sync service-key comparison.
- SKB imports Prisma from `@/generated/prisma/client` (workspace `CLAUDE.md` 7.12) — not relevant here but do not introduce `@prisma/client` imports.

## Test plan
- Unit (Vitest): valid key → authorized; wrong key (equal + unequal length) → rejected; unset env → rejected.
- Manual (owner): confirm a real ExpTube → SKB sync push still authenticates.
