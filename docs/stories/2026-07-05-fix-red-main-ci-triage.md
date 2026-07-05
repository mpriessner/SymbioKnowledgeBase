# [P0] Triage the red main CI — 18 failing tests + 3 tsc errors (auth-drift cluster)

## Provenance & ownership
- **Project owner:** Martin Priessner (martin.priessner@scisymbio.ai)
- **Created by:** Agent 68 (session 68_Agent_Test_implementation) — follow-up finding from the cross-stack test-coverage audit
- **Created:** 2026-07-05
- **Status:** done — implemented 2026-07-05 (session 68_Agent_Test_implementation)
- **Assigned to / currently owned by:** session 68_Agent_Test_implementation (implementation complete)
- **Related / parallel work:** Cross-stack audit report `~/windsurf_repos/diligence-reports/test-coverage-audit-2026-07-03-agent68.md` (§NEW FINDINGS 2026-07-05). Sibling: `ExpTube/docs/stories/2026-07-05-fix-red-main-ci-triage.md` (same failure date, same treatment). Model precedent: chatbot-notebook's `2026-07-03-fix-16-known-red-tests.md`. Coordinate with Agent 70's A70/A71 SKB work (their finish-track commit is on main; their A71 batch is planning-only).

## Problem / context

**SKB's `CI` workflow has been red on main since at least 2026-06-19** (the
audit-remediation merge, PR #2). The workflow itself is well-built (real
Postgres 18, prisma migrate, blocking tsc + vitest gates) — which makes the
red worse: a *blocking* gate that's always red means every PR ships unverified
and reviewers learn to ignore the ✗.

**⚠ Branch-verification correction (Codex round 1).** The red state described
below is real, but it is the state of **`origin/main`** (HEAD `5867704`), NOT
whatever branch happens to be checked out. The audit found the same tree
`feat/a70-finish-track` (HEAD `5b024eb`) checked out locally — that branch has
**diverged** from `origin/main` (it is *not* an ancestor), does **not** contain
the five failing test files, has a clean `tsc --noEmit`, and passes
`npx vitest run` (2311 passed / 0 failed). **Anyone implementing this story MUST
first `git checkout origin/main` (or a branch off it) — the failures do not
reproduce on `a70-finish-track` or any pre-`d6896fd` lineage.** All reproduction
commands and line references in this story are against `origin/main`.

Verified 2026-07-05 against `origin/main` (`5867704`) via `git show` + the live
CI log (`gh run list --branch main` → every run since PR #1 is `failure`, latest
`28740025633` 2026-07-05):

- `npx vitest run`: **18 failures across 5 files** — `src/__tests__/api/og-metadata.test.ts`, `src/__tests__/lib/apiAuthLastUsed.test.ts`, `src/__tests__/lib/agent/audit.test.ts`, `src/__tests__/lib/agent/auth.test.ts`, `src/__tests__/lib/auth/ensureUserExists.test.ts`. (All five confirmed present on `origin/main`; absent on the local checkout.)
- `npx tsc --noEmit`: **3 errors** in `audit.test.ts` / `auth/callback/route.ts`.
- **Corrected root cause (Codex round 1): this is a *lost-implementation regression*, not "stale tests".** The `logAuthEvent` function is not renamed or moved — it *existed* in `src/lib/agent/audit.ts` (commits `b9ea418`, `0d0399c`, `c1fc36f`) and **disappeared during the `d6896fd` merge/conflict resolution** while its callers and tests survived. On `origin/main`, `src/lib/agent/audit.ts` now exports only `logAgentAction`; `logAuthEvent` is gone, but `src/app/auth/callback/route.ts:6` still imports it and `route.ts:245` still calls it. So the correct remediation for the auth/audit cluster is to **recover the intended implementation**, not to delete/skip the tests that document it. Per file:
  - `agent/audit.test.ts` + `apiAuthLastUsed.test.ts` — expect `logAuthEvent`; **dropped capability** (structured audit logging of auth outcomes). `src/lib/apiAuth.ts` also reverted to `console.error` on `lastUsedAt` failure where the test expects `logAuthEvent`.
  - `agent/auth.test.ts` — expects the earlier Supabase-JWT / inline-bcrypt path + structured auth logging; `src/lib/agent/auth.ts` on `origin/main` is now **API-key-only**. This one is **partly stale-test** (the API-key-only design is intentional — see `CLAUDE.md` "Agent API") and **partly dropped-capability** (the auth logging). Split it: re-point the auth-mechanism expectations, recover the logging.
  - `ensureUserExists.test.ts` — expects `$transaction` and `SKB_PERSONAL_TENANT_BY_DEFAULT`; `origin/main` implementation does neither and still provisions personal-tenant fallback users as `ADMIN` (a least-privilege regression, cf. audit-04). **Dropped capability.**
  - `og-metadata.test.ts` — a **separate stale-test cluster**, unrelated to `logAuthEvent`: it mocks `@/lib/security/ssrfGuard` and expects a 422 + `redirect: "error"`, but the route now does inline DNS/net SSRF validation, returns **502** for blocked fetches, and uses `redirect: "manual"`. Re-point the test at the current SSRF contract.

## Plan (mirror the notebook/ExpTube precedent)

0. **Check out `origin/main` first.** Do all reproduction and fixing on a branch off `origin/main` (`5867704`), not the local `feat/a70-finish-track` checkout — the failures do not exist there (see the branch-verification correction above).
1. **Authoritative red list**: one clean `npx vitest run` + `npx tsc --noEmit` **on `origin/main`**; record every failed test id + error signature here. Cross-check against the live CI log (`gh run list --branch main`). **NOTE (GLM round 2): there is NO local-vs-CI divergence for these 18.** All five failing files are pure `vi.mock("@/lib/db", …)` unit tests — none carries `describe.skipIf(!DATABASE_URL)` (verified on `origin/main`: `apiAuthLastUsed.test.ts:10`, `agent/audit.test.ts:4`, `agent/auth.test.ts:9`, `auth/ensureUserExists.test.ts:19`; `og-metadata.test.ts:17` mocks `@/lib/security/ssrfGuard`). The Postgres-18 service in `ci.yml` is a **red herring for this red list** — these 18 fail identically with or without `DATABASE_URL`. (The ExpTube DB-divergence trap does not apply here; don't spend time on it.)
2. **Cluster a/b/c** (per the corrected root-cause table above): (a) **stale tests** to re-point at the current, intentional architecture — the `og-metadata` SSRF contract and the API-key-only auth *mechanism* in `agent/auth.test.ts`; (b) **dropped capabilities to RECOVER** — the `logAuthEvent` structured audit-logging path (`audit.test.ts`, `apiAuthLastUsed.test.ts`, the auth-logging half of `auth.test.ts`) and the least-privilege / `$transaction` / `SKB_PERSONAL_TENANT_BY_DEFAULT` provisioning in `ensureUserExists.test.ts`; (c) obsolete → delete-with-rationale (expected to be empty here — no failure has yet been shown obsolete). Default to **recover, not delete**: `d6896fd` is the regression point, so the intended behaviour is recoverable from `b9ea418`/`0d0399c`/`c1fc36f`/`f3f86a1`.
3. **Green fast — but note deselection CANNOT bypass the tsc gate.** CI runs `npx tsc --noEmit` **before** vitest (`ci.yml` "Typecheck" step precedes "Unit + integration tests"), and `tsconfig.json` includes `**/*.ts(x)`, so it typechecks the test files *and* `auth/callback/route.ts`. Skipping/deselecting tests in vitest does nothing for tsc. **GLM round 2 confirms the ordering consequence: the 3 tsc errors alone keep CI red regardless of vitest** — a `tsc --noEmit` non-zero exit fails the job before vitest ever runs, so "skip all 18 tests" would still leave a red build. There is also **no coverage/threshold config** in `vitest.config.ts` (confirmed both reviewers), so skipping files trips no coverage gate — the only gate that matters for skips is tsc. To get both blocking gates green, the first PR must **fix the type errors at source**: (i) the production `route.ts` import of the missing `logAuthEvent` (see step 5 — this is a real build break, fix it don't `@ts-expect-error` it), and (ii) any type errors inside the deselected test files (either delete/skip the file so tsc no longer sees a bad import, or stub the symbol). A vitest `exclude` glob removes a file from the run but NOT from tsc's include set — so a skipped-but-still-type-erroring test file keeps CI red. Prefer `.skip`/temporary deletion of the whole file over `describe.skip` for anything whose *import* line fails to typecheck.
4. **Shrink**: recover the auth/audit cluster first (it guards the agent surface the voice clients use, and it includes a live production build break), then `ensureUserExists`, then `og-metadata`.
5. **`auth/callback/route.ts` — verdict: LATENT PRODUCTION BUG, not a dead import.** On `origin/main`, `route.ts:6` imports `logAuthEvent` from `@/lib/agent/audit` (which no longer exports it) and `route.ts:245` **actually calls it** on the local OAuth-exchange-failure path. This is not a test-only or unused-import issue: `tsc` fails and the OAuth-callback module fails to build/load, so the login callback can break at runtime. Fix by recovering `logAuthEvent` in `audit.ts` (preferred — it restores the intended audit capability that `apiAuthLastUsed.test.ts` also depends on), not by deleting the call.

## Acceptance criteria

1. Exact red list + per-file verdict (stale-test vs dropped-capability vs obsolete, local-only vs CI-red) recorded here.
2. `CI` workflow green on main via the explicit, story-linked first PR; zero silent skips.
3. Each fix PR deletes its exclusions; final state = zero exclusions, tsc clean.
4. The `auth/callback/route.ts` question answered — **verdict recorded: latent production bug** (imports + calls the removed `logAuthEvent`; breaks tsc and the OAuth callback build). Fixed by recovering `logAuthEvent`, not by dropping the call.
5. No changes to the agent-route tests added by PR #3 (`tests/unit/api/agent/{kb-query,search,pages-write-routes}.test.ts`) — confirmed they do not touch the failing auth/audit files, so no collision.
6. All work done on a branch off `origin/main`; the fix does NOT get based on `feat/a70-finish-track` (which is diverged and pre-regression).

## Implementation verdicts (2026-07-05, session 68_Agent_Test_implementation)

Implemented on `fix/red-main-ci-triage` off `origin/main` `e72e8d9` (confirmed
ancestor, per AC6). Per-cluster verdict:

1. **`src/lib/agent/audit.ts` — RECOVERED.** Added back `logAuthEvent` and
   `clientIpFromHeaders` (lost at merge `d6896fd`), adapted to the CURRENT
   file's conventions (the structured `logger` from `@/lib/logger`, not the
   historical `console.log` — `logAgentAction` was left untouched since its
   tests already passed against the current style). Fixes 2 of the 3 tsc
   errors directly, the 3rd (`auth/callback/route.ts`) transitively (its
   import now resolves), and 5 of the 18 red tests in `audit.test.ts`.
2. **`src/lib/apiAuth.ts` (`touchLastUsed`) — RECOVERED.** The lastUsedAt
   fire-and-forget `.catch` on both the SHA-256 and bcrypt key paths now
   routes through `logAuthEvent("key.last_used_update_failed", ...)` instead
   of a bare `console.error`, matching what `apiAuthLastUsed.test.ts` and
   `agent/auth.test.ts` pin. Also fixed a latent gap in
   `apiAuthLastUsed.test.ts` itself: its `@/lib/db` mock never stubbed
   `apiKey.findMany`, so the bcrypt-fallback branch threw a `TypeError`
   whenever the SHA-256 lookup missed — added the missing mock (test-only
   fix, no production behavior change here).
3. **`src/__tests__/lib/agent/auth.test.ts` — SPLIT, as the review directed.**
   Independent re-verification during implementation found this went deeper
   than "mechanism drift": the file's `skb_` API-key mocks used a FLAT
   `{tenantId, userId}` shape left over from a since-superseded inline
   dual-path implementation of `agent/auth.ts` (present at commit `0d0399c`,
   a divergent branch — `git merge-base --is-ancestor` confirms neither
   `0d0399c` nor the hardening commit `6599994` is an ancestor of the other).
   The CURRENT `agent/auth.ts` delegates entirely to the canonical
   `apiAuth.resolveApiKey`, which resolves the owning user via a nested
   Prisma `include` (`{ user: { id, tenantId, role } }}`) — confirmed against
   `src/__tests__/lib/auth/resolveApiKey.test.ts` and
   `src/__tests__/lib/auth/agentAuth.test.ts` (both already green,
   uninvolved in this story, and already targeting the nested shape). Fixed:
   re-pointed every mock in this file to the nested shape; **removed** the
   "Supabase JWT path" describe block (3 tests) — that mechanism does not
   exist anywhere on the current agent path (API-key-only per CLAUDE.md
   "Agent API"), and its coverage was not recoverable because there is
   nothing current to point it at. Recovered (kept, now passing) both
   lastUsedAt-failure logAuthEvent assertions — this is coverage
   `resolveApiKey.test.ts`/`agentAuth.test.ts` do NOT provide (they don't
   exercise the bcrypt-path failure-logging branch). Net: 10 tests now (was
   13; -3 stale JWT tests, 0 coverage lost elsewhere since the removed
   mechanism doesn't exist to test).
4. **`src/lib/auth/ensureUserExists.ts` — RECOVERED.** Restored from commit
   `f3f86a1`, adapted to the current file (which already had the `USER`-not-
   `ADMIN` fix for the shared-tenant path — the regression was narrower than
   the original diagnosis: only the **personal-tenant fallback** path still
   set `role: "ADMIN"`). Recovered: `SKB_PERSONAL_TENANT_BY_DEFAULT=1` opt-in
   env handling, `$transaction`-wrapped `user.create` + `tenantMember.upsert`
   (atomic — no partial-provision window), and `role: "USER"` on ALL
   provisioning paths including both personal-tenant cases (opt-in and
   shared-tenant-missing fallback), with `TenantMember.role` (`"owner"` vs
   `"member"`) carrying the ownership distinction instead. P2002
   email-collision recovery preserved unchanged. **Caller-impact check**:
   grepped all production callers (`src/lib/tenantContext.ts`,
   `src/app/auth/callback/route.ts`) — both only consume the unchanged
   `{id, tenantId, role}` return shape; `tenantContext.ts`'s own suite
   (`tests/unit/auth/tenantContext.test.ts`, 8 tests) re-run clean.
   `SKB_PERSONAL_TENANT_BY_DEFAULT` is not set anywhere in CI or `.env`
   templates, so default (shared-tenant) behavior in CI is unaffected.
5. **`src/__tests__/api/og-metadata.test.ts` — RE-POINTED (stale test).**
   Independent re-verification found the mismatch was one level deeper than
   the review's framing: the route does not call `@/lib/security/ssrfGuard`
   at all — it has its own duplicate inline DNS/net SSRF check
   (`isPublicHttpUrl`). `ssrfGuard.ts`'s `assertUrlIsFetchable`/
   `BlockedUrlError` are referenced ONLY by test files, never by any route
   (confirmed via repo-wide grep) — i.e. that module is dead code, unrelated
   to this story's scope, not touched. Removed the now-fictitious
   `ssrfGuard` mock and re-pointed the two failing assertions at the route's
   real, already-correct behavior: blocked URLs get a generic `502` (not
   `422`, and not the specific block reason — intentional, per the route's
   own comment, to avoid revealing why a host was rejected), and redirects
   are followed with `redirect: "manual"` (not `"error"`) so each hop can be
   re-validated. The `getTenantContext`/`AuthenticationError` auth mock was
   already correct (matches `withTenant`) and is unchanged. SSRF checks
   themselves were NOT weakened — same literal blocked IP
   (`169.254.169.254`) is still rejected pre-fetch.
6. No cluster needed the skip-with-story-link fallback; all five were
   recovered/re-pointed at source.

**New test added**: `src/__tests__/api/auth-callback.test.ts` (2 tests) — no
prior coverage existed for `auth/callback/route.ts`'s OAuth-exchange-failure
path (grepped, confirmed absent). Pins that a failed `exchangeCodeForSession`
calls `logAuthEvent("oauth.exchange_failed", "auth/callback", {}, {reason})`
with an anonymous principal and still redirects to `/login?error=oauth_failed`
(does not throw); a companion test pins that a successful exchange does NOT
log a failure event.

**Before/after**:
- `npx tsc --noEmit`: 3 errors → **0 errors**.
- `npx vitest run`: 18 failed / 2419 passed / 38 skipped (2475 total) →
  **0 failed / 2436 passed / 38 skipped (2474 total)**. Total count nets to
  -1 (-3 removed stale JWT tests, +2 new callback tests) with zero coverage
  regression (the removed tests covered a mechanism that no longer exists).
- `npx prisma validate`: green (schema unchanged by this story — the nullable
  `AuditLog.tenantId`/`userId` columns needed by `logAuthEvent` were already
  migrated in a prior commit).
- `npx eslint` on all changed/added files: clean, no new findings.

**Files changed** — production (3): `src/lib/agent/audit.ts`,
`src/lib/apiAuth.ts`, `src/lib/auth/ensureUserExists.ts`. Test-only (4 modified
+ 1 new): `src/__tests__/lib/agent/auth.test.ts`,
`src/__tests__/lib/apiAuthLastUsed.test.ts`,
`src/__tests__/api/og-metadata.test.ts`,
`src/__tests__/api/auth-callback.test.ts` (new). `auth/callback/route.ts`
itself needed NO changes — its `logAuthEvent` call already matched the
recovered signature; the tsc error there was purely a consequence of the
missing export in `audit.ts`.

No deviations from the story's plan beyond the two "went one level deeper"
findings noted in clusters 3 and 5 above (both independently re-verified
before acting on them, per the story's own standing instruction to verify
rather than trust blindly).

**Status: done — implemented 2026-07-05 (session 68_Agent_Test_implementation).**

## Verification

`gh run list --branch main` green after PR 1; final PR: `npx vitest run` + `npx tsc --noEmit` fully clean locally and in CI.

## Out of scope

New coverage (PR #3 delivered the agent-route layer); Kong port questions (:54341/:54381 — auth is not Supabase on the agent surface); A71 planning batch.

## Reviewer Feedback

### Codex (round 1) — verbatim

> Critical issues:
>
> - You are not on main locally: `feat/a70-finish-track`, with the story untracked. `origin/main` is ahead and includes PR #3 agent route tests. The story's "clean main" claim should be checked against `origin/main`, not this working tree.
> - `logAuthEvent` was not renamed or moved. It existed in `src/lib/agent/audit.ts` in commits like `b9ea418`, `0d0399c`, and `c1fc36f`, then disappeared during the `d6896fd` merge/conflict resolution while tests and callers survived. So this is a lost implementation/regression, not merely stale tests.
> - The auth-drift diagnosis is directionally right but incomplete. `src/lib/agent/auth.ts` on `origin/main` is now API-key-only, while `src/__tests__/lib/agent/auth.test.ts` still expects the earlier Supabase JWT path, bcrypt inline path, and structured auth logging. `src/lib/apiAuth.ts` also reverted to `console.error` on `lastUsedAt` failure while `apiAuthLastUsed.test.ts` expects `logAuthEvent`.
> - `src/app/auth/callback/route.ts` is a real production bug, not a dead import. On `origin/main`, it imports `logAuthEvent` at line 6 and calls it on local OAuth exchange failure around line 245. Since `src/lib/agent/audit.ts` no longer exports it, typecheck fails and the route can fail to load/build; it is not only a test problem.
> - `ensureUserExists.test.ts` also reflects lost implementation, not just stale test drift. The test expects `$transaction` and `SKB_PERSONAL_TENANT_BY_DEFAULT`; `origin/main` implementation does neither and still provisions personal-tenant fallback users as `ADMIN`.
> - The proposed deselect mechanics only work for Vitest failures. `vitest.config.ts` has no coverage config/gate and could add `exclude` or CI could pass explicit test globs, but CI runs `npx tsc --noEmit` first and `tsconfig.json` includes `**/*.ts`/`**/*.tsx`. Vitest deselection will not bypass test type errors or the production callback import error.
> - Collision with recently merged work: PR #3 only adds `tests/unit/api/agent/{kb-query,search,pages-write-routes}.test.ts`; it does not touch the failing auth/audit files. A70 itself did not directly change those files, but the current `feat/a70-finish-track` is based on the post-merge state where the audit/auth implementation was already lost.
>
> Nice-to-have:
>
> - The `og-metadata` file is a separate stale-test cluster: the test mocks `@/lib/security/ssrfGuard`, expects a 422 blocked-url response and `redirect: "error"`, but the route currently has inline DNS/net SSRF validation, returns 502 for blocked fetches, and uses `redirect: "manual"`.
> - The story should call out `d6896fd` as the likely regression point. That makes the remediation clearer: recover the intended audit/auth/ensureUserExists implementation, instead of treating all failures as unknown drift or candidates for deletion.

*All six Critical issues folded into Problem/context, Plan (steps 0/2/3/5), and Acceptance criteria. Both Nice-to-haves incorporated (og-metadata cluster + `d6896fd` regression callout). Independently verified against `origin/main` before baking in: `route.ts:6` imports `logAuthEvent`, `route.ts:245` calls it, `audit.ts` exports only `logAgentAction`, all 5 test files present on `origin/main`, local HEAD `5b024eb` confirmed NOT an ancestor of `origin/main` `5867704`.*

### GLM (round 2) — verbatim (partial capture; substance verified independently)

*The `glm -m glm-5.2` CLI ran live (exit 0). The CLI streamed a long self-correcting session and only its **final message** was captured to the task-output file; the enumerated finding list it refers to ("finding #3 in my list above") scrolled out of the captured buffer, and it did not emit the literal `Runtime breakage / missed bugs:` closer. The captured final message is pasted verbatim below, and its load-bearing claim was independently re-verified against `origin/main` before being folded into Plan step 1/3 (see verification note after the quote).*

> Probe3 is dispositive. The real `origin/main:src/__tests__/lib/apiAuthLastUsed.test.ts` (blob `de9e37a6…`) is the **Prisma `vi.mock` unit test** I originally reported — `vi.mock("@/lib/db", () => ({ prisma: { apiKey: { findFirst, update } } }))`, `vi.mock("@/lib/agent/audit", () => ({ logAuthEvent }))`, `const { resolveApiKey } = await import("@/lib/apiAuth")`, `describe("resolveApiKey lastUsedAt failure (audit S15)")`. This matches my first probe exactly and is independently corroborated by the parallel-session "Step 3" agent for `audit.test.ts`.
>
> The stray notification claiming a **Kysely** version (`db.insertInto('users')`, `import { apiAuthLastUsed } from '@/lib/apiAuthLastUsed'`, `truncateTables`) was a parallel-session confabulation — definitively not SKB:
> - `src/lib/apiAuthLastUsed.ts` → `fatal: path does not exist in 'origin/main'`. That module doesn't exist; the function is `touchLastUsed` inside `apiAuth.ts`.
> - `tests/lib/database.ts` → `fatal: path does not exist in 'origin/main'`. No `truncateTables` helper exists.
> - `src/lib/db.ts` exports `prisma` (`PrismaClient` via `@prisma/adapter-pg`) — Prisma 7, exactly as `CLAUDE.md` states. There is no Kysely `db` object.
>
> **My review stands unmodified.** Specifically for the file that was challenged: `apiAuthLastUsed.test.ts` is a `vi.mock` unit test that mocks both `@/lib/db` and `@/lib/agent/audit`; it has no `describe.skipIf(!DATABASE_URL)` and never touches a real database. It fails identically in CI and locally (asserts `resolveApiKey` routes the failed `lastUsedAt` update through `logAuthEvent`; `apiAuth.ts:164` on origin/main still uses `console.error`). All five failing files remain DB-mocking unit tests, the Postgres-18 provisioning remains irrelevant to all 18 failures, and finding #3 in my list above holds.

*Independent verification (before folding in): confirmed on `origin/main` that all 5 files use `vi.mock("@/lib/db", …)` with no `describe.skipIf(!DATABASE_URL)` (`apiAuthLastUsed.test.ts:10`, `agent/audit.test.ts:4`, `agent/auth.test.ts:9`, `ensureUserExists.test.ts:19`, `og-metadata.test.ts:17`), and that `src/lib/apiAuth.ts:164` uses `console.error` inside `touchLastUsed`. GLM's load-bearing correction — **no local-vs-CI divergence; CI Postgres is a red herring for all 18** — folded into Plan step 1. Its confirmation of the **tsc-before-vitest gate ordering** (3 tsc errors keep CI red even if every test is skipped) and **no coverage/threshold gate** folded into Plan step 3.*

## Revision History
- 2026-07-05 — Implemented (session 68_Agent_Test_implementation) on
  `fix/red-main-ci-triage` off `origin/main` `e72e8d9`. All five clusters
  recovered/re-pointed at source (see "Implementation verdicts" above); zero
  skip-with-story-link fallbacks needed. `npx tsc --noEmit`: 3→0 errors.
  `npx vitest run`: 18 failed→0 failed (2436 passed/38 skipped). Added a new
  regression test for the previously-uncovered `auth/callback/route.ts`
  OAuth-failure path. Two findings went one level deeper than the review's
  framing during independent re-verification: (a) `agent/auth.test.ts`'s
  stale mocks stemmed from a divergent-branch inline auth implementation, not
  just an intentional mechanism change, and (b) `og-metadata.test.ts`'s
  target module (`ssrfGuard.ts`) is dead code never called by the route at
  all — both are called out in detail in "Implementation verdicts" and
  neither changed the outcome (recover/re-point, not delete). Not committed —
  left for the owner/team lead to review the diff first. Status → done.
- 2026-07-05 — Initial draft (Agent 68).
- 2026-07-05 — Codex round-1 review (ran live, `codex exec -s read-only`, gpt-5.5). Corrected the story's biggest error: the red state is on `origin/main`, not the locally checked-out (diverged, green) `feat/a70-finish-track`. Reframed root cause from "stale tests" to a **lost-implementation regression at merge `d6896fd`** (recover, don't delete). Recorded the `auth/callback/route.ts` verdict = **latent production bug**. Documented that vitest deselection cannot clear the tsc gate. Added og-metadata as a separate stale-SSRF-contract cluster. Reviewer feedback pasted verbatim. (Reviser: Agent — subagent of team lead.)
- 2026-07-05 — GLM round-2 review (ran live, `glm -m glm-5.2`, exit 0; only final message captured — see note above the quote). Load-bearing correction: the 18 failures are DB-mocking `vi.mock` unit tests, so there is **no local-vs-CI divergence** and CI's Postgres-18 service is irrelevant to them (removed the story's step-1 hedge about DB-dependent tests). Confirmed the **tsc-before-vitest ordering** keeps CI red on the 3 tsc errors alone even if all tests are skipped, and that there is **no coverage/threshold gate** (folded into step 3). Nothing rejected. Gemini review skipped per owner preference. Status → ready — reviewed. (Reviser: Agent — subagent of team lead.)
