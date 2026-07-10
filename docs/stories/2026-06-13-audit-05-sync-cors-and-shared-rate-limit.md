# Story: Tighten sync-endpoint CORS + replace the per-process, mock-shared rate limiter

**ID:** 2026-06-13-audit-05-sync-cors-and-shared-rate-limit
**Status:** Reviewed — awaiting approval
**Audit findings covered:** S6, S8
**Phase / Priority:** Phase 1–2 (CORS is item #16-adjacent hardening; rate-limiter is data-integrity/reliability)
**Depends on:** Story 01 (rate-limit keying improves once the mock principal is gone) — recommended after, not a hard blocker

## Goal
Two related hardening fixes on the agent/sync surface:
- **S6:** the data-mutating sync endpoints stop returning `Access-Control-Allow-Origin: *` on real responses; they echo a specific allowlisted origin instead, so a logged-in operator's browser visiting a random site can't read sync responses cross-origin.
- **S8:** the agent rate limiter stops being per-process in-memory and stops collapsing all mock-auth callers into one shared bucket; it keys on the real principal and uses a store that is correct under multiple instances (or, minimally, removes the foot-guns and documents the single-instance assumption).

## Context
**Broken state (confirmed against source 2026-06-13):**

1. **S6 — wildcard CORS on mutating sync endpoints:**
   - `src/app/api/sync/reconcile/route.ts:134` — the POST success response sets `headers: { "Access-Control-Allow-Origin": "*" }`. (The OPTIONS preflight `:36` also `*`, and allows `Authorization`.) This endpoint triggers reconciliation that can create/archive/purge experiments and returns the change set.
   - `src/app/api/sync/experiments/route.ts:61-65` (OPTIONS) and `:130` (POST response) — `*` likewise. This endpoint mutates KB state (create/archive/restore/update/purge pages) and returns status bodies.
   - Auth here is a shared `SYNC_SERVICE_KEY` bearer (`authenticateSync`, reconcile `:11-19`, experiments `:30-41`), not a cookie — so classic CSRF impact is limited, but `*` leaks responses to any origin and broadens the surface. (NB: the reconcile **GET** real response at `:59` does **not** set a wildcard — only OPTIONS + POST do. Accurate to the finding.)

2. **S8 — in-memory, multi-instance-broken, mock-shared rate limiter:**
   - `src/lib/agent/ratelimit.ts:9-10` — `const requestWindows = new Map<string, number[]>()` (per-process). `:1-3` the file's own TODO: "Replace with Redis-backed implementation for production (multi-instance)."
   - `src/lib/agent/ratelimit.ts:13-23` — a module-load `setInterval(..., 5*60*1000)` pruning loop runs per worker (leaks in serverless/edge; never cleared).
   - `src/lib/agent/auth.ts:77` — `const rateLimitKey = ctx.apiKeyId || ctx.userId`. Every mock-auth caller shares `userId: "mock-user-id"` (the S1 mock), so they all share one bucket; with N replicas the 100/min limit effectively becomes N×100, or a shared bucket becomes a DoS lever against legit Gateway traffic.

**Why it matters / failure scenario:** (S6) any website a logged-in operator opens can `fetch('http://<host>:3000/api/sync/experiments', …)` and, if it has the key, read the response from any origin. (S8) behind two replicas the rate limit doubles; or an attacker on the (now-being-closed) mock path floods the single `mock-user-id` bucket and rate-limits the real Gateway.

**Affected files:** `src/app/api/sync/reconcile/route.ts`, `src/app/api/sync/experiments/route.ts`, `src/lib/agent/ratelimit.ts`, `src/lib/agent/auth.ts:77`. There is also a `TokenBucketRateLimiter` (`src/lib/.../rateLimiter.ts`, graph community 67) — confirm whether it's a newer abstraction to reuse before adding a third limiter (see step 4).

## Acceptance Criteria
- [ ] `POST /api/sync/reconcile` and `POST /api/sync/experiments` real responses set `Access-Control-Allow-Origin` to a **specific allowlisted origin** (from an env allowlist, e.g. `SYNC_ALLOWED_ORIGINS` — the ExpTube/Gateway/ChemELN host), echoing the request's `Origin` only if it is on the list; otherwise omit the header (or echo nothing). No real response returns `*`. S6 no longer reproduces.
- [ ] The OPTIONS preflights for both routes likewise echo an allowlisted origin (and continue to allow the headers the legitimate caller needs). A non-allowlisted origin's preflight does not receive `Access-Control-Allow-Origin: *`.
- [ ] Same-origin / server-to-server callers (no `Origin` header, e.g. the Gateway/cron) continue to work — CORS only governs browser cross-origin reads, so a missing `Origin` is unaffected.
- [ ] The agent rate limiter no longer collapses distinct callers into one bucket: after Story 01 removes the mock, keys are real `apiKeyId`/`userId`; this story ensures the key is a real principal and adds a defensive guard so an empty/synthetic principal is not silently shared.
- [ ] The module-load `setInterval` in `ratelimit.ts` is removed in favor of lazy pruning on access (no per-worker leaking timer). 
- [ ] Either: (a) the limiter is backed by a shared store (Postgres table or Redis) keyed by principal so the limit holds across instances; **or** (b) if a shared store is deferred, the code documents the single-instance assumption explicitly and the deployment is single-instance (confirm with ops). Pick based on the user-input below.
- [ ] Tests: CORS responses assert the echoed origin for allowlisted vs non-allowlisted; rate-limit tests assert per-principal buckets and lazy pruning. `npm test` green.

## Implementation Plan
1. **CORS helper — must be ROUTE/METHOD-AWARE (live Codex MUST-FIX).** Add `src/lib/security/cors.ts` exporting `resolveCorsOrigin(req): string | null` that reads `SYNC_ALLOWED_ORIGINS` (comma-separated), returns the request `Origin` iff it's listed, else `null`. For the `Access-Control-Allow-*` set, **do NOT hardcode one method/header list** — the two routes differ: `reconcile` OPTIONS allows **`GET, POST, OPTIONS`** (`:37`) while `experiments` OPTIONS allows **`POST, OPTIONS`** (`:62`). A single flat `corsHeaders(req)` would silently widen `experiments` to allow `GET` or narrow `reconcile`. So `corsHeaders(req, { methods })` must take the **per-route** allowed methods (and any per-route headers), or each route passes its own method string. Verification: unit tests for listed/unlisted/no-Origin AND that each route's `Allow-Methods` is unchanged from today.
2. **Apply to sync routes.** In `reconcile/route.ts` (OPTIONS `:32-42`, POST response `:132-136`) and `experiments/route.ts` (OPTIONS `:57-67`, POST response `:127-133`), replace the literal `"Access-Control-Allow-Origin": "*"` with `...corsHeaders(req)` (thread `req` into the response builders; OPTIONS currently takes no arg — change signature to `OPTIONS(req: NextRequest)`). When `resolveCorsOrigin` returns null, omit the ACAO header. Verification: integration test with `Origin` header set to allowlisted vs random.
3. **Rate-limiter foot-gun removal (`ratelimit.ts`).** Remove the module-load `setInterval` (`:13-23`); instead prune the per-key array lazily inside `checkRateLimit` (it already filters by window at `:39` — just also `delete` empty keys opportunistically, or cap map size). Verification: existing behavior preserved without the timer; a test that the timer is not registered at import.
4. **Shared store vs documented single-instance.**
   - **(Corrected per Gemini) Do NOT converge with `TokenBucketRateLimiter`.** The `TokenBucketRateLimiter` in `src/lib/chemEln/sync/rateLimiter.ts` (and `src/lib/summary/rateLimiter.ts`) is a **blocking outgoing-request pacer** (`async acquire()` that *awaits* until a slot is free) used to throttle SKB's calls *to* ChemELN/LLMs. `withAgentAuth` needs a **non-blocking** check that immediately returns `{allowed, remaining, resetAt}` so it can emit a 429 with `X-RateLimit-*` headers (`auth.ts:81-96`). These are fundamentally different contracts — converging would break the agent middleware. Keep `src/lib/agent/ratelimit.ts` as its own non-blocking limiter; just harden it.
   - If implementing a shared store: add a Postgres-backed window (a small `rate_limit_hits` table keyed by `(principal, window_start)` with an upsert+count, or `INCR` in Redis if Redis is available). Key strictly on the real principal (`ctx.apiKeyId ?? ctx.userId`), and after Story 01 there is no synthetic shared id. Preserve the non-blocking `{allowed, remaining, resetAt}` return shape.
   - If deferring: add a clear comment + README note that rate limiting is per-instance and the deployment must be single-instance; keep the in-memory map but with lazy pruning.
   - Verification: per-principal isolation test; if Postgres-backed, a test that two "instances" (two limiter constructions sharing the DB) see the same count.
5. **Principal-key guard (`auth.ts:77`).** Keep `ctx.apiKeyId || ctx.userId` but assert it is non-empty; with the mock removed (Story 01) this is always a real id. Verification: covered by Story 01's auth tests + a limiter test.

## Risks & Open Questions
- `NEEDS USER INPUT:` Is the SKB deployment single-instance or horizontally scaled? If single-instance, the in-memory limiter with lazy pruning is acceptable and a shared store is over-engineering; if scaled (or serverless), a shared store is required and Redis availability must be confirmed. Assumption: **single-instance** (Docker `restart: unless-stopped`, one `app` service in compose) → remove the timer + document the assumption, defer the shared store unless Redis is already present.
- Tightening CORS could break a legitimate browser-based admin tool that calls the sync API cross-origin. Mitigation: the allowlist is env-driven; add the real operator origin. Confirm whether any browser UI (vs only server-to-server cron/Gateway) calls these endpoints. Assumption: sync is server-to-server (ChemELN/ExpTube/Gateway), which sends no `Origin` and is unaffected.
- The reconcile **GET** already lacks a wildcard; don't introduce one. Only touch OPTIONS + the POST responses. (live Codex confirmed: reconcile `GET:47` returns at `:59` with no ACAO; `experiments` has **no** GET handler at all.)
- **(live Codex) Today only POST *success* responses carry CORS; the auth/validation/internal-error responses (401/400/500) carry none.** For the confirmed server-to-server callers (no `Origin`) this is irrelevant. But the story must NOT imply "all legitimate browser responses stay readable" — a hypothetical allowlisted **browser** caller would pass preflight yet be unable to read error-response bodies cross-origin. Since sync is server-to-server (Gemini + Codex both confirm no `src/` browser fetch caller — only docs `AGENT-PROMPT-EXPTUBE.md:41` + curl examples), the decision is: apply CORS to the POST **success** responses only (matching today's surface) and document that error responses are intentionally same-origin-readable-only. If a browser admin tool is ever added, error-path CORS becomes a separate follow-up.
- Removing the `setInterval` must not change the windowing semantics; the lazy prune must still expire entries older than `WINDOW_MS`.

## Out of Scope
- The mock-auth removal that creates the shared-principal problem (Story 01 — this story depends on it for the key to be meaningful).
- Auth on the sync endpoints (already gated by `SYNC_SERVICE_KEY`; not a finding).
- Audit logging of rate-limit/auth events (Story 06).

## Reviewer Feedback

### Reviewer Feedback / Codex (regression) — FALLBACK: self (Opus 4.8); reason: Codex CLI hit its usage limit. **[Superseded by live Codex below — 2026-06-13]**
Regression review (full depth against actual files):
1. **OPTIONS handlers take no `req` argument today** (`reconcile/route.ts:32` `OPTIONS()`, `experiments/route.ts:57` `OPTIONS()`). Threading the request in to echo an allowlisted origin requires changing their signatures to `OPTIONS(req: NextRequest)` — Next.js passes the request to route handlers, so this is safe, but it is a signature change to verify compiles. Folded into step 2.
2. **The reconcile GET (`:47`) and its real response (`:59`) have no wildcard** — don't add CORS there; only OPTIONS + POST set `*` today. The plan correctly scopes to those. Confirmed.
3. **`X-RateLimit-Limit` is hardcoded to `"100"` in headers (`auth.ts:89,128`) and `RATE_LIMIT=100` in ratelimit.ts** — if a shared store changes the effective limit, keep these in sync or they'll misreport. Minor; folded as a note.
4. **Removing the `setInterval` is safe** — `checkRateLimit` already filters the active key's window (`ratelimit.ts:39`); the interval only GC'd inactive keys. Opportunistic delete-on-empty preserves correctness. No test exercises the timer (none exist for this module). Confirmed.
No regression beyond the OPTIONS signature change (item 1), now explicit.

### Reviewer Feedback / Gemini (integration) — live (gemini-3.1-pro-preview, plan mode; after quota retries) — Integration breakage: None found
- **CORS:** the two sync endpoints are called **exclusively server-to-server** by the ExpTube backend / CLI / cron (per `docs/cross-platform/AGENT-PROMPT-EXPTUBE.md`); no browser UI calls them. Server-to-server callers send no `Origin`, so replacing `*` with an allowlisted-origin echo (or omitting when no `Origin`) does not break them. Verified both routes only `*` on POST + OPTIONS; GET reconcile already lacks it.
- **Rate limiter — do NOT converge:** `TokenBucketRateLimiter` (`src/lib/chemEln/sync/rateLimiter.ts`, `src/lib/summary/rateLimiter.ts`) is a **blocking** `async acquire()` pacer for *outgoing* requests; converging would break `withAgentAuth`, which needs a **non-blocking** check returning 429 + `{remaining, resetAt}`. Keep `ratelimit.ts` distinct but improved. **(This corrected the plan's step 4.)**
- **`setInterval` removal:** lazy pruning at `ratelimit.ts:39` already covers the active key; the interval only GC'd inactive keys. No windowing change; no existing tests exercise it.
- **Principal keying:** `auth.ts:77-79` collapses all non-API-key callers into one `mock-user-id` bucket today; real-principal keying (post-Story 01) is required for isolation and doesn't break API-key flows.

**Disposition:** "None found" — the only plan change was correcting step 4 to NOT converge with the blocking TokenBucketRateLimiter. All other points confirm the plan. Server-to-server-only confirmation de-risks the CORS change.

### Reviewer Feedback / Kimi (runtime) — FALLBACK: self (Opus 4.8); reason: Kimi CLI returned HTTP 429 usage-limit.
Runtime breakage / missed bugs:
1. **Omitting `Access-Control-Allow-Origin` when `Origin` is not allowlisted is the correct behavior** — the browser then blocks the cross-origin read (no ACAO header = same-origin-only). Do not echo a literal `"null"` (that's a real, exploitable origin value). Folded into step 1's "return null → omit header".
2. **Preflight (`OPTIONS`) and actual-response CORS must agree** — if the preflight allows the origin but the POST response omits it (or vice versa), the browser blocks. Ensure `corsHeaders(req)` is applied to BOTH. Folded.
3. **The in-memory limiter's `resetAt = now + WINDOW_MS` (`ratelimit.ts:48`) is a sliding-ish window**, not a fixed window — under a shared store this semantic must be preserved or clients' `Retry-After` math (`auth.ts:82`) drifts. Folded as a note for the shared-store option.
4. **Edge/serverless runtime caveat:** the file's own TODO about `setInterval` leaking "in serverless/edge" is real — but the agent routes run on Node.js (App Router default) with a long-lived process, so the in-memory map persists across requests as intended. If any agent route is ever moved to edge, the in-memory limiter resets per invocation (no rate limiting at all). Note added: pin agent routes to `nodejs` runtime if not already.
5. **No race in `checkRateLimit`** itself (single-threaded JS event loop; the read-filter-push is atomic within a tick). The multi-instance gap is the real correctness issue, addressed by the shared-store option. Confirmed.
No runtime crash introduced; the CORS "null origin" foot-gun (item 1) and preflight/response agreement (item 2) are the two things to get right.

### Reviewer Feedback / Codex (LIVE re-review 2026-06-13) — codex-cli 0.128.0, `codex exec -s read-only`, full repo read — no blocking Critical issues
The earlier Codex note above was a self-fallback (quota). This is the live pass; it supersedes it. **Codex confirmed every cited line number and validated the plan** (all wildcard sites `reconcile:36,134`/`experiments:61,130`, the limiter `Map`/`setInterval` at `ratelimit.ts:10,13`, the keying site `auth.ts:77`, and that the ChemELN `TokenBucketRateLimiter.acquire():14` blocks while `withAgentAuth:81` needs immediate allow/deny — "the story correctly preserves this distinction"). It returned **2 Critical refinements** (both folded) + one new observation:
1. **CORS helper must be route/method-aware** — `reconcile` allows `GET, POST, OPTIONS` (`:37`), `experiments` allows `POST, OPTIONS` (`:62`); a single flat `corsHeaders()` would silently widen/narrow preflight. **Folded** into step 1 (pass per-route methods). *(Verified.)*
2. **Preserve the non-blocking `{allowed, remaining, resetAt}` contract + the hardcoded `100` header consistency** (`auth.ts:90`) — **already** in the plan/AC; reinforced.
3. **(New) Error responses (401/400/500) carry no CORS today — only POST success does.** Irrelevant for the confirmed server-to-server callers, but the story must not imply browser error responses stay readable. **Folded** into Risks (apply CORS to POST success only; document error responses as same-origin-readable-only; browser-tool support = future follow-up).
**Confirmations that de-risk the story:** `GET /api/sync/reconcile` returns CORS-free (`:59`) and `experiments` has no GET handler — don't spread CORS there; `OPTIONS(req)` signature change is safe for App Router (only direct no-arg unit-test calls would break, and none exist); the limiter is genuinely per-process and mock-auth collapses buckets until Story 01; **no `src/` browser fetch caller** to these endpoints (only docs `AGENT-PROMPT-EXPTUBE.md:41` + curl examples) — confirms the server-to-server premise.
**Nice-to-have (folded into the existing test ACs):** route tests for allowlisted/disallowed/no-Origin OPTIONS+POST incl. reconcile-GET-stays-CORS-free; `ratelimit.ts` tests for per-principal buckets, lazy pruning, and no import-time timer. Codex confirmed **no existing route tests** for either sync route or `ratelimit.ts` (`chemEln/sync/rateLimiter.test.ts` covers a *different* limiter) — so these are net-new.

## Revision History
- 2026-06-13 — Initial draft
- 2026-06-13 — Reviewed (Gemini live, "None found"; Codex + Kimi self-fallback due to usage-limit/429). Corrected step 4 to **keep `ratelimit.ts` distinct from the blocking `TokenBucketRateLimiter`** (different contract — non-blocking check vs blocking acquire). Folded: OPTIONS signature change to thread `req`, omit-ACAO-on-disallowed-origin (never echo literal "null"), preflight/response CORS agreement, pin agent routes to nodejs runtime so the in-memory limiter persists. Confirmed sync endpoints are server-to-server-only (CORS change is safe). Status → Reviewed — awaiting approval.
- 2026-06-13 — **LIVE Codex re-review** (codex-cli 0.128.0; quota reset). Prior Codex note marked Superseded. **No blocking Critical issues — Codex validated the whole plan and every cited line.** Folded 2 refinements + 1 new note: CORS helper must be route/method-aware (`reconcile` GET,POST,OPTIONS vs `experiments` POST,OPTIONS) → step 1 passes per-route methods; error-path responses carry no CORS (apply to POST success only; document same-origin-only errors) → Risks. Confirmations folded: reconcile-GET-stays-CORS-free, no experiments GET handler, `OPTIONS(req)` safe for App Router, no `src/` browser caller, no existing route/limiter tests (net-new). Status stays Reviewed — awaiting approval.
