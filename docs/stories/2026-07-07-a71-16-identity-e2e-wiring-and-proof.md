# A71-16 — Wire the identity chain end-to-end and re-run the live sync-mesh proof

## Provenance & ownership
- **Project owner:** Martin Priessner (martin.priessner@scisymbio.ai)
- **Created by:** Agent 70
- **Created:** 2026-07-07
- **Status:** ready
- **Assigned to / currently owned by:** Agent 70 (this story is driven by Agent 70 directly — NOT delegated to Sonnet — because it operates the live Docker/Supabase environment and needs owner `!` commands for secrets)
- **Related / parallel work:** depends on 2026-07-07-a71-14 (notebook identity) and 2026-07-07-a71-15 (hub owner resolution) both being implemented; supersedes the "per-user ownership prerequisite" flagged in the 2026-07-07 live E2E findings. [[2026-07-04-a71-02-content-sync-fill-scaffolds]] content sync becomes testable only once this passes.

## Repos / branches
- **chatbot-notebook:** `feat/a71-14-notebook-identity` (on top of `feat/a71-02-notebook-content-push`)
- **ExpTube:** `feat/a71-15-sync-owner-resolution` (on top of `feat/a71-01-notebook-origin`)
- **SymbioKnowledgeBase:** existing a71-02 branch state (additive migrations already applied live to `symbio` DB)
- No new code expected; this story is configuration + orchestration + verification. Any bug found feeds back as a fix commit on the owning story's branch.

## Problem

The 2026-07-07 live E2E run proved transport+auth+widened-origin but died at `user_id NOT NULL`. Once a71-14/15 land, nothing has yet demonstrated the full chain **notebook (logged in) → ExpTube (owned row) → SKB (tenant page)**. Additionally, the working environment recipe currently lives only in session memory — it must be captured as a runbook so the mesh is reproducible without an agent's conversation history.

## Scope

### 1. Environment wiring (documented as a runbook, applied live)
Create `docs/runbooks/a71-sync-mesh-local.md` (in SymbioKnowledgeBase) capturing, and then actually apply:
- **Notebook `.env` additions** (owner performs surgical manual edit — agents never rewrite `.env`): `NOTEBOOK_SYNC_HUB_URL=http://127.0.0.1:3002` (MUST be 127.0.0.1, not localhost — Docker binds IPv4 only), `SUPABASE_SERVICE_ROLE_KEY` (ExpTube's), `SKB_SYNC_URL`, `SYNC_SERVICE_KEY`, `SKB_TENANT_ID`. Plus `AUTH_ENABLED=1` for the logged-in test. **Var names must be taken from `backend/sync_client.py` `get_config()` as implemented, not from older story prose** (a71-01's text mentions `NOTEBOOK_SYNC_SERVICE_KEY`, which the code does not read — the code reads `SUPABASE_SERVICE_ROLE_KEY`; the runbook must state the code-verified names and note the doc discrepancy).
- **ExpTube container env:** `SYNC_DEFAULT_OWNER_EMAIL=martin.priessner@scisymbio.ai` via compose env + container restart (host edits don't reach the container). **Plus the hub→SKB relay vars, by exact name:** `SKB_API_URL=http://host.docker.internal:3000` and `SKB_SYNC_SERVICE_KEY` (read by `lib/integrations/skb-sync-service.ts:19-20`; if EITHER is unset, `isConfigured()` returns false and the relay is a SILENT no-op — SKB never gets the page and nothing errors). Routing fact (verified in code): lifecycle creates reach SKB only via this hub relay; content updates go notebook→SKB direct.
- **TENANT INVARIANT (critical):** the hub relay sends NO `X-Tenant-ID` header (`skb-sync-service.ts:68-73`), so SKB files the created page under its own `DEFAULT_TENANT_ID`; the notebook's direct content updates DO send `X-Tenant-ID` = notebook `SKB_TENANT_ID`, and SKB's content handler 404s on a tenant-scoped miss. Therefore **notebook `SKB_TENANT_ID` MUST equal the SKB server's `DEFAULT_TENANT_ID`** — assert this equality in preflight, or step 7 dies (or silently scaffolds a duplicate page) after steps 3–4 "pass".
- **Loopback forwarder:** `127.0.0.1:54341 → 127.0.0.1:54381` (the container's `host.docker.internal:54341` Supabase path; :54341 on the host is otherwise a Tailscale-Serve bind). Include the forwarder script + a launchd/keep-alive note, since without it every hub insert dies with `fetch failed`.
- **Docker health preflight:** containers up, `open -a Docker` recovery note.

### 1b. Preflight checks (each must pass BEFORE the E2E run — prevents false passes/fails)
1. **Branch/runtime identity:** prove each running process matches its intended branch — notebook backend: log/endpoint reporting git SHA or start it from the pinned worktree and record the SHA; ExpTube: confirm the container's code corresponds to `feat/a71-15-sync-owner-resolution` (rebuild/restart and record image + SHA); SKB dev server: MUST be running the **a71-02 branch checkout** (the main checkout's sync route has no content handlers — running SKB main would make step 7 fail or step 4 falsely narrow). Record all three SHAs in the results.
2. **Container→Supabase path:** test from INSIDE `exptube-exptube-1` (e.g. `docker exec ... node -e "fetch('http://host.docker.internal:54341/rest/v1/')..."` or curl if present) — a host-side port check does not prove the container path.
3. **Owner profile preflight:** SQL-verify exactly one `profiles` row for martin.priessner@scisymbio.ai (case-insensitive); if duplicates exist, record which id the a71-15 deterministic rule (oldest `created_at`) selects and assert against that id specifically.
4. **SKB auth/tenant probe:** POST a deliberately invalid payload with correct and incorrect bearer + tenant header; confirm 401 vs 400 vs 422 discrimination, and record the tenant id the running SKB will actually use (X-Tenant-ID header vs `DEFAULT_TENANT_ID`).
5. **SKB live-DB schema:** confirm the `Page` tenant+externalId uniqueness and the a71-02 tables exist in the live `symbio` DB (they were applied 2026-07-07 — re-verify, don't assume). Also apply the a71-15 `resolve_user_id_by_email` replacement migration (owner-authorized, owner runs it — same protocol as prior live migrations).
6. **Tenant equality:** assert notebook `SKB_TENANT_ID` == SKB server `DEFAULT_TENANT_ID` (see TENANT INVARIANT above) before anything else runs.
7. **Drain the notebook DLQ:** the 2026-07-07 failed run left DLQ'd creates that predate a71-14 (no email). If they replay when the fixed hub comes up, they manufacture rows that look exactly like step-5 fallback successes and extra SKB pages. Inspect + archive/clear the DLQ before the run; record what was there.
8. **Sweep for prior-run contamination in SKB:** list any existing Pages whose externalId matches today's `NOTEBOOK-YYYYMMDD-*` pattern BEFORE the run (the ELN id is date+counter, not run-unique — a pre-existing page would give step 4 a false pass). ExpTube is likely clean (prior run died before the relay) but run the same sweep there.
9. **Port 3000 is really ours:** Next.js auto-increments to :3001 if :3000 is taken WITHOUT failing — so "SKB dev server started" does not mean it answers on :3000. Verify nothing else is bound to :3000 (including SKB's own Docker stack or a stale main-branch dev server, whose sync route lacks content handlers and would 400 step 7), and confirm the process answering on :3000 reports the pinned a71-02 checkout (hit a route or check the listening pid's cwd).
10. **OAuth redirect allowlist covers :8010:** login goes through the shared cloud Supabase project; a71-01-era assumptions were :8000. Confirm the :8010 callback URL is in the project's redirect allowlist (`scripts/allowlist_redirect.py` — append-only) BEFORE step 1, or the owner cannot log in at all.

### 2. Live E2E run (the actual proof)
All test experiments carry an `A71-E2E-<timestamp>` title prefix; every SQL assertion is scoped to the exact allocated ELN id from that run (never "a row exists with origin=notebook"). Capture request/response bodies at each hop so one event is traceable across notebook DLQ, hub logs, and SKB.
1. Start notebook backend (a71-14 branch) with auth on; owner logs in with martin.priessner@scisymbio.ai.
2. Create an experiment (`A71-E2E-...` title) via the notebook UI/API → capture the allocated `NOTEBOOK-YYYYMMDD-NNNN` id AND the outgoing hub payload (must show `created_by_email` = Martin's email).
3. **ExpTube check:** row with that exact `eln_experiment_id` has `origin='notebook'` and `user_id` = the preflight-recorded profile id (SQL via psql against local Supabase). Also confirm the experiment is visible in the ExpTube UI while logged in as Martin (RLS proof — record the logged-in user's id and compare to the row's `user_id`).
4. **SKB check:** Page with `externalId` = that exact ELN id exists in the **preflight-recorded tenant** (tenant-scoped query, not a global externalId search).
5. **Fallback path:** create one experiment with auth OFF → capture the outgoing payload proving `created_by_email` is absent/null, and a hub log line proving the `SYNC_DEFAULT_OWNER_EMAIL` branch executed. (Owner UUID alone proves nothing here — it's the same person; the payload + log are the evidence.)
6. **Negative path:** make BOTH resolution inputs unresolvable — send a create with an unknown `created_by_email` AND temporarily set `SYNC_DEFAULT_OWNER_EMAIL` to an unknown address (container restart to apply) → expect 422 `owner_unresolved` + notebook DLQ entry. Then restore config + restart + confirm a follow-up create succeeds (proves restoration). **Restart hygiene:** each restart drops in-flight hub→SKB relays, lets the two host workers error against a down app, and accumulates fresh notebook DLQ entries that will replay later — so after EACH restart, diff the container env (all relay + Supabase + owner vars still present; a missed var silently disables the SKB relay) and clear/account for DLQ entries generated while the hub was down before interpreting any subsequent step.
6b. **Session freshness:** the run is long and spans two restarts; the notebook session cookie can expire mid-run, silently downgrading "logged-in" creates to anonymous (default-owner) ones that look identical because the default owner IS Martin. Re-verify the session (e.g. an authenticated request returns the email) immediately before EVERY logged-in create assertion, especially step 3.
7. **a71-02 content sync smoke:** PRECONDITION: SKB dev server runs the a71-02 branch (preflight 1b.1). Push one content/section update through and verify it fills the SKB scaffold section for that exact page.

### 3. Teardown + status updates
- Stop test servers/forwarder or hand them over deliberately; document what stays running.
- Update Status fields on a71-01/02/14/15 stories (E2E-verified or blocked-with-reason) and refresh the a71 memory files.

## Out of scope
- Merging any branch to main (separate owner decision; merge sequencing notes live in the a71 epic memory: a70-06 first, then SKB a71-02, reconcile notebook `app.py` with the evidence-triangle branch).
- SKB per-user page ownership (recorded decision: SKB stays tenant/workspace-scoped — "same login sees the same workspace data" is the accepted semantics there).
- a71-03 backflow (Phase 2).
- Any production/Tailscale exposure changes.

## Acceptance criteria
1. One notebook-created experiment (logged in) is visible in all three systems, with the ExpTube row owned by Martin's real user id — screenshots/SQL output attached to the story on completion.
2. Fallback (no email) and negative (unresolvable) paths behave as specified in a71-15.
3. The runbook is complete enough that a fresh agent could rebuild the environment without session memory.
4. Story Status fields + memory updated; explicit statement of what is and is NOT yet merged.

## Risks / review focus
- **Secrets handling:** the service-role key moves only via owner-run `!` commands or manual edits; never printed (lengths/booleans only).
- **Shared live DB:** SKB `symbio` DB and ExpTube local Supabase are real, shared instances — test rows should be clearly named (`A71-E2E-...`) and the story must NOT run `supabase db reset` (would revert live-applied migrations).
- **Branch collisions:** notebook main checkout belongs to the evidence-triangle agent; all notebook work happens in a worktree on the a71 branches.
- **Two ExpTube workers:** if stitch/queue workers matter for any step, both `local-stitch-worker.sh` and `local-worker.sh` must be running — note in runbook.


## Reviewer Feedback / Codex (round 1)

**Critical issues:**
- `a71-16` treats `a71-02 content sync smoke` as runnable, but current SKB `src/app/api/sync/experiments/route.ts` still only accepts `create/delete/restore/update/purge/archive`; no `content_update`, no `content` schema, no merge handler. Unless the SKB a71-02 implementation is already checked out and running, step 7 will fail or accidentally “pass” by only proving lifecycle scaffold creation.
- Notebook env wiring is ambiguous/wrong for hub auth. `a71-01` names `NOTEBOOK_SYNC_SERVICE_KEY`; `a71-16` lists `SUPABASE_SERVICE_ROLE_KEY`, `SYNC_SERVICE_KEY`, and SKB content vars. If the implemented notebook client expects `NOTEBOOK_SYNC_SERVICE_KEY`, the hub call can silently no-op/DLQ.
- ExpTube container-to-SKB routing is not specified. From inside the ExpTube container, `localhost:3000` or `127.0.0.1:3000` points at the container, not SKB on the host. The runbook needs the actual `SKB_API_URL`/equivalent set to a container-reachable host address, likely `http://host.docker.internal:3000`.
- The negative-path step can create false evidence unless it isolates both owner-resolution inputs. If `created_by_email` is unknown but `SYNC_DEFAULT_OWNER_EMAIL` remains valid, the route should fall back rather than return `422 owner_unresolved`. To prove `owner_unresolved`, both attempted email and fallback must be unresolvable, and config must be restored/restarted before continuing.
- The fallback-path proof is weak because the same UUID is expected for Martin. “Assert via hub logs” is not enough unless the create payload is captured showing `created_by_email` absent/null and the route logs/SQL prove `SYNC_DEFAULT_OWNER_EMAIL` was used. Otherwise it can be a logged-in-path false pass.
- SKB tenant proof is incomplete. SKB resolves tenant from `X-Tenant-ID` or `DEFAULT_TENANT_ID`; the plan must verify the actual request includes the intended tenant header or that the running SKB process has the intended default. A page with matching `externalId` in some tenant is not sufficient.
- Live DB safety needs explicit unique test IDs and cleanup/retention policy. Reusing `NOTEBOOK-YYYYMMDD-NNNN` from real notebook creation can collide with previous attempts or leave durable rows in ExpTube/SKB. The plan should require an `A71-E2E-...` title plus SQL checks scoped to the exact allocated ID and timestamp.
- Branch/runtime verification is underspecified. The plan names branches, but does not require proving the running notebook backend, ExpTube container image, and SKB dev server actually correspond to those branches/builds after restarts. This is a classic stale-server false pass/fail source.
- ExpTube owner resolution depends on `profiles.email`; the plan should preflight that Martin’s profile exists exactly as expected before the run. If duplicate profiles exist, `user_id = profile id` must match the deterministic rule from a71-15, not an arbitrary query result.
- The loopback forwarder is included, but the preflight should actually test Supabase reachability from inside `exptube-exptube-1` via `host.docker.internal:54341`. A host-side port check alone will not prove the container path works.

**Nice-to-have:**
- Record exact ports in the runbook: hub `127.0.0.1:3002`, SKB `:3000`, notebook backend `:8010`, and avoid older notebook `:8000` assumptions from a71-01.
- Add an explicit SKB auth probe before E2E: POST a harmless invalid payload with correct/incorrect bearer key and tenant header to distinguish `401`, `400`, and `422`.
- Capture response bodies and correlation IDs across notebook DLQ, ExpTube logs, and SKB logs so the three systems can be tied to one event.
- Include a check that SKB `Page.externalId` uniqueness migration is present in the live DB, not just in Prisma files.
- Make the runbook say whether ExpTube workers are needed for this path; if not needed, state that so missing workers are not misdiagnosed.
- For UI visibility/RLS proof, include the exact ExpTube logged-in session/user and a direct SQL comparison against `auth.uid()`-equivalent profile id.

## Revision History
- 2026-07-07 — Initial draft (Agent 70)
- 2026-07-07 — Round-1 revision after Codex: added preflight section 1b (branch/runtime SHA pinning, container-path Supabase test, owner-profile preflight, SKB auth/tenant probe, live-schema check); E2E steps hardened against false passes (A71-E2E ID prefix + exact-id scoped SQL, payload capture for fallback proof, dual-input isolation for negative path, tenant-scoped SKB check, a71-02-branch precondition for content smoke); env-var names pinned to code not story prose; hub→SKB container routing (host.docker.internal) added.

## Reviewer Feedback / GLM (round 2) — FALLBACK: Claude Opus
*GLM returned 429 "Weekly/Monthly Limit Exhausted" (resets 2026-07-08 23:38); lens covered by a Claude Opus subagent per the /story fallback rule. Findings (all traced to code):*
1. **[CRITICAL]** Split-tenant: hub relay sends NO X-Tenant-ID (`lib/integrations/skb-sync-service.ts:68-73`) → SKB creates land under `DEFAULT_TENANT_ID`; notebook content updates DO send X-Tenant-ID and SKB's content handler 404s on tenant-scoped miss — if the two tenant values differ, steps 3–4 pass then step 7 dies. Invariant: notebook SKB_TENANT_ID == SKB DEFAULT_TENANT_ID.
2. **[CRITICAL]** Container relay reads `SKB_API_URL` + `SKB_SYNC_SERVICE_KEY` (`skb-sync-service.ts:19-20`); either unset = SILENT no-op (L36-38, L57-59) — no SKB page, no error. Story hadn't pinned these names.
3. Pre-existing SKB pages with today's `NOTEBOOK-YYYYMMDD-*` ids give step 4 a false pass (ELN id is date+counter, not run-unique) — preflight sweep required.
4. Stale notebook DLQ entries (no email, pre-a71-14) replay when the fixed hub comes up and impersonate step-5 fallback evidence — drain DLQ first.
5. Next.js auto-increments to :3001 if :3000 is taken WITHOUT failing, while the hub keeps hitting :3000 — possibly a stale main-branch server whose route lacks content_update (400s step 7). Verify the process identity on :3000.
6. OAuth redirect allowlist may cover :8000 (a71-01 era) but not :8010 — blocks step 1 login entirely.
7. Session cookie can expire across the long two-restart run — "logged-in" creates silently become default-owner ones, indistinguishable because the default owner IS Martin. Re-verify session before each logged-in assertion.
8. Container restarts drop in-flight relays, leave host workers erroring, can silently lose relay vars in the compose edit, and accumulate replaying DLQ entries — restart hygiene steps required.
9. ExpTube idempotency `.maybeSingle()` multi-row behavior → cross-ref a71-15 (fixed there).
- 2026-07-07 — Round-2 revision after Opus fallback: TENANT INVARIANT + exact relay var names added to wiring; preflight extended (tenant equality, DLQ drain, contamination sweep, port-3000 process identity, OAuth :8010 allowlist, RPC migration apply); restart-hygiene + session-freshness steps added to the run. **Status: Reviewed — ready to execute after a71-14/15 land.**
