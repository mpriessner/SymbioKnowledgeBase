# A71-15 — ExpTube sync-create resolves owner by email and stamps `user_id`

## Provenance & ownership
- **Project owner:** Martin Priessner (martin.priessner@scisymbio.ai)
- **Created by:** Agent 70
- **Created:** 2026-07-07
- **Status:** implemented (commit d586588 on feat/a71-15-sync-owner-resolution, 2026-07-07; 20/20 route tests green, tsc delta 0, migration file NOT yet applied to live DB — that happens in a71-16. Known gap: SYNC_DEFAULT_OWNER_EMAIL documented in README only; the env-example file is hook-protected and needs an owner hand-edit.)
- **Assigned to / currently owned by:** Agent 70 (implementation delegated to Sonnet subagent after review)
- **Related / parallel work:** 2026-07-07-a71-14 (notebook produces the `created_by_email` field this story consumes); 2026-07-07-a71-16 (live E2E re-proof); [[2026-07-04-a71-01-notebook-joins-sync-mesh]] (widened-origin CHECK already applied live). ExpTube main checkout is on `feat/improvement-audit-exptube-2026-07-03`; the a71 hub work lives on `feat/a71-01-notebook-origin` — branch from there.

## Repo / branch
- **Repo:** `ExpTube`
- **Base branch:** `feat/a71-01-notebook-origin`
- **New branch:** `feat/a71-15-sync-owner-resolution`

## Problem (proven live, 2026-07-07)

The hub's cross-platform sync-create (`app/api/sync/experiments/route.ts`, insertData ~L120-125) deliberately **omits `user_id`** ("may be unknown for cross-platform creates"), assuming the column is nullable. It is not: `experiments.user_id UUID NOT NULL REFERENCES auth.users(id)` (migration `087_create_experiments.sql:8`), with RLS keyed on `auth.uid() = user_id`. Result: **every** sync-create — notebook, and latently chemeln/mobile — fails with Postgres `23502 null value in column "user_id"`. This is the hard blocker that stopped the a71 live E2E test.

Design decision (owner-approved 2026-07-07): resolve the owner **by email** at sync time. Email is the cross-platform join key — the notebook login, SKB's user model, and ExpTube's `profiles.email` all share it. Do NOT relax `NOT NULL` or the RLS model.

## Scope

### 1. Owner resolution in the sync-create path
In `app/api/sync/experiments/route.ts`:
0. **Ordering (critical):** owner resolution runs AFTER the existing-row idempotency check (~L99, which returns 200 and skips insert when the `eln_experiment_id` already exists). Resolving first would turn idempotent duplicate retries from legacy chemeln/mobile clients (no email) into 422s when no default owner is configured.
1. Add `created_by_email?: string | null` to the `SyncRequest` interface (~L38) — reading it off `body` without the type change adds a touched-file TypeScript error.
2. Read `body.created_by_email`; if absent/empty, fall back to the `SYNC_DEFAULT_OWNER_EMAIL` env var.
3. Resolve the chosen email → user id via **literal case-insensitive equality, NOT `ilike`**. Runtime review (round 2) killed the earlier `ilike` plan: `_` is a single-char wildcard in `ILIKE` and real emails contain underscores, so an unescaped (or escape-mangled across the JS→PostgREST→Postgres boundary) pattern can silently resolve to the WRONG user and stamp their ownership. Instead: ship a small additive migration `CREATE OR REPLACE FUNCTION resolve_user_id_by_email(p_email text) RETURNS TABLE(user_id uuid, match_count bigint)` based on the existing RPC (`20260613120000_audit_rls_hardening.sql:67`, which already uses safe `lower(p.email) = lower(btrim(p_email))` literal equality) — adding `ORDER BY created_at ASC` (deterministic: oldest profile wins) and a total match count so the route can log a duplicate-email warning. Route calls it via `supabaseAdmin.rpc('resolve_user_id_by_email', { p_email })`. NOTE: applying this migration to the live DB happens in a71-16 with owner authorization (owner runs it), same as prior live migrations.
4. Stamp the resolved id as `user_id` in `insertData`.
5. If NO email resolves (unknown email AND no/unresolvable default): return **422** with a structured body, e.g. `{ error: 'owner_unresolved', email: <attempted or null> }` — never a 500. The notebook client DLQs 4xx/5xx alike, so this is safe upstream.
6. Distinguish failure modes: unknown email → 422 `owner_unresolved`; admin-client/Supabase fetch failure during lookup → 502/503-style structured error (separate test for each). With the RPC approach: `error !== null` = infra failure (502-style); empty result = unknown email (422).
7. **Harden the idempotency lookup's error handling (runtime finding):** the existing check (~L99-100) destructures only `data` from `.maybeSingle()` and silently drops `error` — but `.maybeSingle()` returns an error OBJECT (not a throw) when >1 row matches, making `existing` null and falling through to insert. Since uniqueness is per-owner (`(user_id, eln_experiment_id)`, migration 093), multi-row is legal and reachable. Fix: destructure and handle `error` explicitly (log + return a 502-style structured error, never silent fall-through), and map an insert failure with Postgres code `23505` (per-owner unique violation) to a structured **409** instead of the generic 500 (~L131-133).

### 2. Update path unchanged
Sync **updates** match an existing row by `eln_experiment_id` and must NOT change ownership. No `user_id` on update.

### 3. All sources benefit
The resolution applies to every `source` (notebook/chemeln/mobile) — this fixes the latent breakage for chemeln/mobile creates too, using the same default-owner fallback when they send no email.

### 4. Config + docs
- New env var `SYNC_DEFAULT_OWNER_EMAIL` documented in the repo's env example/README next to `SUPABASE_SERVICE_ROLE_KEY`. In this deployment it will be `martin.priessner@scisymbio.ai`.
- Docker note: the app runs in `exptube-exptube-1`; env changes require compose env update + container restart (host-side edits alone don't reach it).

## Out of scope
- Schema changes (no `NOT NULL` relaxation, no new columns, no RLS edits — owner rule: do not touch the `user_id`/RLS model beyond stamping a valid value).
- Auto-provisioning users for unknown emails (unresolvable → 422, human decides).
- Ownership propagation into SKB (SKB stays tenant-scoped — recorded decision, see a71-16 notes).
- Backfilling owners on any previously failed/missing rows.

## Acceptance criteria
1. Sync-create with a `created_by_email` matching an existing profile inserts a row with that user's `user_id` (unit test with mocked admin client + integration test against local Supabase if available in CI).
2. Sync-create with no email but `SYNC_DEFAULT_OWNER_EMAIL` set inserts owned by the default user.
3. Sync-create with an unknown email and no resolvable default returns 422 `owner_unresolved` (not 500), and nothing is inserted.
4. Email matching is case-insensitive and trims whitespace.
5. **Idempotency preserved:** a duplicate create (existing `eln_experiment_id`) with NO email and NO default owner still returns 200 (regression test — resolution must not run before the existing-row check).
6. Sync-update never modifies `user_id` — explicit regression test that a body containing `created_by_email` or `user_id` with `action: 'update'` passes neither through to `.update(...)` (current update payload is `updated_at` + `name` only, ~L294).
7. Admin-lookup infrastructure failure returns a 502/503-style structured error, distinct from 422 (test).
8. **Test harness updated:** the route's mock admin client (`app/api/sync/experiments/__tests__/route.test.ts` ~L49) currently supports only `experiments`/`experiment_videos` and throws on any other table — it must gain a handler for the owner-resolution call (rpc or table), and the existing create test (~L123) must be updated to assert `user_id` stamping. **Additionally (runtime finding):** `beforeEach` (~L91-94) stubs only the service-role key; the existing create test sends `source:'chemeln'` with NO email, so under the new logic it 422s unless the test ALSO stubs `SYNC_DEFAULT_OWNER_EMAIL` AND the mock resolves that default email to a user id. Both stubs are required or the suite is red regardless of the handler fix.
9. `SYNC_DEFAULT_OWNER_EMAIL` documented in `.env.example` and README (next to the service-role key docs, README ~L248).
10. Existing sync-route tests still green; `npm test` (or repo-standard unit runner) green on the branch. tsc is soft-gated (207 pre-existing errors — do not add new ones in touched files).

## Verification
- Unit/integration tests above.
- Live verification is deliberately deferred to a71-16 (full mesh re-proof) — do not claim E2E from this story alone.

## Risks / review focus
- **Deliberate contract change for legacy clients (owner-accepted):** chemeln/mobile creates with no email previously failed at the DB (`23502`) — they never actually succeeded — but under this story they become owned by the default owner, and if no default is configured they now get 422 instead of 500. In this single-owner deployment the default owner IS the real user (martin.priessner@scisymbio.ai), so attribution is correct; if multi-user mobile sync ever lands, those clients must start sending `created_by_email`. Documented here as an accepted decision, not a bug.
- **Hidden invariant — `eln_experiment_id` uniqueness is per-owner, not global:** migration `093` makes the unique index `(user_id, eln_experiment_id)`, but the route's idempotency lookup (~L99) is global by `eln_experiment_id` alone. With a single real owner this is safe; if two users ever hold the same external ELN id, the global lookup short-circuits before ownership matters. Record as a known limitation (do NOT change the lookup in this story).
- **Base branch matters:** this checkout's migration `107` allows only `('exptube','chemeln','mobile')` origins — `notebook` is only in the widened CHECK on `feat/a71-01-notebook-origin` (already applied to the live DB). Implementation MUST branch from `feat/a71-01-notebook-origin` or notebook creates keep failing at the origin CHECK.
- **Duplicate emails in `profiles`:** the column has no UNIQUE constraint. Resolution must be deterministic — order by `created_at` ascending, `limit 2` so duplicates are detectable (a `limit 1` query cannot warn), oldest profile wins, warn on 2 rows.
- **Admin-client reachability:** the container reaches Supabase via `host.docker.internal:54341`, which on this host needs the loopback forwarder (:54341→:54381). The route must surface a clear 502/503-style error on fetch failure rather than a generic 500 — but do not build retry logic here (the notebook DLQ already retries).
- **Service-role write bypasses RLS** (expected — inserts as admin); reads by the owner then work naturally via `auth.uid() = user_id`. Confirm no RLS policy blocks service-role UPDATE on the update path.
- Never log the service-role key or full tokens; log email + boolean resolution outcome only.


## Reviewer Feedback / Codex (round 1)

Critical issues:
- Existing create tests will break unless the admin mock is updated. [route.test.ts](/Users/mpriessner/windsurf_repos/ExpTube/app/api/sync/experiments/__tests__/route.test.ts:49) only supports `experiments` and `experiment_videos`; a new `.from('profiles')` call will throw `Unexpected table: profiles`. The current create test at [route.test.ts](/Users/mpriessner/windsurf_repos/ExpTube/app/api/sync/experiments/__tests__/route.test.ts:123) also asserts insert mapping without `user_id`, so it must be updated to assert owner stamping.
- Do not resolve the owner before the existing-row idempotency check. The route currently returns `200` and skips insert when `eln_experiment_id` already exists at [route.ts](/Users/mpriessner/windsurf_repos/ExpTube/app/api/sync/experiments/route.ts:99). If owner resolution runs before that, duplicate create retries from old ChemELN/mobile/SKB clients with no `created_by_email` and missing/unresolvable default owner will become `422` instead of idempotent success.
- The plan changes the public sync-create contract for current ChemELN/mobile clients that do not send `created_by_email`. If `SYNC_DEFAULT_OWNER_EMAIL` is missing or invalid, creates now fail `422`; if it is set, all no-email creates become owned by the default user. That is a real behavior change for mobile users if they expect synced experiments to be visible under their own `auth.uid()` RLS.
- The route’s existing lookup is global by `eln_experiment_id` only, but the database uniqueness is per owner: [093_add_eln_experiment_id_to_experiments.sql](/Users/mpriessner/windsurf_repos/ExpTube/supabase/migrations/093_add_eln_experiment_id_to_experiments.sql:24). If two users can legitimately have the same external ELN ID, the current idempotency check will return the first existing experiment before the new resolved `user_id` matters. The plan depends on hidden global uniqueness of `eln_experiment_id`, despite the schema not enforcing it.
- The plan’s query shape, `lower(email) = lower($email)`, is not directly a Supabase query-builder call. There is an existing `resolve_user_id_by_email` RPC at [20260613120000_audit_rls_hardening.sql](/Users/mpriessner/windsurf_repos/ExpTube/supabase/migrations/20260613120000_audit_rls_hardening.sql:67), but it uses plain `LIMIT 1` without deterministic ordering or duplicate warning. Implementation needs a concrete query/RPC approach.
- `SyncRequest` currently has no `created_by_email` field at [route.ts](/Users/mpriessner/windsurf_repos/ExpTube/app/api/sync/experiments/route.ts:38). If the implementation reads `body.created_by_email` without updating the interface, it adds a touched-file TypeScript error.
- Update path must remain owner-stable. Current update payload only includes `updated_at` and `name` at [route.ts](/Users/mpriessner/windsurf_repos/ExpTube/app/api/sync/experiments/route.ts:294). Add an explicit regression test that a body containing `created_by_email` or `user_id` during `action: 'update'` does not pass either through to `.update(...)`.
- Origin handling depends on the base branch. This checkout’s migration only allows `origin IN ('exptube', 'chemeln', 'mobile')` at [107_add_experiment_origin.sql](/Users/mpriessner/windsurf_repos/ExpTube/supabase/migrations/107_add_experiment_origin.sql:3). The story says `notebook` works on `feat/a71-01-notebook-origin`; the implementation must be branched from that base or notebook creates will still fail at the origin CHECK.

Nice-to-have:
- Document `SYNC_DEFAULT_OWNER_EMAIL` in both [.env.example](/Users/mpriessner/windsurf_repos/ExpTube/.env.example:1) and [README.md](/Users/mpriessner/windsurf_repos/ExpTube/README.md:248); those are the visible env contract locations next to `SUPABASE_SERVICE_ROLE_KEY`.
- Add tests for lookup DB errors separately from unresolved email. Unknown email should be `422 owner_unresolved`; Supabase/admin fetch failure should be a clear `502/503` style response per the plan’s own risk section.
- Duplicate-email warning needs a query that can actually detect duplicates. `limit 1` cannot tell whether there were multiple profile matches.
- Normalize and validate status/source inputs near insert. The route inserts `body.fields?.status` and `body.source` directly at [route.ts](/Users/mpriessner/windsurf_repos/ExpTube/app/api/sync/experiments/route.ts:120); unsupported values will still surface as generic create failures unless handled deliberately.

## Revision History
- 2026-07-07 - Initial draft (Agent 70)
- 2026-07-07 - Round-1 revision after Codex: owner resolution moved AFTER the idempotency check (duplicate retries stay 200); SyncRequest interface gains created_by_email; concrete duplicate-aware ilike/order/limit-2 query replaces pseudo-SQL (existing RPC rejected - nondeterministic LIMIT 1); idempotency + update-passthrough + 502-vs-422 + mock-profiles-table test requirements added; legacy-client contract change and per-owner uniqueness invariant documented as accepted decisions; base-branch (feat/a71-01-notebook-origin) requirement reinforced; env-example + README documentation required.

## Reviewer Feedback / GLM (round 2) — FALLBACK: Claude Opus
*GLM returned 429 "Weekly/Monthly Limit Exhausted" (resets 2026-07-08 23:38); lens covered by a Claude Opus subagent per the /story fallback rule. Findings:*
1. **[HIGH]** Even with a resolution mock added, the existing create test (`route.test.ts:123`, `source:'chemeln'`, no email) still 422s: `beforeEach` (L91-94) stubs only the service-role key — the test must ALSO stub `SYNC_DEFAULT_OWNER_EMAIL` and have the mock resolve it.
2. **[HIGH]** Round-1's `.ilike()` plan is a silent wrong-owner hazard: `_` is a single-char wildcard, real emails contain underscores, and escape survival across the JS→PostgREST→Postgres boundary is unreliable — `john_doe@` could match `johnXdoe@` and stamp the WRONG user's ownership with no error. The existing RPC's `lower(email) = lower(btrim(...))` literal equality is the safe primitive; it only lacked deterministic ordering.
3. **[MEDIUM]** The idempotency check (route.ts ~L100) drops the `.maybeSingle()` error object; >1 matching row (legal under per-owner uniqueness, migration 093) makes `existing` null and falls through to insert — after this story that means either a second row for a different owner or a 23505 → generic 500. Handle the error explicitly; map 23505 to 409.
4. **[LOW]** The 502-vs-422 split relies on the array-return contract (empty data = unknown, error object = infra) — implementer must not "fix" it to `.maybeSingle()`.
5. **[INFO]** Verified clean: no INSERT triggers on experiments; FK satisfied via profiles.id = auth.users.id; status 'draft' + origin 'notebook' valid on the base branch. Risk is concentrated in resolution, not insertion.
- 2026-07-07 - Round-2 revision after Opus fallback: resolution flipped from ilike to a literal-equality RPC replacement migration (deterministic ORDER BY created_at + match count, applied live in a71-16 with owner authorization); idempotency error-swallow handled + 23505→409; AC8 widened with the default-owner env stub requirement. **Status: Reviewed — ready for implementation.**
