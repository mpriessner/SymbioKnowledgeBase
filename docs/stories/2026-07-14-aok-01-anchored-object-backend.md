# AOK-01 — Anchored-Object Knowledge backend (Sites, Spaces, Assets, Anchors)

## Provenance & ownership
- **Project owner:** Martin Priessner (martin.priessner@scisymbio.ai)
- **Created by:** Agent 93 (session `93_New_Feature_other_usecases`)
- **Created:** 2026-07-14
- **Status:** Reviewed (Codex + GLM folded) — ready for implementation
- **Assigned to / currently owned by:** Agent 93 (implementation via Sonnet subagent)
- **Related / parallel work:** Sibling story `SciSymbioLens-Android/docs/stories/2026-07-14-aok-02-lens-objects-toolset.md` (consumes this API — the contract below is shared and must not drift). Strategy: `~/windsurf_repos/NEW-PRODUCTS-ASSESSMENT-2026-07-14.md`. Deliberately builds on **main**, independent of unmerged A71/W81 epics.

## Why (one paragraph)

SciSymbio's new product bets (inventory counting, building & facilities) all need one new primitive the stack lacks: binding knowledge to a *physical object* via a QR "anchor" and retrieving it by scanning. SKB is the knowledge layer, already has tenant-scoped agent-API auth, and already scopes retrieval by entity (`experiment_id` in kb-query) — so the anchored-object model belongs here. Deliberately generic (`class` + JSON `attributes`) so the same tables serve a valve (facilities), a reagent bottle (inventory), and later a parcel (shipping).

## Scope (v1 — online-first, no console)

**In:** Prisma models + migration; agent-API endpoints (mint/bind/resolve anchors, asset CRUD-lite, knowledge attach, search + directions, count lines, visits, undo-support deletes); tenant scoping on every query **and every relationship ID**; real two-tenant isolation tests.
**Out (explicitly):** review-queue console UI (`reviewStatus` field ships defaulted `approved`; AOK-04 flips it); offline bundle; pgvector/semantic search; procedure generation; RLS (repo has none); idempotency keys (see Risks — documented v1 trade-off); OpenAPI doc update (optional follow-up).

## Data model (Prisma, all tables prefixed `Aok`)

Every model: `id String @id`, `tenantId` (indexed, required), `createdAt`, `updatedAt`, `status` where noted. Add the required **inverse relation fields on `Tenant`**. Quantities use `Float` (JSON numbers on the wire — deliberately NOT `Decimal`, which serializes as a string).

**GLM round additions (mandatory):**
- **`onDelete: Cascade` on every `Aok*`→`Tenant` relation and every child→parent FK** (knowledge/anchor/count/visit→asset, space→site, asset→site) — matches the repo-wide invariant on all existing tenant-scoped tables; without it, tenant deletion and DB-backed test teardown throw P2003 the moment any Aok row exists.
- **Self-relations must be explicitly named on both sides** (`@relation("AokSpaceHierarchy", …)` for `AokSpace.parentId`, `@relation("AokAssetReplacement", …)` for `replacedById`) or `prisma validate` fails. Self-FKs use `onDelete: SetNull`.
- **ID scheme settled:** models use Prisma `@default(cuid())` EXCEPT `AokAnchor`, whose ID is service-generated with zero-dep `crypto.randomUUID()` (no cuid library exists in package.json) so the payload persists in a single insert. Path-ID validation therefore accepts an **opaque url-safe string (10–64 chars, `[A-Za-z0-9_-]`)** — both shapes pass; never `z.string().uuid()`, never a cuid-only regex.

- **AokSite**: `name`, `nameKey` (lowercased/trimmed), `type` (`lab|residential_block|office|warehouse|other`). `@@unique([tenantId, nameKey])`. Lazily-created default site `"Default Site"` on first asset without `site_id` (upsert on the unique key; on conflict refetch — race-safe).
- **AokSpace**: `siteId`, `parentId` (nullable self-FK), `kind` (`building|floor|room|zone|shelf|aisle|other`), `name`, `nameKey`, `directionsText` nullable. `@@unique([tenantId, siteId, nameKey])` (v1 spaces are flat per site — tree fields exist, upsert is by name).
- **AokAsset**: `siteId`, `spaceId` nullable, `class` (`facility_asset|inventory_item|parcel`, **default `facility_asset`**), `name`, `category`, `criticality` (default `low`), `attributes` JSONB, `status` (`active|retired|replaced|deleted`), `replacedById` nullable.
- **AokAnchor**: `assetId` **nullable** (null = unbound blank sticker, pre-printable), `type` (default `qr`), `payload` unique (`scs://a/<anchorId>`), `status` (`active|retired`).
- **AokKnowledge**: `assetId`, `kind` (`how_it_works|gotcha|safety_note|location_note|contact`), `text`, `reviewStatus` (default `approved` in v1), `source` (**default `voice_capture`**).
- **AokVisit**: `assetId`, `reason`, `outcome`, `notes` nullable, `workerLabel` nullable.
- **AokCountLine**: `assetId`, `countedQty Float`, `unit` nullable, `expectedQty Float?` (snapshot), `delta Float?`.

**Tenant-safety rules (Codex-critical, non-negotiable):**
1. Every read filters `tenantId`. Every UPDATE/DELETE uses `updateMany/deleteMany` with `{ id, tenantId }` in the WHERE — never a bare `update({where:{id}})` after a separate read.
2. **Every supplied relationship ID (`site_id`, `space_id`, `asset_id`, `parent_id`, `replaced_by`, anchor `asset_id`) is verified to belong to the caller's tenant inside the same transaction as the write**, and `space.siteId` must equal `asset.siteId`.
3. `anchors/resolve` queries `{ payload, tenantId }`.
4. Child writes (knowledge/count/visit/anchor mint or bind) against a non-`active` asset are rejected with a speakable error (`"That object is retired."`). Search and resolve exclude/flag non-active assets (resolve of an anchor bound to a retired asset → `ok:false, error:"This object was retired."`).

**Anchor minting (race-free):** the service pre-generates the cuid, derives `payload = scs://a/<id>`, and persists both in a **single insert**. The QR PNG is rendered statelessly from the payload string on each request (mint response and future reprint) — no stored image, no create-then-update.

## API contract (SHARED with AOK-02 — do not drift)

All under `/api/agent/aok/*` behind the existing `withAgentAuth()` (unmodified — do NOT touch the HOC). **Dual envelope, explicitly:** auth/scope/rate-limit failures are produced by the HOC in the repo-standard `{error:{code,message},meta}` shape (existing tests pin it); **AOK handler responses** use `{ok:true,...}` / `{ok:false,error:"<speakable sentence>"}`. The Android client must parse both. All request/response field names **snake_case**; timestamps ISO-8601 UTC strings; quantities JSON numbers. Zod schemas use `.strict()` (unknown fields → speakable 400); malformed JSON body → speakable 400, not a 500. Path IDs validated as non-empty cuid-shaped strings — **do NOT copy the `z.string().uuid()` pattern from the databases routes** (would reject cuids). Asset-card + resolve responses set `Cache-Control: no-store` (matches kb-query's sensitive-response treatment).

| Method + path | Body / params | Returns (HTTP status) |
|---|---|---|
| `POST /api/agent/aok/assets` | `{ name, category, class?, criticality?, space_name?, site_id?, attributes? }` | 201 `{ ok, asset }` — `asset` = `{ id, name, category, class, criticality, status, attributes, site_id, space_id, space_path: string[], directions_text: string\|null, created_at, updated_at }`; `space_path` = `[site.name, ...space names root→leaf]`; `directions_text` = nearest ancestor space's non-null `directionsText` |
| `GET /api/agent/aok/assets/:id` | — | 200 **asset card**: `{ ok, asset, knowledge: [approved, newest 5: {id, kind, text, created_at}], last_visits: [newest 3: {id, reason, outcome, notes, created_at}], anchors: [{id, payload, status}] }`; 404 speakable |
| `PATCH /api/agent/aok/assets/:id` | `{ status?, name?, category?, attributes?, space_name? }` — `attributes` is a **shallow merge** | 200 `{ ok, asset }` |
| `POST /api/agent/aok/anchors` | `{ asset_id?, type? }` — omitted `asset_id` mints an **unbound** blank (for pre-printed rolls) | 201 `{ ok, anchor: {id, payload, status, asset_id}, qr_png_base64 }` |
| `POST /api/agent/aok/anchors/:id/bind` | `{ asset_id }` | 200 `{ ok, anchor }`; rebinding an already-bound anchor is allowed (rebind = spec-pack lifecycle); binding to non-active asset → 409 speakable |
| `GET /api/agent/aok/anchors/resolve?payload=...` | — | 200 bound: `{ ok:true, bound:true, anchor_id, ...asset-card fields }` · 200 unbound: `{ ok:true, bound:false, anchor_id }` · 404 unknown payload: `{ ok:false, error:"This code is not bound to any object." }` · 200 retired target: `{ ok:false, error:"This object was retired." }` |
| `POST /api/agent/aok/assets/:id/knowledge` | `{ text, kind? }` (kind default `gotcha`) | 201 `{ ok, knowledge }` |
| `GET /api/agent/aok/assets/search?q=...&site_id=?&limit=5` | — | 200 `{ ok, results: [{ asset, space_path, directions_text }] }` (ranked; may be empty) |
| `POST /api/agent/aok/assets/:id/counts` | `{ qty, unit? }` | 201 `{ ok, count_line, expected_qty, delta }` (nulls when no expected) |
| `POST /api/agent/aok/assets/:id/visits` | `{ reason, outcome, notes? }` | 201 `{ ok, visit }` |
| `DELETE /api/agent/aok/knowledge/:id` / `counts/:id` / `visits/:id` | — | 200 `{ ok }` (undo support; hard delete OK; assets retire via PATCH) |

**Search semantics (Codex-critical):** normalize both stored text and query — lowercase, map `-_/` → space, collapse whitespace — then require **every query token** to match `name+category` (per-token ILIKE on the normalized form or equivalent), so "shut off" matches "Main shut-off valve". Rank: normalized exact > prefix > all-tokens-contained. Exclude non-active assets. Rank first, hydrate site/space after, preserving order. Keep this **separate** from `depthSearch`/`ragSearch`/`/api/agent/search` (their response shapes are pinned by existing tests). Documented: `AokKnowledge` does NOT appear in generic kb-query/PageLink traversal in v1.

**Audit (Codex-critical):** `withAgentAuth` only logs auth. Every successful AOK mutation must explicitly call the existing `logAgentAction` helper with action/resource/resourceId — **never** the knowledge text, notes, or attribute contents. **Fire-and-forget (GLM): invoke as `void logAgentAction(...)` with a `.catch` — `logAgentAction` internally awaits its insert, and awaiting it in the route puts a serial audit write on the count hot path.** Tests pin the invocation (args), not awaited completion.

**Handler error safety (GLM-critical):** `withAgentAuth` does NOT catch handler throws — an unhandled exception escapes as a bare Next.js 500, violating the speakable contract. Every AOK route wraps its handler body in try/catch returning `{ok:false, error:"Something went wrong saving that — try again."}` (500). The service layer throws typed errors that map to the speakable messages in the contract table.

**Rate limit interaction (GLM):** the agent HOC enforces an in-memory ~100 req/min/key limit shared across ALL agent routes. `scripts/aok-smoke.sh` must pace itself (sleeps between phases; seeding under a second key or pre-run) so the full loop + 20 latency resolves stay under the window; a mid-smoke 429 aborts non-retried.

## Acceptance criteria

1. Migration applies cleanly to a fresh main-schema DB. Generated from a **clean main-schema database** with timestamp > all main migrations (2026-07-14+); `npx prisma generate` run before typecheck (client is gitignored at `src/generated/prisma/`); never run `migrate dev` against a DB containing branch (A71/W81) migrations.
2. **Real two-tenant isolation tests (DB-backed, not mocked):** with two tenants + two API keys, every ID-bearing read/write path — including cross-tenant relationship IDs in `site_id`/`space_id`/`asset_id`/bind and cross-tenant `payload` resolve — returns 404/403-equivalent speakable errors and leaks nothing.
3. Full anchor lifecycle: mint unbound → resolve (`bound:false`) → bind → resolve (`bound:true`, card contains attached knowledge) → retire asset → resolve (speakable "retired"). Also: mint bound directly with `asset_id`.
4. Search: "shut off" finds "Main shut-off valve" (hyphen normalization) and ranks it first; retired assets absent; empty result is `{ok:true, results:[]}`.
5. Counts: correct numeric delta with `attributes.expected_qty` set; nulls otherwise; JSON numbers (not strings) on the wire.
6. All error responses (business + validation) are speakable sentences; auth failures remain the repo envelope (existing agentAuth tests untouched and green).
7. Unit + integration tests green per repo conventions; audit-call tests pin action/resource/resourceId; lint/typecheck green.
8. Resolve p50 < 300 ms measured by the smoke script (20 sequential resolves against a 50-asset seeded tenant, local stack).

## Affected files (expected)

- `prisma/schema.prisma` (+ inverse relations on Tenant) + new migration
- `src/app/api/agent/aok/**` (new routes, thin) + `src/lib/aok/` (service layer: tenant-verification transactions, normalization, ranking)
- `package.json` + `package-lock.json` (+ types): add `qrcode` — **in `dependencies`, NOT `devDependencies`** (the standalone Docker build only bundles `dependencies`), and the mint/reprint routes must run on the **Node runtime** (no `export const runtime = "edge"` — qrcode needs Buffer)
- Reuse unmodified: `src/lib/agent/auth.ts`, `src/lib/agent/audit.ts` (called, not changed), `src/lib/apiResponse.ts`
- Tests: unit + DB-backed two-tenant integration suite; extend `tests/api/schema.test.ts` to cover the 7 Aok tables
- `scripts/aok-smoke.sh`: full-loop curl smoke + resolve-latency measurement

## Risks & open questions (with decisions)

- **Idempotency / duplicate writes (Codex):** v1 ships WITHOUT idempotency keys. Mitigation: client makes exactly one attempt (no auto-retry) and on ambiguous failure says "I couldn't confirm the save" (not "was not saved"). Duplicates of knowledge/counts/visits are low-harm and console-cleanable. Full `Idempotency-Key` lands with the offline story (it needs it anyway). Documented trade-off.
- **Directions authoring gap (Codex nice-to-have):** no in-scope API sets `directionsText` or creates named sites — v1 demo seeds these directly (seed script part of E2E). AOK-04 console adds authoring.
- **`reviewStatus` default `approved`** is a deliberate v1 demo choice; AOK-04 must flip default + ship the queue atomically.
- Migration-ordering with unmerged epics: accepted risk, guarded by AC-1.

## Verification plan

Repo test suite (unit + DB integration) by the implementing subagent; `scripts/aok-smoke.sh` against the locally running stack; live-DB migration application happens in the main session's E2E phase, not by the subagent.

## Reviewer Feedback / Codex (round 1)

Codex (gpt-5.6-sol, high reasoning, read-only) reviewed this story + the sibling AOK-02 + both repos. Verdict: "not implementation-ready" — 16 critical issues, all folded into the revision above. Highlights (full transcript in session log):
- Unbound-anchor flow impossible as originally specced (assetId was required; no bind endpoint) → nullable assetId + `POST /anchors/:id/bind` added; AOK-04's assumption now satisfied.
- `{ok:...}` envelope clashed with `withAgentAuth`'s `{error:{code,message},meta}` envelope pinned by agentAuth/kb-query/MCP-client tests → dual-envelope contract documented; HOC untouched.
- Tenant filtering alone didn't prevent cross-tenant FK attachment → transactional relationship-ID verification + `{id,tenantId}` predicates on all mutations + `{payload,tenantId}` resolve.
- `z.string().uuid()` route patterns would reject cuid IDs → explicit cuid-shaped validation.
- Anchor payload derivation race → service-generated ID, single insert, stateless QR render.
- Missing defaults (`class`, `source`, `type`) → defaults in contract.
- DTO underspecification + Prisma `Decimal`→string trap → snake_case/ISO/Float contract.
- ILIKE search fails "shut off" vs "shut-off" → normalization + token matching; exclude non-active; rank-then-hydrate.
- Upsert races → `nameKey` unique constraints.
- Undo/retired semantics → child-write rejection on non-active assets; resolve-retired message.
- `logAgentAction` has zero production call sites → explicit per-mutation audit calls, no free-text details.
- No idempotency → documented v1 trade-off + client single-attempt wording.
- Mocked tests can't prove tenant isolation → real two-tenant DB tests required (AC-2).
- Migration ordering vs A71/W81 → AC-1 guard.
Nice-to-haves folded: strict Zod + speakable 400s, `Cache-Control: no-store`, qrcode dep in affected files, PATCH shallow-merge semantics, space_path/directions definition, search separation + kb-query exclusion note, schema.test extension, latency harness. Skipped: OpenAPI YAML update (follow-up; noted in Out-of-scope).

## Reviewer Feedback / GLM (round 2 — runtime + integration lens; Gemini skipped per owner's standing preference)

GLM-5.2 traced runtime behavior and adjacent systems. Findings, all folded above: (1) missing `onDelete: Cascade` on all Aok relations breaks tenant deletion + DB test teardown (P2003) — repo invariant proven on every existing tenant table; (2) `withAgentAuth` doesn't catch handler throws (auth.ts:166-182) → bare 500s; per-route try/catch required; (3) cuid claim contradicted repo primitives (no cuid lib; randomUUID yields the UUIDs the plan forbade) → ID scheme settled: Prisma cuid defaults + randomUUID for anchors + opaque url-safe path validation; (4) shared in-memory 100 req/min/key rate limit (ratelimit.ts:16-17) can 429 the smoke script mid-loop → pacing requirement; (5) `logAgentAction` internally awaits its insert → fire-and-forget from routes; watch-items: named self-relations, `qrcode` in `dependencies` + Node runtime, MCP client would misread resolve's HTTP-200 `{ok:false}` retired body as success if ever wired (documented seam, no v1 action).

## Revision History
- 2026-07-14 — Initial draft (Agent 93)
- 2026-07-14 — Codex round-1 revision: unbound/bind lifecycle, dual envelope, transactional tenant-verification of relationship IDs, cuid validation, race-free minting, contract defaults, wire-format spec (snake_case/ISO/Float), normalized token search, nameKey unique upserts, non-active write rejection, explicit audit calls, no-idempotency trade-off documented, real two-tenant DB tests, migration guards.
- 2026-07-14 — GLM round-2 revision: cascade rules + named self-relations, handler try/catch (speakable 500s), settled ID scheme (randomUUID anchors / opaque validation), smoke-script rate-limit pacing, fire-and-forget audit, qrcode dependencies+Node-runtime constraints. Status → ready for implementation.
