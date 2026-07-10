# Private-document search & listing by voice/agent

## Provenance & ownership
- **Project owner:** Martin Priessner (martin.priessner@scisymbio.ai)
- **Created by:** Agent 70
- **Created:** 2026-07-04
- **Status:** draft
- **Assigned to / currently owned by:** unassigned
- **Related / parallel work:** Depends on [a71-08 Document intake](2026-07-04-a71-08-document-intake-upload-or-link.md) for there to be private documents worth listing, and reuses the voice-search wiring from Epic A's [a71-05 Companion `search_knowledge_base` voice tool](2026-07-04-a71-05-companion-search-knowledge-base-voice-tool.md) and [a71-06 Android KB search reachability](2026-07-04-a71-06-android-kb-search-reachability.md) — this story adds a new capability (private listing) alongside those, it does not duplicate their search-tool wiring. Also feeds [a71-12 Google Drive connector](2026-07-04-a71-12-google-drive-connector.md)'s phase 3 (agent/voice Drive search) which will want the same private/mine-scoping conventions established here.

## Problem / motivation

SKB already has the pieces for scoped search — `POST /api/agent/kb-query` accepts `depth` but no explicit scope parameter today (it searches across whatever the tenant's data returns via `executeKbQuery`, see `src/lib/agent/kbQuery.ts`), while `GET /api/agent/search?scope=private|team|all` (`src/app/api/agent/search/route.ts`, `depthSearch()` in `src/lib/search/depthSearch.ts`) already supports a `scope` parameter restricted to `private|team|all`. What's missing:

1. **kb-query has no scope parameter at all.** A voice question like "what's in my private notes about X" cannot currently be constrained to the caller's own private space via kb-query — only the lower-level `/api/agent/search` endpoint supports scoping, and kb-query is the richer, LLM-friendly endpoint both a71-05 and a71-06 are wired to.
2. **No "list my documents" capability.** Neither endpoint supports an intent like "what documents do I have" without the caller supplying a search query string — `q`/`query` are both required non-empty fields today (`searchQuerySchema` requires `q: z.string().min(1)`; `kbQuerySchema` requires `query: z.string().min(1)`). There is no bare "list everything in my private space" call.
3. **The private-scope ↔ user-identity binding is unverified.** `skb_live_*` API keys resolve to `{tenantId, userId, apiKeyId, scopes}` via `resolveApiKey` (used inside `withAgentAuth`, `src/lib/agent/auth.ts`). Whether "private" in `depthSearch`'s `scope: 'private'` means "private to the *tenant*" or "private to the specific *user* who owns this key" needs to be confirmed by reading `src/lib/search/depthSearch.ts` during implementation — the brief's exploration explicitly flags this as unverified ("keys are tenant+user scoped — verify and document"). Getting this wrong means one user's private key could list another user's private documents within the same tenant.

## Proposed change

### 1. The scope binding is RESOLVED (Round 1): private is tenant-wide, and `Page` has no owner — this is a blocking prerequisite
The review pass already read the code, so the "verify" step is done: `depthSearch`'s `scope: 'private'` filters **only** `{ spaceType: 'PRIVATE' }` (no user field, in both the Prisma query and the raw FTS SQL), and the `Page` model has **no owner/creator column at all**. So today any user in a tenant can read every other user's PRIVATE pages, and "private to me" is not expressible.

Therefore "list *my* private documents" cannot be built safely on the current schema — it would return other tenant-users' documents to the caller. Building the per-user filter is **not** a small inline fix; it requires:
1. A new `Page.ownerId` (nullable) column + migration.
2. A backfill decision for pre-existing PRIVATE pages — who owns pages created before ownership existed? This needs the project owner's call.
3. A per-user predicate threaded through `depthSearch`, `routeSearch` (and its `ragSearch`/`agenticSearch` callees), AND `kbQuery`.

**This must ship as its own blocking prerequisite story before any "mine" semantics land here.** This story may ship the `scope` *plumbing* (see sections 2-3) on top of the existing tenant-wide `private` meaning, but must NOT expose voice copy implying per-user privacy until the ownership story is done.

### 2. Add scope to kb-query (via `routeSearch`, NOT `depthSearch` — Round 1 correction)
Extend `kbQuerySchema` in `src/app/api/agent/kb-query/route.ts` with an optional `scope: z.enum(["private","team","all"]).optional().default("all")`, threaded through to `executeKbQuery()` (`src/lib/agent/kbQuery.ts`). **`executeKbQuery`'s primary retrieval is `routeSearch` (`src/lib/search/searchRouter.ts`), not `depthSearch`** — and `routeSearch` currently **hardcodes `scope: "team"`** when it calls `ragSearch` (searchRouter.ts line 93). The `depthSearch` call in `extractEntity` is only a fallback and also hardcodes `scope:"team"` (kbQuery.ts ~line 271). So the scope parameter must be plumbed into `routeSearch`'s options and down into `ragSearch`/`agenticSearch`, replacing the hardcoded `"team"`. Also add `scope` to the kb-query result cache key: `executeKbQuery` calls `getCachedResult(tenantId, query, depth, strategy, maxBlockChars, maxAnswerLength)` (~line 1018) — without `scope` in the key, a `scope=private` query can return a cached `all`/`team` result and leak cross-scope content. Update both `getCachedResult` and `setCachedResult`.

> **Round 2 correction (verified against `src/lib/search/agenticSearch.ts`):** the gap is wider than `ragSearch`'s hardcoded `"team"`. `agenticSearch()` (called at `searchRouter.ts:96` and again in the rag-fallback branch at `searchRouter.ts:151`) has **no `scope` field in `AgenticSearchOptions` at all** — it isn't passed a scope today, hardcoded or otherwise, because the option doesn't exist. So this story must (a) add a `scope` field to `AgenticSearchOptions` and thread it into `agenticSearch`'s own query filtering, not just pass an existing option through, and (b) update both call sites in `searchRouter.ts` (the main `runAgentic` branch and the line-151 fallback) to pass it. Skipping this means a `scope="private"` kb-query still leaks team/all-scope results through the agentic strategy path even after `ragSearch` is fixed.

### 3. "List my documents" capability
Two design options — pick one in review:
- (a) A dedicated new endpoint `GET /api/agent/documents?scope=private&limit=&offset=` that lists `kind='document'` (per a71-08) pages for the caller's scope, no search query required.
- (b) Make `q` optional on `GET /api/agent/search` when `scope` is present, treating a missing `q` as "list all" within that scope/category filter (already has `category` support including the new `documents` value from a71-08).

Recommend (b) — but note a structural gotcha found in Round 1: `GET /api/agent/search` has **two branches**. The **legacy branch** (`searchQuerySchema`, `q: min(1)`, `limit`+`offset`) has **no scope and no category**. The **depth branch** (`?depth=...`) has scope+category but calls `depthSearch` (which has `limit` but **no `offset`**) and currently rejects empty `q` before calling it. Since "list my documents" needs scope+category, it must go through the **depth branch**, and that requires: (i) allowing an absent/empty `q` in the depth branch, (ii) giving `depthSearch` a no-query listing mode (`ORDER BY updated_at DESC` instead of `title contains` / FTS — note `title: { contains: "" }` in Prisma matches *everything*, so guard it explicitly), and (iii) adding `offset` pagination to the depth branch since it has none today. Do NOT try to bolt scope/category onto the legacy branch. Also: `category=documents` only works once a71-08's `kind`-aware `depthSearch` branch lands (per a71-08 Round-1 finding) — sequence accordingly.

### 4. Voice/agent surfacing
On companion (a71-05's `search_knowledge_base` tool) and Android (a71-06's `query_knowledge_base` path), recognize a "list my documents" intent (either via a natural-language convention in the tool description telling the model to omit `query`/pass an empty listing flag, or a small dedicated `list_my_documents` tool if the review loop decides mixing "search" and "list" semantics into one tool is confusing for the model to invoke correctly — flag this design choice for review same as a71-10 flags its tool-count question). Whichever tool surfaces it, the spoken answer format should be a short enumerated list ("You have 4 documents in your private area: Reagent Safety Sheet, ...") not a wall of context blocks.

## Affected repos & files

**SymbioKnowledgeBase** (primary):
- `src/lib/search/searchRouter.ts` — **primary retrieval for kb-query**; thread `scope` into `routeSearch`/`ragSearch`/`agenticSearch`, replacing the hardcoded `scope:"team"` (line ~93). **Round 2:** also update the rag-fallback `agenticSearch` call (~line 151) — it's a second, easy-to-miss call site.
- `src/lib/search/agenticSearch.ts` — **Round 2:** `AgenticSearchOptions` has no `scope` field today; add one and apply it in the function's own query/filter logic, not just at the call site.
- `src/lib/search/depthSearch.ts` — add a no-query listing mode (`ORDER BY updated_at DESC`, guard `contains: ""`) and `kind`-aware category filter (coordinate with a71-08); the fallback `depthSearch` call in `kbQuery.ts` also hardcodes `scope:"team"`.
- `src/app/api/agent/kb-query/route.ts`, `src/lib/agent/kbQuery.ts` — add `scope` parameter end to end; add `scope` to the queryCache key (`getCachedResult`/`setCachedResult`).
- `src/lib/search/queryCache.ts` (or wherever `getCachedResult`/`setCachedResult` live) — extend the cache key with `scope`.
- `src/app/api/agent/search/route.ts` — allow absent/empty `q` in the **depth branch** (not the legacy branch) and add `offset` pagination there.
- `prisma/schema.prisma` — **prerequisite story**: add `Page.ownerId` + migration + backfill (Round 1 finding 1); required before any per-user "private" semantics.

**voice-companion-vision** (secondary, coordinate with a71-05's owner):
- Tool description/intent-recognition update for the "list documents" case, in whatever tool file a71-05 creates.

**SciSymbioLens-Android** (secondary, coordinate with a71-06's owner):
- Same intent-recognition update in `ToolCallHandler.kt`'s `query_knowledge_base` handler, and/or `SkbApi.kt`'s DTOs if a new query shape is needed.

## Out of scope
- Team-scope or all-scope listing UX changes (only private-scope "list mine" is the owner's stated need — team/all listing can reuse the same mechanism later without a new story if it turns out to be trivial, but is not required here).
- Building a UI page for browsing private documents (a71-08's page tree already shows this visually; this story is voice/agent-facing only).
- Fixing the ownership-binding gap if it turns out to be large (e.g. requires backfilling ownership on existing pages) — in that case, this story ships the `scope` plumbing but flags the gap as a blocking follow-up, per step 1.

## Acceptance criteria
1. `depthSearch.ts`'s private-scope semantics are read and documented in this story's implementation notes (tenant-wide vs. per-user) before any new code is written.
2. If per-user scoping is missing and fixable within this story's size budget, it is added; a `skb_live_*` key belonging to user A never returns user B's private pages under `scope=private` within the same tenant, verified by a test with two distinct user-owned keys.
3. `POST /api/agent/kb-query` accepts an optional `scope` field and correctly restricts context blocks to that scope.
4. `GET /api/agent/search` accepts a request with `scope` and `category=documents` but no `q`, returning a listing (not an error) ordered by recency, paginated per the existing `limit`/`offset` params.
5. On both companion and Android, a user can ask "what documents do I have in my private area" and receive a short spoken list of titles, sourced from the new listing capability, on both voice stacks (OpenAI provider + Generic adapter on Android, per the existing dual-manager parity requirement).
6. Existing `q`-required search behavior for all other existing callers is unchanged (regression-tested) — the "optional `q`" change must not silently change results for callers that do supply `q`.

## Verification plan
- Code read + written finding: `src/lib/search/depthSearch.ts` scope-binding behavior, documented inline in this story before implementation proceeds.
- Integration test (Vitest, DB-guarded): two tenants' worth of seeded users each with a private document; assert `scope=private` search/listing under user A's key never returns user B's page, and vice versa.
- `curl` check: `curl -H "Authorization: Bearer skb_live_..." "http://localhost:3000/api/agent/search?scope=private&category=documents"` (no `q`) returns a listing, not a 400.
- `curl` check: `curl -X POST -H "Authorization: Bearer skb_live_..." -d '{"query":"safety procedure","scope":"private"}' http://localhost:3000/api/agent/kb-query` returns an answer scoped to private pages only.
- Manual voice test on both companion and Android: ask "what documents do I have" and confirm a spoken enumerated answer, not silence or a generic KB search miss.
- Regression: existing kb-query and search test suites pass with the new optional fields absent (default behavior unchanged).

## Regression risks
- **The ownership-binding fix (if needed) touches a shared search primitive** (`depthSearch.ts`) used by every existing `scope=team|all` caller too — any per-user filter added for `private` must be scoped to the `private` branch only, verified by a regression test that `team`/`all` scope results are byte-for-byte unchanged before/after.
- **Making `q` optional on `/api/agent/search`** risks breaking any caller that currently relies on `q` being present-but-possibly-empty in a way the current `z.string().min(1)` schema rejects — audit existing callers (companion/Android/any other agent integration) before loosening the schema, since a validation error some caller depends on for its own error-handling could silently start succeeding instead.
- **kb-query `scope` default**: defaulting new `scope` param to `"all"` preserves today's behavior for every existing caller that doesn't pass it — verify this default is applied consistently in both the Zod schema and `executeKbQuery`'s internal call, not just one of the two layers.
- **Tool-surfacing ambiguity (companion/Android)**: teaching the model to recognize "list my documents" as a distinct intent from "search my documents for X" risks the model routing normal search queries into list-mode or vice versa — needs explicit few-shot-style guidance in the tool description and a manual test matrix of both phrasings on both surfaces before shipping.
- **Unbounded listing cost (Round 2, right-sized):** the new no-query listing mode in `depthSearch` should enforce a sane max `limit` (mirroring whatever cap the existing search paths already apply) so "list my documents" can't be called with an unbounded page size and tie up a DB connection — a simple clamp is enough here, not a dedicated timeout/circuit-breaker mechanism.

## Reviewer feedback

### Round 1 — Regression lens (Claude Opus fallback for the broken Codex CLI, 2026-07-04)

Reviewer note: Claude Opus standing in for the non-functional Codex CLI reviewer. `depthSearch.ts`, `kbQuery.ts`, `searchRouter.ts`, `agent/auth.ts`, `agent/kb-query/route.ts`, `agent/search/route.ts` and the `Page` model were all read before writing.

1. **BLOCKER — per-user "private" is impossible today, and the gap is large, not small.** The story's step 1 asks whether `scope: 'private'` is tenant-wide or per-user. I resolved it: **tenant-wide, with zero user attribution.** `depthSearch` filters only `{ spaceType: 'PRIVATE' }` (lines 159-164 and the raw FTS SQL 201-205) — no user field. And the `Page` model in `prisma/schema.prisma` has **no owner/creator column at all** (only `deletedBy`; `createdBy` exists on `PublicShareLink`, not `Page`). So every user in a tenant can already read every other user's "private" pages. Building voice "list *my* private documents" on this would return other users' documents to the caller — an active data-leak dressed up as a feature. The fix is NOT small: it needs (a) a new `Page.ownerId` column, (b) a backfill decision for existing PRIVATE pages (who owns pages created before ownership existed? ambiguous — needs the owner's call), and (c) a per-user filter threaded through `depthSearch`, `routeSearch`, AND `kbQuery`. This must be a **blocking prerequisite story**, not an "if the fix is small, do it inline" branch. Recommend splitting: ship the ownership schema + backfill + filter as its own story before any "mine" semantics.

2. **MAJOR (factual error) — kb-query's primary retrieval is `routeSearch`, not `depthSearch`.** Section 2 says thread `scope` "into whatever `depthSearch()` call [`executeKbQuery`] makes internally." It makes none for primary retrieval: `executeKbQuery` calls `routeSearch` (`src/lib/search/searchRouter.ts`), and `routeSearch` **hardcodes `scope: "team"`** when it delegates to `ragSearch` (searchRouter.ts line 93). `depthSearch` is only used as a *fallback inside `extractEntity`*, also with a hardcoded `scope: "team"` (kbQuery.ts line 271). So adding a working `scope` to kb-query requires editing `searchRouter.ts` (and its `ragSearch`/`agenticSearch` callees) — which this story's design and Affected-files list omit entirely. Rewrite section 2 to thread scope through `routeSearch`, not `depthSearch`.

3. **MAJOR (internal contradiction) — scope/category live in a different `/api/agent/search` branch than the one you're editing.** `GET /api/agent/search` has two branches: the **depth branch** (has `scope` + `category`, calls `depthSearch`, `limit` only, **no `offset`**) and the **legacy branch** (`searchQuerySchema` with `q: z.string().min(1)`, `limit`+`offset` pagination, **no scope, no category**). Section 3 cites `searchQuerySchema` (legacy) for "make `q` optional" but also relies on `scope`+`category` (depth-only). These cannot both be true in one branch as written. Decide explicitly: the "list documents" path must go through the **depth branch** (for scope+category), and `depthSearch` must gain a no-query listing mode (empty `q` → order by `updatedAt desc`, since the route currently rejects empty `q` before calling it, and `title: { contains: "" }` would otherwise match everything). Note the depth branch has no `offset` today — pagination for listing needs adding there.

4. **MAJOR — `category=documents` listing is blocked on a71-08's unfinished category work.** This story leans on `category=documents` (from a71-08). Per a71-08 Round-1 finding 2, that category does not actually filter documents until `depthSearch` gets a `kind`-aware branch (it currently derives category from parent-page title). So "list my documents" via `category=documents` cannot work until that a71-08 change lands. Sequence this after a71-08's category fix, not just after a71-08 existing.

5. **MINOR — kb-query has a result cache keyed without scope.** `executeKbQuery` calls `getCachedResult(tenantId, query, depth, strategy, maxBlockChars, maxAnswerLength)` (kbQuery.ts ~line 1018) — `scope` is **not** in the key. If you add `scope` without adding it to the cache key, a `scope=private` query can return a previously cached `scope=all` (or team) result, leaking cross-scope content. Add `scope` to both `getCachedResult` and `setCachedResult` keys.

**Revisions applied (Round 1):**
- Step 1 (Verify/document): rewritten to state the finding as resolved — private is tenant-wide, `Page` has no owner column — and to make the ownership schema+backfill+filter a **blocking prerequisite** (own story), not an inline "if small" option.
- Section 2 (Add scope to kb-query): corrected to thread scope through `routeSearch`/`ragSearch` (which hardcode `scope:"team"` today), not `depthSearch`; added `searchRouter.ts` to affected files.
- Section 3 ("List my documents"): pinned to the depth branch and spelled out that `depthSearch` needs a no-query listing mode + `offset`; noted the legacy branch has no scope/category.
- Added a cache-key note (add `scope` to the kb-query cache key).
- Affected files: added `src/lib/search/searchRouter.ts` and the queryCache module.
- Acceptance criteria: AC1/AC2 reframed around the confirmed tenant-wide finding and the prerequisite ownership story.
- Open questions for the owner (unfixable by editing): (i) approve a dedicated ownership-schema prerequisite story before any "mine" semantics ship; (ii) decide the backfill owner for pre-existing PRIVATE pages.

### Round 2 — GLM-4.5-flash runtime lens (2026-07-04, quota fallback for glm-5.2)

1. **[MAJOR] SearchRouter hardcodes scope:"team" in line 93 of searchRouter.ts, but the story only plans to update routeSearch to accept scope - this creates a runtime gap where kb-query searches with scope="private" or "all" will still use scope="team" internally**

   In `searchRouter.ts` line 93, `ragSearch` is called with `scope: "team"` hardcoded. The story plans to update `routeSearch` to accept a `scope` parameter and pass it through, but doesn't account for the `agenticSearch` call on line 96 which also hardcodes no scope. This means even if kb-query gets a `scope="private"` parameter, the actual search will still use scope="team" for RAG searches and no scope filter for agentic searches.
   [fold note: genuine gap, verified — read `agenticSearch.ts` directly: `AgenticSearchOptions` has no `scope` field at all today (not hardcoded, simply absent), and both call sites (`searchRouter.ts:96` and the fallback at `:151`) omit it. Folded into Proposed change §2 and Affected repos & files above — this is a wider fix than Round 1's finding 2 captured (Round 1 only flagged `ragSearch`'s hardcode).]

2. **[MINOR] Making `q` optional in depthSearch branch without updating the FTS fallback could cause empty query searches to return all pages instead of an empty result**

   In `depthSearch.ts`, if an empty query is passed, the PostgreSQL FTS query becomes `plainto_tsquery('english', '')` which matches everything. The story plans to allow empty `q` in the depth branch, but this needs explicit guarding to prevent accidentally returning all pages when the user intended an empty search.
   [fold note: already covered — Proposed change §3(ii) already replaces the FTS/`title contains` query path entirely with an explicit `ORDER BY updated_at DESC` listing mode for the no-query case, precisely to avoid this. No new body change needed.]

3. **[MINOR] No runtime validation that scope changes are backwards compatible - existing callers might break if the default changes**

   The story plans to default kb-query scope to "all", but there's no runtime validation that this doesn't break existing integrations. The `routeSearch` function currently defaults to scope="team" in practice - changing this could cause silent behavioral changes for voice integrations that depend on current behavior.
   [fold note: already covered — AC6 already requires regression-testing that existing `q`-required callers are unchanged, and the Regression risks section already has a dedicated "kb-query `scope` default" bullet requiring the `"all"` default be applied consistently across the Zod schema and `executeKbQuery`. No new body change needed.]

4. **[BLOCKER] The story doesn't account for the fact that depthSearch currently has no offset parameter - pagination for "list my documents" will fail silently or return incorrect results**

   In `depthSearch.ts` line 184, the query uses `take: limit` but no `skip` for pagination. The search API expects `offset` to work for listing, but depthSearch doesn't implement it. If the depth branch tries to use offset (line 79 of search route doesn't pass it), it will be ignored, causing pagination to break silently.
   [fold note: already covered — Round 1 finding 3 already identifies this exact gap ("the depth branch has no `offset` today — pagination for listing needs adding there") and it's already in Affected repos & files. No new body change needed.]

5. **[MAJOR] Cache key doesn't include scope, creating a potential cross-scope data leak**

   The story mentions adding scope to the cache key in queryCache.ts, but looking at the current implementation, the cache key in `queryCache.ts` lines 65-66 doesn't include scope. This means a cached result from scope="team" could be returned to a query with scope="private" if the other parameters match, leaking cross-scope data.
   [fold note: already covered — Round 1 finding 5 and Proposed change §2 already require adding `scope` to both `getCachedResult` and `setCachedResult` keys. No new body change needed.]

6. **[MINOR] No timeout handling for the "list my documents" endpoint - could hang indefinitely if there are thousands of documents**

   The depthSearch function has no timeout mechanism. If someone calls the listing endpoint with a large scope and thousands of documents, it could tie up database connections and timeout for the user without proper error handling.
   [fold note: genuine gap, right-sized — a full timeout mechanism is more than a v1 listing feature needs; folded into Regression risks above as a simple max-`limit` clamp instead, which addresses the same underlying risk (an unbounded query tying up a DB connection) without new infrastructure.]

**Revisions applied (Round 2):**
- Proposed change §2 (Add scope to kb-query): corrected/widened to note `AgenticSearchOptions` has no `scope` field at all (verified in code) — both `agenticSearch` call sites and its own option type need the addition, not just a hardcode swap.
- Affected repos & files: added `src/lib/search/agenticSearch.ts` and called out the second (`~line 151`) `searchRouter.ts` call site.
- Regression risks: added a right-sized max-`limit` clamp for the no-query listing mode (addresses the "unbounded listing" finding without a dedicated timeout mechanism).
- Findings adjudicated as already covered, no body change: empty-query FTS fallback (already replaced by the no-query listing mode design), scope-default backward-compat validation (already an AC + regression-risk bullet), missing `offset` param (already Round 1 finding 3), cache key missing scope (already Round 1 finding 5).
