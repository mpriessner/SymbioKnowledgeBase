# [Tier 2] Route tests for the agent-facing KB query surface

## Provenance & ownership
- **Project owner:** Martin Priessner (martin.priessner@scisymbio.ai)
- **Created by:** Agent 68 (session 68_Agent_Test) — cross-stack test-coverage audit
- **Created:** 2026-07-04
- **Status:** ready — reviewed (Codex + GLM, Gemini skipped per owner pref, 2026-07-04)
- **Assigned to / currently owned by:** unassigned (owner will implement)
- **Related / parallel work:** Cross-stack audit report `~/windsurf_repos/diligence-reports/test-coverage-audit-2026-07-03-agent68.md`. The SKB hardening epic (memory: EPIC-53/54 KB-search, all merged) covered the search libs — the ROUTE layer is what's still dark.

## Problem / context

The endpoints the voice agents (SciSymbioLens-Android + voice-companion-vision)
actually call are the least-tested part of an otherwise well-tested repo:

- `api/agent/kb-query/route.ts` — THE voice-agent query endpoint. `withAgentAuth` (wrapper) is tested; the handler's query behavior, result shape, and error paths are not, beyond one broad `api/agent/e2e-workflow.test.ts`.
- `api/agent/search/route.ts` (212 lines) — the other agent read path. No focused test.
- `agent/pages/*` mutation routes (promote, extract-knowledge, capture-learning, conflicts, refresh-aggregation, experiment-context/bulk) — underlying `chemistryKb` libs well-tested; route wiring/validation is not.

A result-shape change here silently breaks voice KB answers on the phone —
there is no cross-repo test to catch it (Tier 4 story depends on the fixtures
this story creates).

## Exact target files (verified 2026-07-04)

Use full `src/app/...` paths — the bare `api/agent/...` shorthand below is
imprecise. Handlers to test:

- `src/app/api/agent/kb-query/route.ts` — `POST` only. `withAgentAuth`.
- `src/app/api/agent/search/route.ts` — `GET` only. `withAgentAuth`. **Two
  response branches** (see below).
- Mutation / write routes under `src/app/api/agent/pages/`:
  - `promote/route.ts` — `POST`, `withAgentAuth`.
  - `capture-learning/route.ts` — `POST`, `withAgentAuth`.
  - `refresh-aggregation/route.ts` — `POST`, `withAgentAuth`.
  - `conflicts/route.ts` — **both `GET` and `POST`**, `withAgentAuth`.
  - `experiment-context/bulk/route.ts` — `POST`, `withAgentAuth`.
  - `extract-knowledge/route.ts` — **uses `withTenant` (session auth), NOT
    `withAgentAuth`** (`src/lib/auth/withTenant.ts`). Do not assert
    API-key/scope behavior on this one; either test it under its real auth
    wrapper or drop it from scope. `experiment-context/route.ts` (non-bulk) is
    a **read (`GET`)**, not a mutation — exclude it from the "mutation routes"
    bucket.

## Auth reality (corrects the old Non-goals note)

The agent surface is **API-key-only** (`withAgentAuth` in
`src/lib/agent/auth.ts` → `resolveApiKey` in `src/lib/apiAuth.ts`), NOT Supabase
sessions. The Bearer token must be a valid, non-revoked `skb_` key; there is no
mock/default-tenant fallback. **Scopes are enforced per HTTP method**: `GET`
needs `read`, `POST/PUT/PATCH/DELETE` need `write`. Consequences for tests:

- A test cannot pass "any bearer token". It must either (a) create a real
  scoped API key + tenant via Prisma fixtures against the CI Postgres, or
  (b) mock `resolveApiKey` (and `checkRateLimit`) so the handler receives a
  known `AgentContext { tenantId, userId, scopes }`. Pick **one** approach and
  state it in the test file header; option (b) is lighter and CI-safe.
- Auth cases to cover at the wrapper boundary: missing `Authorization` → 401;
  malformed key / `resolveApiKey` → null → 401; `GET` with a `write`-only key
  (or `POST` with `read`-only) → 403 scope error.

## Response envelopes (heterogeneous — do NOT assume one shape)

- **`kb-query`** builds responses by hand, NOT via `apiResponse` helpers:
  success is `{ success: true, data: <KbQueryResult> }`; its own 400/500 paths
  are `{ success: false, error: "<string>", data: <fallback> }`. The 401/403
  come from `withAgentAuth` and therefore use the *other* envelope
  (`errorResponse`). `KbQueryResult` = `answer`, `context_blocks[]`, optional
  `formatted_context` / `context_truncated`, and `query_metadata`
  (`intent`, `search_depth`, `search_strategy`, `pages_searched`, `graph_hops`,
  `elapsed_ms`).
- **`search` + all `pages/*` routes** use `src/lib/apiResponse.ts`:
  `successResponse` → `{ data, meta: { timestamp, ... } }`; `listResponse` →
  `{ data, meta: { total, limit, offset, timestamp } }`; `errorResponse` →
  `{ error: { code, message, details? }, meta: { timestamp } }`.
- **Both** envelopes inject a non-deterministic `meta.timestamp`; `kb-query`
  additionally carries `query_metadata.elapsed_ms`. **Full-object snapshots are
  not viable.** Normalize/strip `timestamp` + `elapsed_ms` (and any generated
  ids) before snapshotting, or use field-level `expect` assertions on the
  stable voice-client fields.

## `search` has two branches (test both)

`GET /api/agent/search` (`src/app/api/agent/search/route.ts`):
- **With `depth`**: `successResponse(depthSearchResult)` → `data` has `results`,
  `totalCount`, `depth`, `scope`, `searchTimeMs`. **No pagination.**
- **Without `depth` (legacy)**: paginated list of `{ page_id, title, icon,
  oneLiner, path, matchContext, score }`. Pagination / limit-bounds tests apply
  **only** to this branch — do not assert pagination on the depth branch.

## Test harness constraints (CI is in-process, no running server)

`.github/workflows/ci.yml` provisions Postgres 18, runs `prisma migrate
deploy`, then `npx vitest run`. **It does NOT start Next.js.** So:

- New tests **must invoke the exported route handler in-process** — import
  `POST`/`GET` from the route module and call it with a constructed
  `NextRequest` — NOT `fetch("http://localhost:3000/...")`.
- Do **not** copy the pattern in `tests/api/apiKeys.test.ts` /
  `tests/api/tenantIsolation.test.ts`: those `describe.skipIf` on `DATABASE_URL`
  AND require a live Next server on `:3000`, so they'd need a server the CI job
  never starts.
- **File placement — avoid a third convention.** The repo already splits route
  tests across `src/__tests__/api/` and `tests/unit/api/` (e.g. `/api/search`
  is duplicated in both). Put the new agent-route tests in **`tests/unit/api/agent/`**
  (mirrors the source tree) and note the chosen location in the story's PR
  description so a reviewer isn't surprised. Reuse the fetch/request helper at
  `src/__tests__/api/agent/helpers.ts` if useful, but note it only wraps request
  construction — there is **no** existing reusable tenant-isolation fixture that
  provisions agent keys + pages; this story must add one (small Prisma seed
  helper) if it goes the real-DB route.

## Scope (revised)

1. **kb-query** (`tests/unit/api/agent/kb-query.route.test.ts`): valid query →
   assert stable `KbQueryResult` fields the voice clients read (answer,
   context_blocks shape, query_metadata keys) with `elapsed_ms` normalized;
   empty-result path; malformed JSON body → 400 `{ success:false, error }`;
   schema-invalid body → 400; auth-missing → 401 (wrapper envelope);
   scope-insufficient → 403. Tenant isolation: a query authed as tenant A must
   not return tenant-B pages (requires the seed helper OR a `resolveApiKey`
   mock returning tenant A + asserting the `tenantId` passed into
   `executeKbQuery`).
2. **search** (`tests/unit/api/agent/search.route.test.ts`): depth-branch shape;
   legacy-branch shape + pagination/limit bounds (legacy only); malformed
   params → typed `errorResponse`; auth 401/403.
3. **pages write routes**: for `promote`, `capture-learning`,
   `refresh-aggregation`, `conflicts` (POST), `experiment-context/bulk` — one
   happy-path + one validation-reject (`VALIDATION_ERROR`, 400) test each at the
   handler level (thin; the `chemistryKb` libs underneath are already covered).
   `extract-knowledge` only if tested under its real `withTenant` wrapper.
4. **Fixtures**: normalized result-shape fixtures under
   `tests/fixtures/agent-routes/` with a header naming both consumers
   (`SciSymbioLens-Android` KB tools + `voice-companion-vision` KB tool) so
   updates are coordinated (feeds the Tier 4 cross-repo fixture story). Fixtures
   store only the stripped/stable fields.

## Acceptance criteria (revised)

1. `kb-query` and `search` each have a dedicated in-process route test file
   covering happy path, empty/edge, malformed-body 4xx, and auth (401 + 403
   scope). `search` covers **both** response branches; pagination assertions
   apply only to the legacy branch.
2. Each in-scope `pages/*` write route (`promote`, `capture-learning`,
   `refresh-aggregation`, `conflicts` POST, `experiment-context/bulk`) has ≥2
   handler-level tests (happy + validation-reject).
3. Voice-client-consumed fields are pinned via field-level assertions or
   **normalized** fixtures (`timestamp` + `elapsed_ms` + generated ids
   stripped); no full-object snapshot of a live response.
4. All green in existing `ci.yml` (blocking vitest gate) with **no workflow
   changes** and **no dependency on a running Next server**.
5. No production changes except minimal export/import adjustments to make
   handlers importable in-process (behavior unchanged).

## Verification

`npx vitest run` green locally (with `DATABASE_URL` set if the real-DB fixture
route is chosen; otherwise green with no DB) and in `ci.yml`. Gate proof: mutate
one stable response field in a scratch branch → the field-level assertion /
normalized fixture fails.

## Risks / coordination

- **In-flight uncommitted work (Agent 70).** The working tree has ~30 modified
  files + many untracked audit/improvement stories, all uncommitted on `main`.
  None touch `src/app/api/agent/**` or `src/lib/agent/**` at time of review, so
  no direct collision — but this story's new test files land into a dirty tree;
  the implementer should coordinate the eventual commit with whoever owns the
  Agent 70 changes rather than committing everything together.
- **Kong port drift.** A parallel session noted Kong may have moved
  `:54341 → :54381`. The agent surface does **not** use Supabase/Kong (it's
  API-key auth), and `ci.yml` uses `:54341` only as a non-secret placeholder for
  env validation, so this story is unaffected — but do not hard-code either port
  in new tests.

## Runtime pitfalls the implementer MUST handle (GLM round 2, verified)

Folded from the GLM runtime review; each is spot-verified against code.

**Auth principal (mock-first strongly preferred):**
- **Scopes default to full access at two layers** — `schema.prisma:297`
  `scopes @default(["read","write"])` AND `apiAuth.ts` `normalizeScopes` returns
  `["read","write"]` for empty/null. A fixture that sets `scopes: []` thinking
  "no access" gets full access, so a 403 test passes vacuously. To build a real
  restricted key you must set an explicit *partial* array (e.g. `["read"]` to
  test POST→403).
- **Scope check reads `req.method`** (`agent/auth.ts`). The existing in-process
  example (`tests/unit/api/search/route.test.ts`) constructs a `NextRequest`
  with **no method** → defaults to GET. For a POST route you MUST pass
  `{ method: "POST" }`, else a write-scope test 403s for the wrong reason and
  asserts nothing.
- **Rate limit is a module singleton** (`agent/ratelimit.ts` in-memory Map,
  100/min, no reset export) and **starts a `setInterval` at import** (never
  cleared → vitest open handle / hang). `checkRateLimit` runs on every non-401
  request. **`vi.mock("@/lib/agent/ratelimit", …)`** is the clean fix — it both
  avoids counter bleed across the suite and stops the interval from starting.
  Do NOT rely on mocking `resolveApiKey` alone.
- **`touchLastUsed` is fire-and-forget** (`apiAuth.ts`, un-awaited Prisma
  update) — only a concern on the real-DB route; another reason to prefer the
  mock.

**Seed / CI DB (if the real-DB route is chosen — mock avoids all of these):**
- **`blocks.search_vector` is populated only by a trigger on `plain_text`**
  (`migrations/20260221000000_add_search_vector`). Blocks created with `content`
  only (the `seed.ts` pattern) get an EMPTY tsvector; the legacy search branch
  is FTS-only with no fallback → `data: []`. Seed helper must set `plainText`.
- **`Page.spaceType` defaults `PRIVATE`, but kb-query + depth search filter
  `scope/spaceType: "TEAM"`** (`searchRouter.ts`, `depthSearch.ts`,
  `kbQuery.ts`). Fixture pages must be created `spaceType: "TEAM"` or results
  are always empty.
- **`User.id` has no `@default`** (`schema.prisma:151`, Supabase-managed) —
  fixture user inserts MUST pass an explicit id or they NOT-NULL-violate.
- **CI runs `migrate deploy` only, no seed** (`ci.yml`). `extractEntity`
  (`kbQuery.ts`) needs category-root pages titled EXACTLY `Experiments`,
  `Chemicals`, `Reaction Types`, `Researchers`, `Substrate Classes` (TEAM) or
  kb-query degrades to plain search and never produces the entity-driven
  `context_blocks` voice clients depend on.

**Snapshot brittleness beyond the earlier list — also strip/avoid:**
- `search` depth branch emits **`searchTimeMs`** inside `data`
  (`depthSearch.ts`) — add to the normalize-strip list.
- **`search_strategy`** (`kbQuery.ts` → `autoSelectStrategy`) flips on query
  word-count (`<8` / `>12`); **`score`/relevance floats** vary with `ts_rank`
  corpus content. Do not pin these to literal values — assert type/presence or
  ranges only.
- **kb-query has a module-singleton LRU cache** (`queryCache.ts`) keyed by a
  stop-word-stripped/sorted-token `normalizeQuery`; two same-tenant tests whose
  queries normalize equal share the cached `context_blocks`. Call
  `invalidateCache()` (or `vi.mock` the cache / `vi.resetModules`) between tests
  — `src/__tests__/setup.ts` does NOT reset modules.

**Green-but-vacuous traps (assertions must be non-trivial):**
- Legacy-search happy path and kb-query happy path both return a valid 200 with
  empty `data: []` / a fixed empty-KB fallback `answer` when the seed is wrong
  (findings above). Assertions MUST require **non-empty** `context_blocks` /
  actual `results` with `score`/`path`/`matchContext`, not just
  `status===200 && Array.isArray(data)` — otherwise AC "voice-client fields
  pinned" is satisfied without exercising them.
- **Real-DB tenant-isolation for kb-query cannot actually construct a catchable
  leak** — every query is `ctx.tenantId`-scoped, so a real-DB isolation test
  passes trivially and asserts nothing. Use the **mock** variant: `resolveApiKey`
  → tenant A, assert `executeKbQuery` received `tenantId: A` (spy on the call),
  which is the only version that can fail if a future edit drops the filter.
- **`src/__tests__/api/agent/helpers.ts` is a live-`fetch` helper** (hits
  `localhost:3000`), NOT request-construction. Do not "reuse" it — it silently
  switches a test to the no-server pattern CI can't run. (Next `middleware.ts`
  forwards `/api/` without auth, so middleware itself doesn't interfere with
  in-process tests; the only interfering middleware is the in-handler
  `checkRateLimit`, mocked above.)

**Net recommendation baked into scope:** default to the **mock-first** approach
(`vi.mock` `resolveApiKey` + `ratelimit`, spy on the domain-lib call for tenant
scoping) for the query/auth/tenant tests; reserve a real-DB seed helper only if a
true end-to-end result-shape fixture is wanted, and if so it must set `plainText`
+ `spaceType:"TEAM"` + explicit `User.id` + the five exact category-root pages.

## Non-goals / guards

- No changes to `chemistryKb` domain libs or the search indexer (already tested).
- Do not touch auth config. (Correction: the agent surface is API-key auth, not
  Supabase — the earlier "auth remains ExpTube Supabase" note was wrong for this
  surface and is superseded by the "Auth reality" section above.)
- No Playwright additions (existing specs stay as-is).
- No `ci.yml` changes and no reliance on a running Next server.

## Revision History

- **2026-07-04 — Codex (round 1), FOLDED.** Codex CLI ran live (exit 0; only a
  benign `WARNING: proceeding, even though we could not create PATH aliases`).
  Reshaped the story to match reality: corrected auth (API-key `withAgentAuth`,
  not Supabase; per-method scopes → added 403 cases), documented the two
  divergent response envelopes (`kb-query` hand-built `{success,error,data}` vs
  `apiResponse` `{data,meta}`), split `search` into depth vs legacy branches
  (pagination legacy-only), replaced full-object snapshots with
  normalized/field-level assertions (`timestamp`/`elapsed_ms` non-deterministic),
  reclassified `pages/*` routes (`experiment-context` is a GET; `conflicts` has
  GET+POST; `extract-knowledge` uses `withTenant`), fixed the CI harness
  assumption (in-process handler calls — CI does not start Next), pinned test
  file placement to `tests/unit/api/agent/` to avoid a third convention, and
  added a note that no reusable agent tenant-isolation fixture exists yet. Added
  Risks section (Agent 70 in-flight tree + Kong port drift).

- **2026-07-04 — GLM (round 2, glm-5.2), FOLDED.** GLM CLI ran live. Added the
  "Runtime pitfalls" section (all 16 findings; scope-default full-access, method
  on NextRequest, ratelimit + queryCache module singletons / open `setInterval`
  handle, search_vector trigger keyed on `plainText`, `spaceType:"TEAM"` filter,
  `User.id` no-default, exact category-root titles, extra non-deterministic
  fields `searchTimeMs`/`search_strategy`/`score`, and the green-but-vacuous
  happy-path + real-DB-isolation-can't-fail traps). Recommendation shifted to a
  **mock-first** default (mock `resolveApiKey` + `ratelimit`, spy for tenant
  scoping). Spot-verified `scopes @default`, the FTS trigger, and the ratelimit
  singleton against source before folding. **Gemini phase skipped** per the
  project owner's standing preference. Status set to reviewed.

## Reviewer Feedback / GLM (round 2)

I've read the story and the surrounding code (`withAgentAuth`/`resolveApiKey`/`ratelimit`/`queryCache`, both target routes + a mutation route, the Prisma schema, the search-vector migration, the existing in-process search test, CI, and `middleware.ts`). Below are the runtime breakage points the Codex round missed. Each quotes the code that contradicts the story's assumptions.

---

### Auth principal — the planned setup does NOT reliably yield a scoped principal

**1. `scopes` defaults to full access at TWO layers, so 403 fixtures can be silently mis-built (and a "restricted" key passes as full-access).** The story says "create a real scoped API key" but never warns that omitting scopes grants everything.
- `prisma/schema.prisma:297` — `scopes String[] @default(["read", "write"])`. A fixture `apiKey.create({ data: { userId, tenantId, keyHash, keyPrefix, name } })` with no `scopes` gets `["read","write"]`.
- `src/lib/apiAuth.ts:32-37` — `normalizeScopes` *also* returns `["read","write"]` when the stored array is empty/null.
- `src/lib/agent/auth.ts:108-125` — the 403 path needs a key whose scopes omit `read` (for GET) or `write` (for POST). A fixture author who sets `scopes: []` thinking "no access" actually gets full access; the 403 test then can't fail, or the happy-path test "passes" against a key that should have been restricted.

**2. The scope check is keyed off `req.method`, but the in-process pattern the story says to mirror never sets the method.** `src/lib/agent/auth.ts:107` `const method = req.method;`. The referenced pattern `tests/unit/api/search/route.test.ts:47` constructs `new NextRequest("http://localhost:3000/api/search?q=content")` with no `method` (fine there, because `withTenant` doesn't check method). Copying that for a `POST` agent route leaves `method === "GET"`, so a write-only key hits the `read`-scope branch and 403s for the *wrong* reason — a 403-on-POST assertion goes green while asserting nothing about the write scope.

**3. `checkRateLimit` runs on every non-401 request and its counter is a module singleton with no reset hook.** `src/lib/agent/auth.ts:84-86` calls it unconditionally; `src/lib/agent/ratelimit.ts:6,10,31-51` is an in-memory sliding window (100/min) keyed by `apiKeyId || userId`, with no exported reset. Tests that mock `resolveApiKey` to a stable `apiKeyId` share one window across the whole suite. The story only mentions mocking `checkRateLimit` as a parenthetical; if the implementer mocks `resolveApiKey` but forgets ratelimit, counts accumulate.

**4. `ratelimit.ts` starts a `setInterval` at import time that vitest won't tear down.** `src/lib/agent/ratelimit.ts:13` — `setInterval(..., 5 * 60 * 1000)` runs at module load (no `clearInterval` anywhere). Importing any agent route starts a 5-minute handle. `src/__tests__/setup.ts:1` is jest-dom only — no `vi.resetModules()`/teardown. The only clean avoidance is `vi.mock("@/lib/agent/ratelimit", …)` so the module body never executes; the story doesn't connect this to the open-handle/hang risk.

**5. `touchLastUsed` is a fire-and-forget Prisma write (real-DB route only).** `src/lib/apiAuth.ts:157-166` — `prisma.apiKey.update(...).catch(...)` is not awaited by `resolveApiKey`. Under the story's option (a) (real scoped keys), every authed test leaks an UPDATE that resolves after the test returns → teardown warnings / flake. Mocking `resolveApiKey` sidesteps it; the story doesn't flag it for the real-DB route.

---

### Postgres-in-CI — the seed the tests assume cannot be built by copying existing patterns

**6. `blocks.search_vector` is populated ONLY by a trigger on `plain_text`; blocks created with `content` only (the `seed.ts` pattern) get an empty tsvector and BOTH search branches return nothing.**
- `prisma/migrations/20260221000000_add_search_vector/migration.sql:11-23` — trigger sets `NEW.search_vector := to_tsvector('english', COALESCE(NEW.plain_text, ''))` BEFORE INSERT/UPDATE-of-`plain_text`.
- `prisma/schema.prisma:245-246` — `plainText` defaults `""`; `searchVector` is `Unsupported("tsvector")?` (Prisma can't write it). So populating it requires setting `plainText` on the block create.
- `prisma/seed.ts:59-87` creates blocks with `content` only — copy-pasting that yields zero searchable text.
- `src/app/api/agent/search/route.ts:156-161` and `:166-172` — the **legacy branch is FTS-only** (`search_vector @@ websearch_to_tsquery`); empty vector → `totalResult[0]?.count ?? 0` → 200 with `data: []`, `meta.total: 0`. The depth branch degrades (`src/lib/search/depthSearch.ts:207-234` wraps FTS in try/catch), but the legacy branch has no fallback.

**7. `Page.spaceType` defaults to `PRIVATE`, but the kb-query path always searches with `scope: "team"`.**
- `prisma/schema.prisma:193` — `spaceType SpaceType @default(PRIVATE)`.
- `src/lib/search/searchRouter.ts:93` — kb-query's RAG path calls `ragSearch({ … scope: "team" })`; `src/lib/agent/kbQuery.ts:266-272` entity-extraction fallback uses `scope: "team"`; `src/lib/search/depthSearch.ts:159-164` filters `spaceType: "TEAM"`. A fixture that creates category/entity pages without `spaceType: "TEAM"` produces empty results for kb-query.

**8. `User.id` has no `@default` — fixture inserts without an explicit id fail.** `prisma/schema.prisma:151` — `id String @id` (comment: "no @default for Supabase-managed IDs"). `seed.ts` works only because it hard-codes UUIDs (e.g. `:34`). A `user.create({ data: { tenantId, email } })` throws a NOT-NULL violation.

**9. CI applies migrations only — DB starts empty — and `extractEntity` requires an exact taxonomy.** `.github/workflows/ci.yml:58-59` runs `prisma migrate deploy` (no `db seed`). `src/lib/agent/kbQuery.ts:189-227` looks for pages titled *exactly* `Experiments`, `Chemicals`, `Reaction Types`, `Researchers`, `Substrate Classes` as category roots, then matches entity titles as direct children. Without those exact-named TEAM pages, kb-query degrades to pure search and the entity-driven `context_blocks` the voice clients depend on are never produced.

---

### Snapshot brittleness — fields the story's normalization list misses

**10. The depth branch also emits `searchTimeMs`, not just `timestamp`/`elapsed_ms`.** `src/lib/search/depthSearch.ts:389` — `searchTimeMs: Date.now() - startTime` sits inside `data`. The story's normalize-strip list (lines 76-80) names only `timestamp` + `elapsed_ms` + "generated ids" — `searchTimeMs` slips through and breaks any normalized fixture.

**11. `search_strategy` is query-length/keyword-dependent and flips on trivial edits.** `src/lib/agent/kbQuery.ts:1117` returns `routedResult.strategy`; `src/lib/search/searchRouter.ts:50-64` `autoSelectStrategy` branches on `words < 8` / `words > 12` / regex. A fixture pinning `search_strategy: "rag"` breaks for a non-functional reason if a later edit pushes the query past 8 words. Same for `score`/`relevance` floats (`kbQuery.ts:838` `result.score * 0.6`, `depthSearch.ts:267` `Math.min(fts_rank, 0.9)`) — `ts_rank` varies with corpus content.

**12. The kb-query LRU cache is a module singleton with no per-test reset, and `normalizeQuery` merges differently-worded queries.** `src/lib/search/queryCache.ts:31` (`let cache = new Map`), `:38-46` (lowercase, strip stop-words, sort tokens), `:100-145`. `src/lib/agent/kbQuery.ts:1018-1027` — a hit returns `{...cached, query_metadata: {... , elapsed_ms: recomputed}}`, so `elapsed_ms` differs but `context_blocks` is the cached array reference. Two same-tenant tests whose queries normalize equal (e.g. "safety of NaOH" vs "NaOH safety the") share an entry; the second test sees the first's blocks. `invalidateCache()` (queryCache.ts:150-159) exists but the story never calls for it, and `setup.ts` doesn't reset modules.

---

### Fixture assumptions that could pass wrongly (green but vacuous)

**13. Legacy-search happy path passes against an empty result set.** With finding 6, `src/app/api/agent/search/route.ts:196-201` returns `listResponse([], 0, limit, offset)` — a 200 with `data: []`. A test asserting only `status === 200` + "data is an array" goes green without ever exercising `score`/`path`/`matchContext`/pagination — exactly the "limit-bounds" assertion acceptance criterion #1 asks for, satisfied vacuously.

**14. kb-query happy path passes against the empty-KB fallback answer.** `src/lib/agent/kbQuery.ts:893-898` — `synthesizeAnswer` returns a fixed string when `blocks.length === 0`. Combined with 6/7/9, a test that asserts `data.answer` is a non-empty string and `data.context_blocks` is an array PASSES while testing the fallback, not the voice-client answer shape. Acceptance criterion #1 doesn't require `context_blocks` to be non-empty.

**15. A real-DB tenant-isolation test for kb-query can't actually construct a leak to catch.** `extractEntity`/`routeSearch`/`buildContextBlocks` all filter by the *authed* `ctx.tenantId` (`kb-query/route.ts:88` passes `tenantId: ctx.tenantId`; e.g. `kbQuery.ts:158-160, 192-194, 362-364`). The story's option "OR a `resolveApiKey` mock returning tenant A + asserting the `tenantId` passed into `executeKbQuery`" is the only version that can fail; the real-DB version passes trivially because every query is tenant-scoped — it can't fail, so it asserts nothing.

---

### Minor trap

**16. The "reuse if useful" helper is incompatible with the in-process strategy.** `src/__tests__/api/agent/helpers.ts:45` performs a real `fetch(agentUrl(path))` against `localhost:3000`. The story frames it as request-construction, but `agentRequest` is a live-fetch helper; "reusing" it quietly switches a test to the no-server pattern CI doesn't support. (`src/middleware.ts:74-76` does forward `/api/` without auth, so Next middleware itself is not an interference factor for in-process tests — the interfering "middleware" is the in-handler `checkRateLimit`, covered above.)

Runtime breakage / missed bugs: (the 16 findings above)

## Reviewer Feedback / Codex (round 1)

I read the story and relevant route/test/CI code. `codex --version` did not exit non-zero here; it exited `0`, but printed: `WARNING: proceeding, even though we could not create PATH aliases: Operation not permitted`.

**Critical issues:**
- The story’s paths are imprecise, but not wholly nonexistent: the actual files are under `src/app/api/...`, e.g. kb-query route (src/app/api/agent/kb-query/route.ts:28) and agent search route (src/app/api/agent/search/route.ts:66). The story should not point implementers at bare `api/agent/.../route.ts`.
- `agent/pages/* mutation routes` is overbroad/misclassified. `experiment-context` is a `GET`, not a mutation, while only `experiment-context/bulk` is `POST` (src/app/api/agent/pages/experiment-context/route.ts:18). `conflicts` has both `GET` and `POST` (src/app/api/agent/pages/conflicts/route.ts:26).
- Auth wrapper assumption is not uniform. Most listed agent routes use `withAgentAuth`, but `extract-knowledge` uses `withTenant`, not `withAgentAuth` (src/app/api/agent/pages/extract-knowledge/route.ts:1). That changes auth behavior and makes a blanket “agent auth route-level test” acceptance criterion false.
- `withAgentAuth` is API-key-only and enforces scopes by method: `GET` requires `read`; `POST/PUT/PATCH/DELETE` require `write` (src/lib/agent/auth.ts:30). Tests cannot just pass any bearer token unless they mock `resolveApiKey` or create real scoped keys.
- Response envelopes differ between `kb-query` and other routes. `kb-query` returns `{ success, data }` and string `error` on failures (src/app/api/agent/kb-query/route.ts:38); `search`/mutation routes mostly use `successResponse`, `listResponse`, and `errorResponse`, meaning `{ data, meta }` or `{ error: { code, message }, meta }` (src/lib/apiResponse.ts:12). A single typed-error/snapshot expectation across both routes will be wrong.
- `/api/agent/search` has two distinct response shapes. With `depth`, it returns `successResponse(depthSearchResult)` where `data` has `results`, `totalCount`, `depth`, `scope`, `searchTimeMs`; without `depth`, it returns a paginated list of objects with `page_id`, `title`, `icon`, `oneLiner`, `path`, `matchContext`, `score` (src/app/api/agent/search/route.ts:71). The story’s “same matrix + pagination/limit bounds” ignores that pagination only applies to the legacy no-depth branch.
- Snapshot-pinning whole route responses is infeasible/noisy as written. `kb-query` includes `elapsed_ms` in `query_metadata` (src/lib/agent/kbQuery.ts:1114), and standard responses include dynamic `meta.timestamp` (src/lib/apiResponse.ts:12). Snapshots would need normalization or field-level assertions.
- “Reuse existing tenantContext fixtures” does not match reality. I found mocked unit tests for tenant context and some live DB setup in `tests/api`, but no reusable tenant-isolation fixture that directly creates agent API keys/pages for these routes. Existing helper src/__tests__/api/agent/helpers.ts:1 only wraps fetch/request helpers.
- CI claim is unsafe. `.github/workflows/ci.yml` sets `DATABASE_URL` and runs `npx vitest run`, but does not start Next (.github/workflows/ci.yml:35). Existing `tests/api/*` suites explicitly require “live Postgres AND a running Next.js server” and fetch `localhost:3000` when DB exists (tests/api/apiKeys.test.ts:5, tests/api/tenantIsolation.test.ts:5). New tests should not copy that pattern unless CI changes.
- Existing route-test patterns conflict. `/api/search`, not `/api/agent/search`, already has duplicated focused tests in both src/__tests__/api/search.test.ts:27 and tests/unit/api/search/route.test.ts:26. The story should specify where new agent route tests belong and avoid adding a third inconsistent pattern.
- The OpenAPI docs appear stale/incomplete for this surface: `docs/api/agent-openapi.yaml` has `/search`, but my search did not find `kb-query`. So “voice client fields” cannot be reliably inferred from the local agent OpenAPI alone.

**Nice-to-have:**
- Clarify that `kb-query` shape is `answer`, `context_blocks`, optional `formatted_context`/`context_truncated`, and `query_metadata` (src/lib/agent/kbQuery.ts:46).
- Pin stable fields only, or normalize `timestamp`/`elapsed_ms`.
- Split `/api/agent/search` tests into legacy and depth-aware branches.
- Decide whether `extract-knowledge` using `withTenant` is intentional for an `/api/agent/...` route before writing auth assertions.
