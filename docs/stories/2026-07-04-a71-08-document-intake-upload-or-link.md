# Document intake (upload or link)

## Provenance & ownership
- **Project owner:** Martin Priessner (martin.priessner@scisymbio.ai)
- **Created by:** Agent 70
- **Created:** 2026-07-04
- **Status:** in-progress (backend implemented; UI dialog deferred — see implementation notes below)
- **Assigned to / currently owned by:** implementing agent (this session), 2026-07-05
- **Related / parallel work:** Feeds [a71-09 QR generation + printable sheet](2026-07-04-a71-09-qr-generation-printable-sheet.md) (every intaken document becomes a QR target) and [a71-10 QR recognition on scanning surfaces](2026-07-04-a71-10-qr-recognition-scanning-surfaces.md) (the resolve-side of what this story creates). [a71-11 Private-document search & listing](2026-07-04-a71-11-private-doc-search-voice.md) depends on documents created here being indexed and scope-tagged correctly. [a71-12 Google Drive connector](2026-07-04-a71-12-google-drive-connector.md) adds a second intake source (Drive) that reuses the link-import path defined here — implement this story first. Epic A siblings (agent wiki + sync, `2026-07-04-a71-01..07-*.md`) are unrelated but share the same sprint; no file overlap expected.

## Problem / motivation

SKB has no concept of a "document" today — only editable pages built from blocks, and file attachments that exist solely as children of an existing page (`POST /api/pages/[id]/attachments`, `src/app/api/pages/[id]/attachments/route.ts`). There is no entry point for "I have a PDF/URL I want to file into the knowledge base as a first-class, searchable thing", no standard page shape for it, and no agent-facing endpoint to do the same programmatically. This blocks the two features the owner explicitly wants next: QR-code printing for physical documents (a71-09) and a Google Drive import flow (a71-12) — both need *something* to attach a QR to or land an imported file onto.

Today the closest existing building blocks are:
- `POST /api/pages/[id]/attachments` — uploads bytes to an *existing* page (50 MB/file cap enforced in the route via `MAX_FILE_SIZE`, and a per-tenant quota check via `wouldExceedQuota` against `Tenant.storageQuota`/`storageUsed`, see `src/lib/sync/attachments.ts`). It returns `{attachmentId, relativePath, url: "/api/attachments/{id}", fileName, fileSize, mimeType, markdown}`.
- `GET /api/attachments/[id]/route.ts` — the tenant-scoped, path-traversal-guarded serving route for those bytes (reads `FileAttachment.storagePath` under `MIRROR_ROOT`, resolves it, and 404s if it escapes the mirror root).
- `Page.spaceType` (`SpaceType` enum, default `PRIVATE`) plus `Page.teamspaceId` — the existing private-vs-team visibility axis, already used by `depthSearch`'s `scope: private|team|all` parameter (`src/lib/search/depthSearch.ts`, exercised by `GET /api/agent/search?scope=`).

None of this adds up to "create a document page." This story defines that page type and the two ways to create one.

## Proposed change

### 1. New `DOCUMENT` page kind
Documents are represented as ordinary `Page` rows (no new table) distinguished by a `kind` discriminator. Two implementation options, pick one during implementation review:
- (a) reuse `Page.icon`/`Page.oneLiner` conventions and add a new nullable `Page.sourceUrl String?` + `Page.docSource String?` (`upload|url|drive`) column via a Prisma migration, or
- (b) store the same metadata as a fixed-shape first block (`type: PROPERTIES` or similar) inside the page body, avoiding a schema migration.

Recommend (a): a Prisma migration is cheap here and a queryable column beats parsing block content every time doc-intake list/search needs it. Document pages get a standard body template on creation:

> **Privacy caveat (Round 1):** `Page.spaceType = PRIVATE` is **tenant-wide, not per-user** today — `Page` has no owner/creator column (verified against `prisma/schema.prisma`), and `depthSearch`'s `scope: 'private'` filters only `spaceType`. A document filed into "PRIVATE" space is therefore visible to every user in the tenant. Do **not** present the PRIVATE option with copy implying per-user privacy until a71-11's ownership gap (a new `Page` owner column + backfill) is resolved. Until then, "private" here means "not in a shared teamspace," nothing stronger.

```markdown
# <Title>

**Source:** <upload | link: URL | drive: fileId>
**Added by:** <user>
**Added:** <ISO date>
**Tags:** <comma list>

## Summary
<one paragraph, empty until the user or an agent fills it in>

## Notes
<free text>
```

**Enum & backfill (Round 2):** define `kind` as a closed enum (`page | document`) with `default: page`, and backfill existing rows via the migration rather than leaving the column nullable. A nullable `kind` with no default leaves every existing page `NULL`, which breaks the complement case ("all non-documents") and any future exhaustive `switch(kind)`, and risks a stale mirror/sync writer silently producing NULL-kind pages by omission.

**Search indexing requirement (Round 2):** `Block.search_vector` is populated by a Postgres trigger derived solely from `Block.plainText` (`prisma/migrations/20260221000000_add_search_vector/migration.sql`: `to_tsvector('english', COALESCE(NEW.plain_text,''))`). Whichever code path creates the document's body blocks (UI dialog or the agent endpoint in Section 4) MUST call `updateSearchIndex`/set `plainText` via `extractPlainText`, mirroring the existing patterns in `src/app/api/pages/[id]/blocks/route.ts:218`, `src/app/api/sync/experiments/route.ts:499`, and `src/app/api/pages/[id]/purge/route.ts:71`. Skipping this leaves `search_vector` empty and the document invisible to both FTS branches — confirmed as a live gap in the existing `POST /api/agent/pages` endpoint (`src/app/api/agent/pages/route.ts:257-272`), which the new `POST /api/agent/documents` must not repeat.

### 2. Upload path
New UI entry point "Add document" (page-tree context menu, alongside "New page"), which:
1. Creates a `Page` with `kind='document'`, `spaceType` per the owner's choice (`PRIVATE` or a `Teamspace` under Chemistry KB — same picker UX as any existing page-creation dialog), title defaulted to the filename.
2. Calls the *existing* `POST /api/pages/[id]/attachments` against the new page id to store the file (reuses the 50 MB/file, 5 GiB/tenant quota checks unmodified).
3. Inserts the returned `markdown` (an `![filename](relativePath)` reference, rendered via the existing `/api/attachments/[id]` serving route) into the page body under a new `## Attachment` section.

### 3. Link path
Same "Add document" entry point, second tab: paste a URL (SharePoint, Drive share link, arbitrary http(s)). Behavior:
1. Creates the same `Page(kind='document')` shape with `sourceUrl` set and `docSource='url'`.
2. Optionally fetches a snapshot: reuse the SSRF-guarded fetch pattern from companion's `parseProtocolQr.ts`/Epic-21 fetch step (allowlist http/https scheme only, no redirect-following into private IP ranges) — cite as the design pattern to port, not code to import directly (different repo/runtime). Snapshot text goes into the page body's `## Snapshot` section; failure to fetch just leaves the link with no snapshot (non-fatal). **Timeout + size cap (Round 2 — required, not optional):** the fetch MUST use a hard timeout (`AbortSignal.timeout`, a few seconds) and MUST stream-cap the response body (abort after ~1 MB) rather than buffering via `res.arrayBuffer()`/`res.text()`. Without both, any `skb_live_*` write-scoped key can trigger a DoS via a slow/tarpit URL (handler held open indefinitely) or a multi-GB response body (process OOM) — reachable at document-creation time with no quota accounting.
3. No snapshot fetch attempt for known non-fetchable domains (SharePoint requires auth) — those are stored as link-only with a `docSource='url', fetchable=false` flag in the metadata block.

### 4. Agent API variant
New endpoint `POST /api/agent/documents`, `withAgentAuth`-gated (write scope), body:
```json
{
  "title": "string",
  "space": "private" | "team",
  "teamspace_id": "string?",
  "source": "upload" | "url",
  "url": "string?",
  "tags": ["string"]
}
```
**Tenant validation (Round 2):** when `teamspace_id` is supplied, it MUST be verified to belong to `ctx.tenantId` before use (`prisma.teamspace.findFirst({ where: { id: teamspace_id, tenantId: ctx.tenantId } })`), mirroring the existing parent-page tenant check in `POST /api/agent/pages` (`src/app/api/agent/pages/route.ts:222-234`). Without this check a caller can supply another tenant's teamspace UUID and create a page that points at a foreign teamspace — a cross-tenant leak.

For `source: "upload"`, the agent flow is **three calls**, not two:
1. Create the document page via this endpoint.
2. `POST /api/pages/[id]/attachments` exactly as the UI does (agent API already supports multipart uploads to that route since it is not agent-auth-scoped separately — verify during implementation whether `attachments/route.ts` needs a `withAgentAuth` variant added, since it currently only accepts `withTenant` session auth, not `skb_live_*` keys). This is a likely gap: **flag it explicitly as an acceptance criterion below** rather than silently assuming agent-uploaded files work.
3. **Link the attachment into the page body (Round 2 — new required step).** The attachments route only persists the `FileAttachment` row and writes bytes to disk; it does NOT touch the page body (`src/app/api/pages/[id]/attachments/route.ts:117-146`). The UI's third step (insert the reference into the body under `## Attachment`) has no agent-side equivalent today. Pick one during implementation: (a) have the new agent-attachments route append the reference to the page body server-side, (b) add an agent PATCH endpoint for body updates, or (c) accept the file inline in `POST /api/agent/documents` and do the whole thing in one call. Without one of these, an agent-uploaded file is stored but never referenced in the page — it renders with no visible attachment, which does not satisfy "succeeds end-to-end" (AC4).

**Reference format correction (Round 2):** whichever step inserts the attachment reference into the body must use the route's `url` field (`/api/attachments/{id}`, browser-facing) — NOT its `markdown` field, which is a mirror-relative filesystem path (`./<dirPath>/assets/<file>`, see `src/lib/sync/attachments.ts:97`) that the editor cannot resolve against a page URL. `attachments/route.ts`'s own comment states editor nodes must reference the `url`, never the mirror-relative path (`attachments/route.ts:134-142`).

### 5. Search visibility
Plain FTS needs no new code: `kind='document'` pages with normal `Block` rows (title + summary + snapshot text) are picked up by the existing full-text search (`src/lib/search/query.ts` / the legacy branch of `GET /api/agent/search`) like any page. **But category filtering to `documents` requires a code change, contra an earlier draft of this section.** `depthSearch` derives a page's category from its **parent page's title** (`getPageCategory`, only `Experiments/Chemicals/Reaction Types/Researchers/Substrate Classes` map to a category; anything else → `null`), so a document page will get `category=null` and never match a `documents` filter no matter what is added to the route's allowlist. To make `category=documents` real:
- Add `documents` to `VALID_CATEGORIES` in `src/app/api/agent/search/route.ts` (note: that set is **camelCase** — `reactionTypes`, `substrateClasses` — while `depthSearch`'s internal `categoryMap` is **snake_case**; pick one convention and thread it consistently), AND
- Extend `depthSearch` with a `kind`-aware branch: when `category === 'documents'`, filter on `Page.kind === 'document'` directly instead of the parent-title heuristic.

The legacy (no-`depth`) branch of `GET /api/agent/search` has no category filter at all — if callers need `documents` filtering there too, that branch needs the same `kind` predicate added.

## Affected repos & files

**SymbioKnowledgeBase** (only repo touched):
- `prisma/schema.prisma` — add `kind`, `sourceUrl`, `docSource` columns to `Page` (or equivalent block-based encoding if option (b) chosen); new migration.
- `src/app/api/agent/documents/route.ts` — new agent-facing create endpoint. Must call `updateSearchIndex`/set `Block.plainText` when creating the DOCUMENT block (Round 2 finding 1); must validate `teamspace_id` against `ctx.tenantId` (Round 2 finding 3); must include or otherwise resolve the attachment-body-link step (Round 2 finding 2).
- `src/app/api/pages/[id]/attachments/route.ts` — extend auth to accept `withAgentAuth` in addition to `withTenant`, OR add a parallel `src/app/api/agent/pages/[id]/attachments/route.ts` (decide in review; the dual-auth-route pattern already exists elsewhere in SKB per `reference_scisymbiolens_kb_connection`-style dual auth — confirm precedent before choosing).
- `src/lib/chemistryKb/documentTemplate.ts` (new) — the standard document page template.
- `src/lib/documents/urlSnapshot.ts` (new) — SSRF-guarded fetch-and-snapshot helper.
- `src/app/api/agent/search/route.ts` — add `documents` to `VALID_CATEGORIES` (camelCase set).
- `src/lib/search/depthSearch.ts` — add a `kind`-aware branch so `category='documents'` filters on `Page.kind` directly (the current parent-title category heuristic will not classify document pages).
- UI: new "Add document" dialog component (exact location depends on where the existing page-tree "New page" action lives — locate and mirror during implementation).

## Out of scope
- QR generation/printing (a71-09).
- QR *recognition* of the resulting share URL (a71-10).
- Voice/agent search surfacing (a71-11) beyond making documents indexable.
- Google Drive as an import source (a71-12) — this story only defines the generic URL-link path Drive will reuse.
- OCR/content extraction beyond a best-effort text snapshot for fetchable URLs.
- Editing/deleting the source file once imported (that's the existing attachment/page lifecycle, unchanged).

## Acceptance criteria
1. A user can create a document page from an uploaded file via the UI; the page appears in the page tree under the chosen space (private or a named teamspace) with the standard template populated.
2. A user can create a document page from a pasted URL; if the URL is fetchable (http/https, non-private-IP), a snapshot section is populated; if not, the page still saves with a link-only body.
3. `POST /api/agent/documents` creates a document page given a valid `skb_live_*` write-scoped key; returns the new page id and, for `source:"url"`, the resolved page path.
4. Uploading a file to an agent-created document page succeeds end-to-end — this requires resolving the `attachments/route.ts` auth gap called out above, AND the uploaded file's `url` reference (not the mirror-relative `markdown` field) must be visible in the page body afterward (Section 4's required third step); the story is not done until an agent-key-only flow (no browser session) can create, attach, *and* have the attachment actually rendered in the page — not merely stored on disk with no body reference.
5. Document pages are returned by unscoped FTS search AND by `GET /api/agent/search?category=documents` — the latter requires the new `kind`-aware `depthSearch` branch (adding `documents` to `VALID_CATEGORIES` alone does nothing; verify a document page actually comes back under the filter, since its parent-title category is `null`). **The FTS check must assert a term from the body content (snapshot/template text), not just the title**, and passes only if the creating path (UI and agent) populates `Block.plainText`/calls `updateSearchIndex` — the existing `POST /api/agent/pages` endpoint does not do this today (`src/app/api/agent/pages/route.ts:257-272`) and the new endpoint must not repeat that gap.
6. Files >50 MB or uploads that would exceed the tenant's 5 GiB quota are rejected with the same error codes the existing attachments route already returns (no regression, just reuse).
7. A malicious/unsafe URL is rejected/guarded at creation time: `javascript:`/`file://` schemes rejected with a clear error, AND a fetchable-looking http(s) URL that resolves to a private range (`169.254.169.254`, `127.0.0.1`/loopback, RFC-1918) is blocked at fetch time (resolved-IP check, no redirect-following into private ranges) — not merely a scheme allowlist.
8. Supplying a `teamspace_id` that does not belong to the caller's tenant is rejected (mirrors the existing parent-page tenant check in `POST /api/agent/pages`); a document cannot be created against a foreign tenant's teamspace.
9. A snapshot fetch that hangs (no response within a few seconds) or streams an oversized body (>~1 MB) is aborted and treated as a non-fatal fetch failure (link-only page), not left open indefinitely or buffered without bound.
10. Existing pages (pre-migration) do not surface under `category=documents` — the `kind` migration backfills them to a non-document default (e.g. `page`), not `NULL`.

## Verification plan
- Unit tests: document-template rendering, URL scheme allowlist rejection (`file://`, `javascript:`), snapshot fetch timeout/failure handling.
- Integration test (Vitest, DB-guarded): `POST /api/agent/documents` with a mocked `skb_live_*` key → assert page row created with correct `kind`/`spaceType`; follow with an attachment upload against the same page id and assert it also succeeds under agent auth.
- Manual/UI check: create one upload-based and one link-based document via the "Add document" dialog; confirm both show up in the page tree, in the sidebar search, and via `curl -H "Authorization: Bearer skb_live_..." "http://localhost:3000/api/agent/search?q=<title>&category=documents"`.
- `npx tsc --noEmit`, `npx vitest run`, `npx prisma validate` per repo CLAUDE.md.

## Regression risks
- **Schema migration on `Page`**: adding nullable columns is additive and safe, but confirm no existing code path does `SELECT *`-style exhaustive field mapping that would break on new columns (check `src/lib/chemistryKb/setupHierarchy.ts` and any Prisma `select` literals that might need the new fields explicitly excluded from generic page listings so they don't leak into unrelated UI).
- **Agent-auth extension to the attachments route**: broadening `attachments/route.ts` to accept `withAgentAuth` risks accidentally granting agent keys upload rights on *any* page, not just document pages, if the auth check isn't scoped correctly — mitigate by checking `page.kind === 'document'` in the agent-auth branch, or by using a separate route path entirely (`/api/agent/pages/[id]/attachments`) so the blast radius of a bug is contained to the new route.
- **Search category filter**: adding `documents` to `VALID_CATEGORIES` must not change existing category-filtered queries' result sets for `experiments`/`chemicals`/etc. — add a regression test asserting counts for the pre-existing categories are unchanged after the migration.
- **URL snapshot fetch (SSRF)**: the fetch-on-create path is the main new attack surface in this story; mirror companion's documented scheme-allowlist-only approach and explicitly test `http://169.254.169.254/...` (cloud metadata endpoint) and `http://localhost:*` are rejected or at minimum not followed through redirects.
- **Quota check TOCTOU widened by agent intake (Round 2)**: `wouldExceedQuota` (read) then `adjustStorageUsed` (`{ increment }`) is not atomic (`src/app/api/pages/[id]/attachments/route.ts:94-128` + `src/lib/sync/attachments.ts:111-120`) — pre-existing, but this story's agent-driven bulk-import path makes concurrent uploads far more likely, widening the window where two concurrent uploads both pass the check and overshoot the 5 GiB quota. Acceptable to ship without fixing (AC6 only requires reuse of existing behavior), but call it out explicitly rather than silently inheriting it; consider wrapping check+write in a transaction with a `Tenant` row lock if hard quota enforcement becomes a requirement.

## Reviewer feedback

### Round 1 — Regression lens (Claude Opus fallback for the broken Codex CLI, 2026-07-04)

Reviewer note: this pass was performed by Claude Opus standing in for the Codex CLI reviewer, which is currently non-functional. Every cited path/route below was read in the working tree (which carries the uncommitted A70 changes) before the finding was written.

1. **BLOCKER — "PRIVATE space" is NOT per-user private; it is tenant-wide.** I read `src/lib/search/depthSearch.ts`: `scope: 'private'` resolves to `{ spaceType: 'PRIVATE' }` (lines 159-164) and the raw FTS SQL filters `AND p.space_type = 'PRIVATE'` (lines 201-205) — with **no user-ownership filter of any kind**. I then read the `Page` model in `prisma/schema.prisma`: it has **no owner/creator column at all** (only `deletedBy`; the `createdBy` that exists is on `PublicShareLink`, not `Page`). Consequence: a document you file into "PRIVATE" space is visible to *every other user in the same tenant* via `GET /api/agent/search?scope=private`. This story repeatedly describes the private option as if it were user-private ("the chosen space (private or a named teamspace)"). It is not. This directly breaks the mental model that a71-11 ("list *my* private documents") and a71-12 (per-user imports) build on. Do not ship copy or UX that implies a PRIVATE document is private to the creating user until the ownership gap (see a71-11 finding 1) is closed.

2. **MAJOR — `category=documents` will not work as this story claims; "No new search code needed" is false.** Section 5 says adding `documents` to `VALID_CATEGORIES` makes documents filterable. I read both search paths:
   - `depthSearch` derives a page's category from its **parent page's title** (`getPageCategory`, lines 55-99: only `Experiments/Chemicals/Reaction Types/Researchers/Substrate Classes` map to a category; everything else → `null`). A `kind='document'` page whose parent is a teamspace root or a private space (parentId null) gets `category=null` and will **never** match a `documents` filter.
   - The legacy branch of `GET /api/agent/search` (no `depth` param, `searchQuerySchema`) has **no category or scope filter at all** — it is pure FTS.
   - `VALID_CATEGORIES` in `src/app/api/agent/search/route.ts` uses **camelCase** (`reactionTypes`, `substrateClasses`), while `depthSearch`'s `categoryMap` uses **snake_case** (`reaction_types`). Adding `documents` must pick one and thread it consistently, and — critically — `depthSearch` must be taught to read the new `kind` column directly rather than inferring category from parent title. Rewrite section 5: documents become category-filterable only after `depthSearch` gains a `kind`-aware branch; adding the string to `VALID_CATEGORIES` alone is a no-op for actual filtering.

3. **MAJOR (confirmed real) — agent-key upload gap.** I read `src/app/api/pages/[id]/attachments/route.ts`: both GET and POST are wrapped in `withTenant` (session auth) only; there is no `withAgentAuth` path. So an `skb_live_*` key genuinely cannot upload — the story's flagged AC4 is a real gap, not a hypothetical. Keep it as a hard acceptance criterion. Note `storeAttachment` takes `ctx.userId`, and `withAgentAuth`'s `AgentContext` does provide `userId` (`src/lib/agent/auth.ts` line 8), so the agent branch can supply it. Recommended mitigation (separate `/api/agent/pages/[id]/attachments` route, `page.kind === 'document'` guard) is sound — prefer the separate-route option so a bug can't grant agent keys upload rights on arbitrary non-document pages.

4. **MINOR — Prisma 7 migration mechanics.** The client is generated to `src/generated/prisma` with the `@prisma/adapter-pg` driver adapter (see repo CLAUDE.md). Adding columns needs a migration **plus** `prisma generate`; the verification plan should run `npx prisma migrate dev` (or the repo's migration script) and regenerate the client, not just `npx prisma validate`. The `SELECT *`-leak concern in the regression section is low-risk (the routes I read use explicit `select`), but keep the check.

5. **MINOR — the SSRF snapshot fetch is the one genuinely new attack surface.** Good that it is flagged. The companion parser you cite (`parseProtocolQr.ts`) only allowlists the *scheme* — the actual SSRF gate (DNS/IP resolution, redirect handling) runs at fetch time in a separate step per that file's own header comment. So "mirror `parseProtocolQr.ts`" is insufficient; you must port the *fetch-time* guard (block RFC-1918 / `169.254.169.254` / loopback after DNS resolution, and do not follow redirects into private ranges), not just the scheme allowlist. Make AC7 test the resolved-IP block, not only the scheme block.

**Revisions applied (Round 1):**
- Section 1 (New `DOCUMENT` page kind): added a note that `SpaceType.PRIVATE` is tenant-wide today (no per-user ownership on `Page`) and that document UX must not imply per-user privacy until a71-11's ownership gap is closed.
- Section 5 (Search visibility): rewritten to state that `depthSearch` must gain a `kind`-aware branch (it infers category from parent title today) and to call out the camelCase-vs-snake_case category-key mismatch; "no new search code needed" softened to "no new *FTS* code, but category filtering requires a `depthSearch` change."
- Affected files: added `src/lib/search/depthSearch.ts` (kind-aware category branch) and noted the category-key convention decision.
- Acceptance criteria: AC5 reworded to require documents surface via a `kind`-aware filter; AC7 reworded to require a resolved-IP SSRF block (metadata endpoint + loopback + RFC-1918), not only a scheme check.
- Verification plan: added `prisma migrate` + `prisma generate` step.
- Open question for the owner (unfixable by editing this story): whether "private document" should mean per-user or tenant-wide — this is blocked on the a71-11 ownership decision and must be resolved before the intake UI ships a "private" option.

### Round 2 — GLM-5.2 runtime lens (2026-07-04)

1. **BLOCKER — Agent-created document pages will be invisible to FTS; "no new FTS code" is false at runtime.** The `search_vector` column is populated by a Postgres trigger that derives solely from `blocks.plain_text` (`prisma/migrations/20260221000000_add_search_vector/migration.sql`: `NEW.search_vector := to_tsvector('english', COALESCE(NEW.plain_text,''))`). Every block-creation path that needs to be searchable explicitly sets `plainText` via `extractPlainText`/`updateSearchIndex` — `src/app/api/pages/[id]/blocks/route.ts:218`, `src/app/api/sync/experiments/route.ts:499`, `src/app/api/pages/[id]/purge/route.ts:71`. The existing agent page-create path does NOT: `POST /api/agent/pages` (`src/app/api/agent/pages/route.ts:257-272`) creates the DOCUMENT block with `content: tiptap` only — no `plainText`, no indexer call. So a document made via the new `POST /api/agent/documents` will have an empty `search_vector` and will not match either the legacy FTS branch (`b.search_vector @@ websearch_to_tsquery`, `src/app/api/agent/search/route.ts:149-164`) or depthSearch Step 2 (`src/lib/search/depthSearch.ts:223`) — only title/oneLiner ILIKE will find it. AC5 ("returned by unscoped FTS search") and Section 5's "Plain FTS needs no new code" both fail at runtime. Fix: the new endpoint MUST call `updateSearchIndex(blockId, tiptap)` (or set `plainText: extractPlainText(tiptap)`) when creating the DOCUMENT block, and AC5 must assert a *content* term (from the snapshot/template body, not the title) is findable via FTS.

2. **MAJOR — The agent upload flow is missing the body-link step; AC4 is underspecified.** Section 4 defines the agent upload flow as "two calls": create the document page, then `POST /api/pages/[id]/attachments`. But the attachments route only persists the `FileAttachment` row and writes bytes to disk — it does NOT touch the page body (`src/app/api/pages/[id]/attachments/route.ts:117-146`). The UI does three things: create → upload → insert the returned markdown reference into the body. No third step is defined for the agent (the documents endpoint accepts no file, and no agent body-update endpoint is specified). Result: an agent-uploaded file is stored but never referenced in the page, so the document renders with no visible attachment — contradicting "succeeds end-to-end". Fix: either have the new agent-attachments route append the markdown to the page body server-side, define an agent PATCH for body update, or accept the file inline in `/api/agent/documents`.

3. **MAJOR — `teamspace_id` is not validated against the tenant (cross-tenant leak).** The `POST /api/agent/documents` body accepts `teamspace_id?` (Section 4), but neither the section, the affected-files list, nor any AC requires verifying it belongs to `ctx.tenantId`. Per repo CLAUDE.md, tenant isolation is per-query, not a DB policy, and `Page.teamspaceId` is a bare FK. A caller supplying another tenant's teamspace UUID would create a page in `ctx.tenantId` pointing at a foreign teamspace. Contrast `POST /api/agent/pages` which DOES verify the parent belongs to the tenant (`src/app/api/agent/pages/route.ts:222-234`). Fix: mirror that check for teamspace (`prisma.teamspace.findFirst({ where: { id: teamspace_id, tenantId: ctx.tenantId } })`) and add an AC.

4. **MAJOR — Snapshot fetch has no timeout and no response-size cap → DoS from any write-scoped key.** AC7 adds resolved-IP SSRF blocking but is silent on the two other runtime failure modes of an outbound fetch performed in-request: (a) a non-private-range URL that hangs (slow SharePoint, tarpit) with no `AbortController`/`AbortSignal.timeout` will hold the handler open until the platform kills it; (b) a non-private-range URL streaming a multi-GB body, if buffered via `await res.arrayBuffer()`/`res.text()`, OOMs the process. Both are reachable by any `skb_live_*` write key with no quota accounting. Fix: fetch with a hard timeout (a few seconds) AND stream-cap the body (abort after ~1 MB), and keep snapshot failure non-fatal (already the design). Add an AC for both.

5. **MAJOR (MINOR if pinned) — `kind` default/backfill is unspecified.** The migration adds `Page.kind`, but the story never pins the default, the enum domain, or the backfill for existing rows. If `kind` is nullable with no default, every existing page gets NULL; the depthSearch kind-aware branch (`Page.kind === 'document'`) still works, but the complement ("all non-documents") and any future `switch(kind)` are non-exhaustive, and a stale mirror/sync writer that doesn't set `kind` would silently produce NULL pages. Fix: define a closed enum (`page | document`, default `page`) in `prisma/schema.prisma` and backfill existing rows in the migration. Add an AC: existing pages do NOT surface under `category=documents`.

6. **MINOR — `markdown` field is the mirror-relative path, not `/api/attachments/{id}`.** Section 2 says insert the route's `markdown` field `![file](relativePath)` "rendered via the existing `/api/attachments/[id]` serving route". That conflates two fields the route returns: `url: /api/attachments/{id}` (browser-facing) vs `markdown: ![file](./<dirPath>/assets/<file>)` (mirror-relative filesystem path, `src/lib/sync/attachments.ts:97`). The route's own comment says editor nodes reference the `url`, "never the mirror-relative path" (`attachments/route.ts:134-142`). If the implementation inserts the `markdown` field into the page body, the editor likely cannot resolve `./<dirPath>/assets/...` against the page URL and will render a broken image. Fix: confirm which reference the editor resolves, or insert the `url` form into the body.

7. **MINOR — Quota TOCTOU is inherited and amplified by the new agent intake path.** `wouldExceedQuota` (read Tenant) then `adjustStorageUsed` (`{ increment }`) is not atomic (`src/app/api/pages/[id]/attachments/route.ts:94-128` + `src/lib/sync/attachments.ts:111-120`); two concurrent uploads can both pass and overshoot the 5 GiB quota. Pre-existing, but the new agent intake surface makes concurrent bulk imports more likely. AC6 ("no regression, just reuse") is acceptable; just note that agent-driven parallel intake widens the window, or wrap check+write in a transaction with a Tenant row lock if hard quota enforcement is desired.

**Revisions applied (Round 2):**
- Section 1 (New `DOCUMENT` page kind): added the closed-enum + default + backfill requirement for `kind`, and the search-indexing requirement (`plainText`/`updateSearchIndex`) for whichever path creates the document's body blocks.
- Section 3 (Link path), step 2: added the required fetch timeout (`AbortSignal.timeout`) and ~1 MB stream cap, since AC7's SSRF guard alone doesn't stop a hanging or oversized response.
- Section 4 (Agent API variant): added the `teamspace_id` tenant-ownership validation requirement; expanded the agent upload flow from two calls to three (added the required body-link step, since the attachments route never touches the page body); added the `url`-vs-`markdown` reference-format correction.
- Affected files: annotated the `agent/documents/route.ts` bullet with the three Round 2 requirements (search index, tenant validation, body-link step).
- Acceptance criteria: AC4 extended to require the attachment is actually referenced in the body (not just stored); AC5 extended to require a content-term FTS match backed by populated `plainText`; added AC8 (teamspace tenant validation), AC9 (snapshot fetch timeout + size cap), AC10 (kind backfill, pre-migration pages excluded from `category=documents`).
- Regression risks: added a note that the pre-existing quota-check TOCTOU is widened by this story's agent-driven bulk-intake path.
- Round 2 supersedes no Round 1 finding — all Round 1 fixes remain valid; Round 2 adds runtime-level gaps Round 1 didn't reach (search indexing, body-linking, tenant validation, fetch DoS, enum backfill, field-name correctness).

## Implementation notes (2026-07-05)

**Scope decision — backend implemented, UI dialog deferred.** This pass ships
the full agent-API-facing backend (schema, create endpoint, agent attachment
endpoint, SSRF-guarded snapshot fetch, `depthSearch` category support, serving
route) plus unit tests. It deliberately does **not** build the "Add document"
UI dialog (AC1/AC2's UI half) — that requires locating and safely extending
the existing page-tree "New page" context menu (`Sidebar.tsx`/
`DndSidebarTree.tsx`) with new tab UI, and the story's own verification plan
already treats the UI as a manual/browser check, not an automated one. Building
it needed more exploration + browser verification than this pass covered, and
risked an unreviewed regression in existing page-tree UX. Flagging this
explicitly rather than silently skipping it — the owner should decide whether
a follow-up story covers the dialog, or whether an agent-API-only intake path
is sufficient for now (a71-09/a71-12 both only need the API surface, not the
dialog, to proceed).

**Reality-check on the story's Section 1 "existing building blocks" claim:**
`GET /api/attachments/[id]/route.ts` did **not** exist in this branch before
this story (verified by search) — the session-auth `POST
/api/pages/[id]/attachments` route only ever returned `{attachmentId,
relativePath, markdown}`, with no `url` field and no serving route to resolve
it against. This story adds that serving route (`src/app/api/attachments/[id]/route.ts`,
tenant-scoped via `withTenant`, path-traversal-guarded) since a resolvable
`url` is required for AC4. Also worth noting: `withTenant`'s `getTenantContext`
already resolves `skb_` API keys (with precedence over session cookies) —
so the story's "agent keys can't hit the session route at all" framing is not
quite right. The real gap is that `withTenant` doesn't enforce read/write
*scopes* and has no `page.kind` restriction, which is why this story still
builds the separate `withAgentAuth`-gated route rather than patching the
shared session route (per the story's own regression-risk mitigation).
Similarly, the story's regression-risk section references a `wouldExceedQuota`/
tenant-quota check on the attachments path that does not exist in this
branch's `src/lib/sync/attachments.ts` — only the 50MB/file cap is real today.
AC6 is satisfied by reusing that cap; building tenant-quota enforcement from
scratch would be scope creep for a different story.

**What a71-09 (QR) and a71-12 (Drive) build on:**
- Document pages are `Page` rows with `kind: 'DOCUMENT'`, `sourceUrl`,
  `docSource` (`'upload' | 'url' | 'drive'`) — `'drive'` is reserved,
  unused by this story, ready for a71-12 to set.
- The identifier to encode into a QR (a71-09) is the page id (`page.id`,
  returned as `data.id` from `POST /api/agent/documents`); the existing
  page-resolution/share-link machinery already resolves a page id to a route,
  so a71-09 doesn't need a new resolution path — just a QR encoding of
  `<base-url>/page/<id>` or similar, TBD by that story.
- a71-12 (Drive) reuses `POST /api/agent/documents` with `source: "url"` and
  a Drive share URL — `fetchUrlSnapshot`'s SSRF guard, timeout, and size cap
  apply unchanged; Drive's own auth for private files is a separate concern
  a71-12 will need to handle (this story's snapshot fetch has no
  authentication, so private Drive URLs will simply fail to fetch and fall
  back to link-only, which is the existing non-fatal behavior).
- Search: `GET /api/agent/search?depth=default&category=documents` (or
  `medium`/`deep`) returns document pages via the new `kind`-aware
  `depthSearch` branch; unscoped FTS (`GET /api/agent/search?q=...`, no
  `depth`) also finds them since `plainText` is populated at creation time.
