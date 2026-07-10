# A71-14 — Notebook captures the logged-in user and propagates identity through sync

## Provenance & ownership
- **Project owner:** Martin Priessner (martin.priessner@scisymbio.ai)
- **Created by:** Agent 70
- **Created:** 2026-07-07
- **Status:** implemented (commit fb1fb52 on feat/a71-14-notebook-identity, 2026-07-07; 1902 suite passes, all 14 failures verified pre-existing on base via stash-rerun; every revised AC satisfied. Two pre-existing bugs discovered and flagged for separate ownership: (1) backend/app.py calls auth.has_desktop_session_cookie() which does not exist — voice-lease force-release 500s under AUTH_ENABLED; (2) output-HTML sanitizer has a live onerror-attribute XSS gap, two failing tests.)
- **Assigned to / currently owned by:** Agent 70 (implementation delegated to Sonnet subagent after review)
- **Related / parallel work:** [[2026-07-04-a71-01-notebook-joins-sync-mesh]], [[2026-07-04-a71-02-content-sync-fill-scaffolds]] (this story extends their sync payloads); 2026-07-07-a71-15 (hub-side consumer of the new field); 2026-07-07-a71-16 (live E2E re-proof). Notebook main checkout is currently on `feat/evidence-triangle-epic` (another agent) — this story MUST branch from `feat/a71-02-notebook-content-push`, not from the main checkout's HEAD.

## Repo / branch
- **Repo:** `chatbot-notebook-transparency-prototype-ui`
- **Base branch:** `feat/a71-02-notebook-content-push` (contains `backend/sync_client.py` and the lifecycle dispatch — these files do NOT exist on `main`)
- **New branch:** `feat/a71-14-notebook-identity`

## Problem

The live E2E test of the a71 sync mesh (2026-07-07) proved the notebook→ExpTube transport works but the chain dies at ExpTube's `experiments.user_id NOT NULL` constraint: the hub has no idea *who* created a notebook experiment, because the notebook never tells it.

The notebook already HAS an optional Google-OAuth login (`backend/auth.py`) that authenticates against the same cloud Supabase project ExpTube's login uses (`xysiyvrwvhngtwccouqy`, see `scripts/allowlist_redirect.py:5-7`). But it is identity-thin: it only gates access. The signed-in user's email (available as `sub` in the `nb_session` JWT, `backend/auth.py` ~L199-204) is never attached to experiments and never included in sync payloads.

Goal (owner-stated): *"the same user persona across the different platforms — if I'm logged in with the same person, I see the same data."* Email is the join key across the cloud-Supabase identity (notebook login) and ExpTube's local-Supabase ownership model.

## Scope

### 1. Capture the creator's email on experiment creation
- Add `get_session_email(request) -> str | None` in `backend/auth.py`, wrapping the existing `verify_session()` (~L207) so JWT failures stay non-throwing; validate `sub` is a non-empty string. No ad-hoc cookie decoding in `app.py`.
- In `backend/app.py` `POST /api/experiments` (~L1076-1099): resolve the email via that helper and persist it. **The capture/persist happens in the route handler BEFORE any sync-config consideration** — the sync no-op guard applies only inside `sync_client`, so unconfigured deployments still record the creator locally.
- **Storage:** persist as `created_by_email` in the experiment's settings. CAUTION — there are TWO settings write paths that must both preserve it: `ExperimentStore.read_settings/write_settings` via `backend/schemas.py` `ExperimentSettings` (`extra="allow"`, ~L239) and the Android/workspace ingest path via `backend/experiment_settings.py` (unknown keys preserved through `extras`, ~L53). Add a round-trip test through EACH path proving `created_by_email` (and other extras like the ingest token) survive a write.
- **Do NOT pin defaults when writing (runtime finding, HIGH):** `create_experiment()` today writes NO settings file — fresh experiments get dynamic defaults, and `read_settings`'s docstring guarantees "a settings.json that omits a field adopts the current default" (`backend/experiments.py` ~L633-636). A naive `write_settings()` at creation serializes EVERY field (`model_dump_json`, ~L661), freezing today's `auto_version_on_edit`/`auto_version_on_run`/`voice_auto_apply` defaults into every new experiment — future default changes would then never reach them. The creation-time write must emit ONLY the identity key (raw minimal JSON, or `model_dump_json(exclude_unset=True)`); add a test asserting a freshly created experiment's settings file contains `created_by_email` and NOTHING else.
- If `ExperimentStore.create_experiment()` gains the value as a parameter, it MUST be optional keyword-only (`created_by_email: str | None = None`) — many tests and backend call sites invoke it with no identity context (e.g. `tests/test_experiments.py:35`, `tests/test_a71_01_sync_mesh.py:63`).
- Do NOT make login mandatory. `AUTH_ENABLED` stays as-is (default off). When no session exists, `created_by_email` is `None` and the hub's default-owner fallback (a71-15) applies.
- Keep `created_by_email` OUT of the `ExperimentSummary` response schema (`backend/schemas.py` ~L177) — no public API shape change in this story.

### 2. Propagate identity through the sync client
- `backend/sync_client.py`: extend the hub payload with a top-level `created_by_email` field (string or null) **threaded create-only** — the payload dict is actually assembled in the SHARED `_send_lifecycle_event()` (~L217-223), used by create/delete/restore/update/archive; adding the field there would change the payload shape of ALL lifecycle actions, violating the "updates carry no creator" invariant below. Pass it from `send_create` into the builder (parameter defaulting to omit), so only create payloads carry the key. Any new parameter on `send_create`/`send_content_update` MUST default to `None` — existing tests call them without identity (e.g. `tests/test_a71_01_sync_mesh.py:259`) and `_schedule_wiki_content_push()` (`backend/app.py` ~L908) schedules with fixed kwargs.
- **Updates do NOT carry creator identity.** The rename/update dispatch path (`backend/app.py` ~L3451→~L3522) has no store access at the `send_update` call site, and a71-15 deliberately ignores ownership on update — so `send_update` stays untouched. (Original draft said "include on update if stored" — dropped after Codex review.)
- Include the same field in the direct notebook→SKB content-sync payload for forward-compatibility (SKB currently ignores it; harmless), honoring the default-`None` rule above.
- DLQ behavior unchanged: a 422 from the hub (owner unresolvable, see a71-15) must DLQ like any other failure, never crash experiment creation. Add an explicit 422→DLQ test (existing DLQ tests cover connection errors/5xx only).
- **Import semantics (corrected by runtime review):** settings.json IS exported (not in `_EXPORT_EXCLUDED_FILES` ~L1013-1020) and import never touches its content (only blind UUID rewrite via `_IMPORT_UUID_REWRITE_FILES` ~L1068) — so `created_by_email` travels verbatim and would misattribute imports. Fix requires a NEW load→clear→save step in `import_experiment()` (~L1142-1313); and because the route runs import in a worker thread with no session context (`backend/app.py` ~L1121), the reset target is **`None`** (the importing user's email is not reachable there — do not claim otherwise). Add an explicit test: exported-then-imported experiment has `created_by_email = null`.

### 3. Cleanup rider (small, same files)
- `backend/app.py` defines **four** routes twice (runtime review widened the set): `/api/public-config` (~L697 live / ~L823 dead), `/api/auth/login` (~L709 live / ~L830 dead), `/healthz` (~L690 / ~L816), `/api/auth/logout` (~L729 / ~L851). FastAPI serves the FIRST registered match, so the later block is dead code — and must be the pair REMOVED for all four. Do not keep the later pair: the later `/api/public-config` calls `auth.public_config()`, which does not exist (instant 500 breaking `frontend/login.js` + `frontend/app.js`), and the later `/api/auth/login` has a different error contract (`HTTPException` vs the JSON `{"error": ...}` bodies that `frontend/login.js:111` reads). (Verified safe: after removal the module-level names rebind to the surviving first defs; nothing references the bare symbols.)
- Add a route-table regression test asserting each **(method, path)** pair is defined exactly once (keying on path alone would false-positive legitimately multi-method paths) AND that the surviving handlers' behavior is the current live one (e.g. login error responses are JSON `{"error": "invalid_token"}`-style).

## Out of scope
- Making login required (owner decision deferred; default-owner fallback covers it).
- Any per-user data *filtering* inside the notebook UI (notebook remains single-pile locally).
- Hub-side email→user resolution (a71-15).
- Backfilling `created_by_email` on existing experiments.

## Contract change (shared with a71-15)
```json
POST {hub}/api/sync/experiments
{
  "source": "notebook",
  "eln_experiment_id": "NOTEBOOK-20260707-0001",
  "created_by_email": "martin.priessner@scisymbio.ai",   // NEW, nullable
  "fields": { "name": "...", "title": "...", "status": "draft" }
}
```

## Acceptance criteria
1. With `AUTH_ENABLED=1` and a logged-in session, creating an experiment stores `created_by_email` and the outgoing hub payload carries it (assert via unit test on the payload builder + an integration test with a mock hub).
2. With auth off (default) or no session, `created_by_email` is `null` in storage and payload; creation still succeeds.
3. A hub 422 response DLQs without breaking experiment creation (extend existing DLQ tests).
4. `/api/public-config` and `/api/auth/login` are each defined exactly once; existing auth tests still pass.
5. Full backend test suite green on the branch (`python -m pytest backend/tests` or repo-standard runner). NOTE: concurrent pytest suites in this repo collide on Jupyter children — run serially.

## Verification
- Unit + integration tests above.
- Manual: start backend with auth on, log in via Google, create an experiment, inspect the persisted settings JSON and the captured mock-hub request body.

## Risks / review focus
- `sync_client.py` no-op guard (`if not cfg.hub_url or not cfg.hub_auth_key: return`) must keep short-circuiting BEFORE any session lookup so unconfigured deployments stay zero-cost.
- Session email extraction must not blow up on expired/garbage JWTs — reuse `auth.py`'s existing decode path with its exception handling.
- The duplicate-route removal must not change which handler actually serves the route today (FastAPI uses the FIRST registered match — verify which one is live before deleting).
- Do not touch `.env` files programmatically (owner rule: surgical manual edits only).


## Reviewer Feedback / Codex (round 1)

Critical issues:

- Duplicate route cleanup can break login/config if it keeps the “later” handlers. FastAPI uses the first registered matching route here, so the live handlers are [backend/app.py:697](/Users/mpriessner/.claude/jobs/33e3e440/tmp/nb-a71-02/backend/app.py:697) and [backend/app.py:709](/Users/mpriessner/.claude/jobs/33e3e440/tmp/nb-a71-02/backend/app.py:709), not the later duplicates. The later `/api/public-config` calls `auth.public_config()` at [backend/app.py:827](/Users/mpriessner/.claude/jobs/33e3e440/tmp/nb-a71-02/backend/app.py:827), but `backend/auth.py` currently has no `public_config` function. Removing the first handler and keeping the later one would turn `/api/public-config` into a 500 and break `frontend/login.js` and `frontend/app.js`.

- The two `/api/auth/login` handlers have different error contracts. The currently-live first handler returns JSON bodies `{"error": "invalid_token"}` and `{"error": "email_not_allowed"}` at [backend/app.py:720](/Users/mpriessner/.claude/jobs/33e3e440/tmp/nb-a71-02/backend/app.py:720) and [backend/app.py:723](/Users/mpriessner/.claude/jobs/33e3e440/tmp/nb-a71-02/backend/app.py:723). The later handler raises `HTTPException` with `"invalid token"` / `"email not allowed"` at [backend/app.py:840](/Users/mpriessner/.claude/jobs/33e3e440/tmp/nb-a71-02/backend/app.py:840). `frontend/login.js` reads `error` from the JSON body at line 111, so keeping the later handler may alter displayed auth errors.

- Persisting `created_by_email` in `settings.json` can be silently lost or exposed incorrectly unless both settings implementations are handled. There are two settings paths: `ExperimentStore.read_settings/write_settings` uses `backend.schemas.ExperimentSettings` with `extra="allow"` at [backend/schemas.py:239](/Users/mpriessner/.claude/jobs/33e3e440/tmp/nb-a71-02/backend/schemas.py:239), while Android/workspace ingest uses `backend/experiment_settings.py` and preserves unknown keys through `extras` at [backend/experiment_settings.py:53](/Users/mpriessner/.claude/jobs/33e3e440/tmp/nb-a71-02/backend/experiment_settings.py:53). Any implementation that writes raw settings without preserving extras will regress ingest token persistence, settings toggles, or operator-name persistence.

- Persisting `created_by_email` only in `settings.json` will not naturally travel through existing lifecycle update paths. Rename/update dispatch reads only notebook metadata for `eln_experiment_id` at [backend/app.py:3451](/Users/mpriessner/.claude/jobs/33e3e440/tmp/nb-a71-02/backend/app.py:3451) and calls `sync_client.send_update(eln_id, {"title": name}, ...)` at [backend/app.py:3522](/Users/mpriessner/.claude/jobs/33e3e440/tmp/nb-a71-02/backend/app.py:3522). The story says `send_update` should include creator “if the experiment has a stored creator”, but `send_update` has no experiment id or store access. Without changing the call site, update payloads cannot include the stored creator.

- If `created_by_email` is stored in notebook metadata instead, import/export semantics can silently misattribute ownership. `import_experiment()` copies notebook metadata wholesale, then rewrites only `experiment_id` and `name` at [backend/experiments.py:1235](/Users/mpriessner/.claude/jobs/33e3e440/tmp/nb-a71-02/backend/experiments.py:1235). An imported experiment could retain the original creator’s email instead of the logged-in importer or `None`.

- Adding a required `created_by_email` argument to `ExperimentStore.create_experiment()` would break a large existing surface. Many tests and backend call sites call it directly with no identity context, e.g. [tests/test_experiments.py:35](/Users/mpriessner/.claude/jobs/33e3e440/tmp/nb-a71-02/tests/test_experiments.py:35), [tests/test_a71_01_sync_mesh.py:63](/Users/mpriessner/.claude/jobs/33e3e440/tmp/nb-a71-02/tests/test_a71_01_sync_mesh.py:63), and many tool/unit tests. The new parameter must be optional keyword-only if added there.

- Extending `send_content_update` with a required identity parameter will break existing tests and callers. Direct tests call it without identity at [tests/test_a71_01_sync_mesh.py:259](/Users/mpriessner/.claude/jobs/33e3e440/tmp/nb-a71-02/tests/test_a71_01_sync_mesh.py:259), and `_schedule_wiki_content_push()` schedules it with fixed kwargs at [backend/app.py:908](/Users/mpriessner/.claude/jobs/33e3e440/tmp/nb-a71-02/backend/app.py:908). Any new `created_by_email` parameter must default to `None`, and the scheduling path must know where to read it.

- The plan’s “no-op guard before any session lookup” invariant conflicts with “capture creator on experiment creation” if interpreted literally in `app.py`. The route must resolve/persist creator before sync config is checked. The guard can only apply inside `sync_client` so unconfigured sync dispatch stays a no-op before building outbound payloads or doing extra sync-specific work.

Nice-to-have:

- Add a small auth helper in `backend/auth.py` rather than decoding cookies ad hoc in `app.py`. Existing helpers already have safe JWT failure behavior via `verify_session()` at [backend/auth.py:207](/Users/mpriessner/.claude/jobs/33e3e440/tmp/nb-a71-02/backend/auth.py:207); a `get_session_email(request)` wrapper should validate `sub` is a non-empty string.

- Decide whether `created_by_email` becomes part of `ExperimentSummary`. Current response schema is [backend/schemas.py:177](/Users/mpriessner/.claude/jobs/33e3e440/tmp/nb-a71-02/backend/schemas.py:177). Keeping it out preserves public API shape; adding it is additive but should be intentional and tested.

- Add route-table regression tests for exactly one `/api/public-config` and `/api/auth/login`, but assert the surviving handler’s behavior too. Count-only tests could still pass while keeping the broken later `public_config`.

- Add tests for all three identity cases: auth off, auth on with valid cookie, auth on with garbage/expired cookie. The last one matters because `AuthGateMiddleware` normally blocks protected routes, but helper behavior should still be non-throwing.

- Include DLQ assertion for a 422 specifically. Existing DLQ tests cover connection errors and 500-ish failures in [tests/test_a71_01_sync_mesh.py:204](/Users/mpriessner/.claude/jobs/33e3e440/tmp/nb-a71-02/tests/test_a71_01_sync_mesh.py:204), but not 422.

## Revision History
- 2026-07-07 — Initial draft (Agent 70)
- 2026-07-07 — Round-1 revision after Codex: duplicate-route cleanup direction REVERSED (FastAPI serves first match — remove the later dead pair at ~L827/~L840, one of which calls nonexistent auth.public_config); dual settings write-path preservation + round-trip tests; optional-keyword-only params on create_experiment/send_create/send_content_update; dropped creator-on-update requirement (call site has no store access; a71-15 ignores it anyway); import_experiment must reset created_by_email; get_session_email helper wraps verify_session; 422→DLQ test; route-table behavior-asserting test; created_by_email kept out of ExperimentSummary.

## Reviewer Feedback / GLM (round 2) — FALLBACK: Claude Opus
*GLM returned 429 "Weekly/Monthly Limit Exhausted" (resets 2026-07-08 23:38); lens covered by a Claude Opus subagent per the /story fallback rule. Reviewer verified all round-1 anchors hold (verify_session shape, duplicate routes, call sites), then found:*
1. **[HIGH]** `create_experiment()` writes NO settings file today; `read_settings` docstring guarantees omitted fields adopt current defaults (`backend/experiments.py:633-636`). A creation-time `write_settings()` uses `model_dump_json()` (L661) which emits every field — freezing today's `auto_version_on_edit`/`auto_version_on_run`/`voice_auto_apply` defaults into every new experiment. Must write only the identity key.
2. **[MEDIUM]** Import never rewrites settings content (settings.json only in `_IMPORT_UUID_REWRITE_FILES` L1068; IS exported per L1013-1020) — the reset requires a NEW load→clear→save step; and the route imports in a worker thread with no session context (`app.py:1121`), so only `None` is a reachable reset target. No AC covered the import reset.
3. **[LOW]** Payload dict is built in shared `_send_lifecycle_event()` (`sync_client.py:217-223`) used by all five lifecycle actions — adding the field there leaks it into update/delete/restore payloads, violating the story's own invariant. Thread create-only.
4. **[LOW]** `/healthz` (L690/L816) and `/api/auth/logout` (L729/L851) are ALSO duplicated; route-table test must key on (method, path). Verified safe: post-removal name rebinding is correct; no bare-symbol references.
- 2026-07-07 — Round-2 revision after Opus fallback: minimal-write requirement on creation-time settings (only the identity key + test); import reset corrected to None-only with explicit new import step + export/import test; created_by_email threaded create-only past the shared lifecycle builder; duplicate cleanup widened to all four dead routes with (method,path)-keyed test. **Status: Reviewed — ready for implementation.**
