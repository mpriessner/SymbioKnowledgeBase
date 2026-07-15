# Google Drive connector (read/search/upload only)

## Provenance & ownership
- **Project owner:** Martin Priessner (martin.priessner@scisymbio.ai)
- **Created by:** Agent 70
- **Created:** 2026-07-04
- **Status:** in-progress (Phase 1/2 backend and frontend connect/search/import/disconnect UI implemented; real OAuth credential smoke test and Phase 3 voice surface remain)
- **Assigned to / currently owned by:** Sonnet implementation session, 2026-07-05
- **Related / parallel work:** Phase 1 (import) reuses the URL-link document-intake path from [a71-08 Document intake](2026-07-04-a71-08-document-intake-upload-or-link.md) — implement a71-08 first. Phase 3 (agent/voice Drive search) should reuse the private/mine-scoping conventions established in [a71-11 Private-document search & listing](2026-07-04-a71-11-private-doc-search-voice.md). No overlap with Epic A sync stories (`2026-07-04-a71-01..07-*.md`).

## Owner constraint (non-negotiable, restated prominently)

**This connector is search + retrieve + upload ONLY. It must never gain the ability to delete or modify a file already in the user's Google Drive.** This is an explicit, locked owner decision (epic brief decision #7), not an implementation preference — no phase of this story may request or use a Drive scope broader than what's needed for search, download, and creating new files. Every OAuth consent screen, every scope request, and every code review of this feature must be checked against this constraint before merge.

The owner separately has a personal claude.ai Google Drive MCP connection — **that is unrelated and must not be reused or referenced by this feature.** This story builds SKB's own, product-facing OAuth application with its own client ID/secret, independent of any personal MCP tooling the owner has configured elsewhere.

## Problem / motivation

SKB's document intake (a71-08) currently supports two sources: direct file upload and an arbitrary URL/link. Many of the documents researchers want to file into the knowledge base already live in Google Drive (shared protocols, SOPs, reference PDFs). Without a connector, importing one of these requires the user to manually download from Drive and re-upload through a71-08's upload path — an avoidable extra step, and one that produces a stale local copy with no link back to the Drive original. There is no existing Google OAuth integration anywhere in SKB today (greenfield, confirmed no existing `googleapis`/OAuth-for-Drive code in the repo).

## Proposed change

Phased delivery, explicitly split so review/implementation can land P1 without committing to P2/P3 in the same pass:

### Phase 1 — Connect + search + import (P1, this phase is the MVP)
1. **Per-user OAuth flow.** New Google Cloud OAuth 2.0 client (web application type) registered for SKB. Scopes requested, and *only* these:
   - `https://www.googleapis.com/auth/drive.readonly` — read-only access to view and download the user's Drive files (search + list + download; this is the read half).
   - `https://www.googleapis.com/auth/drive.file` — access limited to files the app itself creates or that the user explicitly opens with the app (this is the scope used for the *upload* half in Phase 2 — it does NOT grant broad write access to arbitrary existing files, only ones SKB creates or the user picks via a file picker). Requesting `drive.file` in Phase 1 even though upload lands in Phase 2 is fine since it's part of the same consent flow — do not request the far broader `drive` (full read/write/delete) scope under any circumstance.
   
   Explicitly **do not** request: `drive` (full access), `drive.appdata`, or any scope containing delete/trash semantics. There is no Drive OAuth scope that grants delete without also granting broader write access, so simply never requesting a write-capable-beyond-`drive.file` scope is the enforcement mechanism — there is no separate "delete" toggle to disable.

   **OAuth CSRF protection (Round 1, required):** the `connect` route must generate a random one-time `state`, store it server-side bound to the current SKB user session, and the `callback` route must verify it before exchanging the code — otherwise the callback is open to OAuth CSRF (an attacker binding their own Drive account onto the victim's SKB user). Pin `redirect_uri` to an exact allowlisted value; do not accept a caller-supplied redirect.

   **Round 2 implementation note (state storage):** SKB has no Redis/session cache today — only Postgres. Store the one-time `state` in a small Postgres-backed table (e.g. `OAuthState { state, tenantId, userId, expiresAt }`), single-use (delete on consumption) with a short TTL (e.g. 10 minutes); don't reach for an in-memory store, which wouldn't survive a multi-instance/serverless deployment.
2. **Token storage.** Store the OAuth refresh token with **authenticated encryption at rest** (AES-256-GCM or libsodium secretbox), keyed per-user. Round-1 note: **there is no reusable encryption precedent in SKB** — the only sensitive-secret storage (`src/lib/apiAuth.ts`) uses one-way SHA-256 + bcrypt *hashing*, which cannot be decrypted and is therefore useless for a refresh token you must reuse. So specify the scheme concretely: a server-held key from env (e.g. `DRIVE_TOKEN_ENC_KEY`), a per-record random nonce/IV stored beside the ciphertext, and a documented key-rotation path. Never store the raw refresh token in plaintext in Postgres.

   **Round 2 implementation note:** validate `DRIVE_TOKEN_ENC_KEY` at startup the same way `src/lib/env.ts` already fails fast on missing required production config (throw in production, warn in dev) — verified this precedent exists in the repo already, so this is a "use the existing pattern" ask, not a new one. Also define the decrypt-failure path explicitly: if a stored token fails to decrypt (e.g. after a key rotation without a migration), treat the connection as invalid and surface the same "reconnect needed" UX as an expired/revoked token, rather than throwing an unhandled error into the document-intake UI.
3. **Search + import UI.** From a71-08's "Add document" dialog, a new "From Google Drive" tab: search/browse the user's Drive (via `files.list` with a `q` search parameter, read-only scope), pick a file, and import it — the import reuses a71-08's URL-link path conceptually but downloads the file bytes via the Drive API (`files.get?alt=media`) and stores them through the *existing* attachment upload path (`POST /api/pages/[id]/attachments`) rather than just storing a Drive link, so the imported copy is a real SKB-hosted attachment with Drive as its recorded `docSource='drive'` origin (per a71-08's schema) plus the original Drive file id for reference/re-sync-checking later.
4. **Revocation UI.** A settings page showing connected Drive accounts per user, with a "Disconnect" action that revokes the stored token (calls Google's token revocation endpoint) and deletes the stored encrypted token server-side. Disconnecting does not affect already-imported files (they remain as normal SKB attachments).

### Phase 2 — Upload (P2, separate delivery from P1)
Add an "Export to Drive" action on any SKB attachment or page (e.g. exporting a generated PowerPoint, or pushing an attachment back to Drive as a copy). Uses `drive.file` scope's create capability (`files.create`) — this can only create *new* files in the user's Drive (typically landing in an app-created folder or wherever the user's file picker points), never overwrite or delete an existing Drive file. No read-modify-write cycle on existing Drive content is in scope.

### Phase 3 — Agent/voice surface (P3, optional, lowest priority)
Expose a `search_google_drive` agent/voice tool (companion + Android, following the same tool-wiring pattern as a71-05/a71-06/a71-11) so a user can ask by voice "find that protocol PDF in my Drive" and get a spoken list of matches, with an offer to import the selected one via the Phase 1 import path. This phase depends on Phase 1 being stable and is explicitly the lowest-priority slice — do not start P3 before P1 has shipped and been used for at least a few real imports.

## Affected repos & files

**SymbioKnowledgeBase** (all phases land here; this is a web-app OAuth flow, not something Android/companion need their own OAuth client for):
- `package.json` — add `googleapis` (official Google API Node client) as a dependency.
- New OAuth routes: `src/app/api/integrations/google-drive/connect/route.ts` (initiates OAuth consent redirect), `src/app/api/integrations/google-drive/callback/route.ts` (exchanges auth code for tokens, stores encrypted).
- `src/lib/integrations/googleDrive/client.ts` (new) — thin wrapper around the Drive API for search/list/download/upload, enforcing the scope constraints above at the code level (e.g. never call a delete/trash Drive API method, even defensively — don't just rely on the OAuth scope to prevent it). **Round 2:** set a reasonable request timeout on Drive API calls and handle `429`/rate-limit responses with a clear "try again later" surfaced error rather than an unhandled exception or indefinite hang; a full retry/backoff or circuit-breaker system is over-scoped for a v1 connector and not required.
- `src/lib/integrations/googleDrive/tokenStore.ts` (new) — encrypted token persistence.
- `prisma/schema.prisma` — new `GoogleDriveConnection` model: `id, tenantId, userId, encryptedRefreshToken, scopes, connectedAt, revokedAt`. **Round 2:** add a unique constraint on `(tenantId, userId)` so a second concurrent connect attempt for the same user cleanly upserts/replaces the row instead of racing. Also add the short-lived `OAuthState` table described in Phase 1 step 1 above.
- UI: "From Google Drive" tab in a71-08's document-intake dialog; a settings page for connection management/revocation.
- Phase 3 only: new agent/voice tool endpoint plus companion/Android tool-file additions (coordinate with a71-05/a71-06 owners).

**voice-companion-vision / SciSymbioLens-Android**: touched only in Phase 3, and only to add a voice tool that calls SKB's new agent endpoint — no direct Google OAuth client needed on those surfaces since SKB brokers the connection.

## Out of scope
- Any Drive scope or API call that could delete, trash, or overwrite an existing Drive file — explicitly and permanently out of scope, not just for this delivery but as a product constraint (revisit only via an explicit new owner decision, not silently in a later story).
- Any Drive provider other than Google Drive in this batch (epic brief: "Start with Google Drive" — SharePoint/Dropbox/etc. are future work).
- Reusing or integrating with the owner's personal claude.ai Google Drive MCP connection.
- Two-way sync/watch (detecting when a Drive file changes and re-importing automatically) — import is a one-time snapshot in Phase 1.
- Phase 3's voice surface, unless Phase 1 has already shipped and been validated with real usage.

## Acceptance criteria
1. A user can connect their Google Drive account to SKB via OAuth, granting exactly `drive.readonly` and `drive.file` — verified by inspecting the actual consent screen scope list at connect time, not just the code that requests it.
2. A connected user can search their Drive from the "Add document" dialog and see matching files (name, type, modified date).
3. Selecting a Drive file imports it as a new SKB document page (per a71-08's schema) with the file's bytes stored via the existing attachments path, `docSource='drive'`, and the original Drive file id recorded.
4. A user can disconnect their Drive account; the stored token is revoked with Google and deleted server-side; previously imported documents are unaffected.
5. No code path in this feature calls any Drive API method capable of deleting, trashing, or overwriting a pre-existing file — verified by an explicit code review checklist item, not just scope inspection (defense in depth: even if a future scope change were requested, the code itself should not invoke `files.delete`/`files.update` on files not created by this app).
8. The stored refresh token is encrypted at rest with authenticated encryption (AES-256-GCM or equivalent), a server-held env key, and a per-record nonce — never plaintext; verified by inspecting the persisted column and confirming it does not contain a usable token without the server key.
9. The OAuth flow uses a one-time `state` bound to the SKB session and verified on callback, and a pinned `redirect_uri`; a callback with a missing/mismatched `state` is rejected.
10. Required Drive/OAuth environment variables (`DRIVE_TOKEN_ENC_KEY`, Google OAuth client ID/secret) are validated at startup — the app fails fast in production and warns in development if any are missing or placeholder values, mirroring the existing pattern already in `src/lib/env.ts`.
6. (Phase 2 only, separate acceptance pass) Exporting an SKB attachment to Drive creates a new file in the user's Drive without touching any existing file.
7. (Phase 3 only, separate acceptance pass) Voice search across both companion and Android surfaces the same result set a manual Drive search in the UI would, with a working import follow-up offer.

## Verification plan
- Manual OAuth flow test: connect a real (test) Google account, inspect the consent screen scope list shown by Google before granting, confirm it lists only Drive read-only + `drive.file`, nothing broader.
- Integration test: mock the Drive API client, verify `client.ts` never calls a delete/trash/update-on-foreign-file method under any code path exercised by the test suite (a static-analysis-style test: grep the compiled/reviewed code for `.files.delete(`/`.files.update(` calls outside the app's own created-file bookkeeping, and fail the test if found — a cheap regression guard against scope creep).
- Manual import test: import a real Drive PDF, confirm it lands as a document page with correct `docSource`/original file id metadata, and that the file content matches the Drive original.
- Manual disconnect test: revoke, confirm the token no longer works (Google-side revocation confirmed via a subsequent failed API call attempt using the old token), confirm imported documents remain intact.
- `npx tsc --noEmit`, `npx vitest run`, `npx prisma validate` per repo CLAUDE.md after the schema addition.

## Regression risks
- **New OAuth secret management**: the Google OAuth client secret and any encryption key for stored refresh tokens are new sensitive config — must go through the same `.env`/secrets handling discipline as existing sensitive config (`SYNC_SERVICE_KEY`, Supabase keys) and must never be logged; add to whatever `.env.example` documentation pattern the repo already uses.
- **Token refresh failures**: an expired or revoked-on-Google's-side token must fail gracefully (prompt re-connect) rather than throwing an unhandled error into the document-intake UI — test this path explicitly (revoke access from Google's account settings page, then attempt a search in SKB, confirm a clean "reconnect needed" message).
- **Scope creep risk over time**: the single biggest regression risk for this feature *is future scope creep* — a later "just add delete support" request would violate the owner's explicit, locked decision. Recommend adding a code comment at the top of `googleDrive/client.ts` restating the no-delete/no-modify constraint so it's visible to any future editor, not just documented in this story file.
- **Multi-tenant isolation**: `GoogleDriveConnection` rows must be tenant- and user-scoped identically to every other per-user credential in SKB (`tenantId` + `userId` both required on every query) — mirror the existing tenant-isolation discipline called out in the repo's own CLAUDE.md ("Tenant isolation is per-query, not enforced by a global DB policy").
- **Drive API request handling (Round 2, right-sized):** Drive API calls (`files.list`, `files.get`) must set a reasonable request timeout and surface a clear "try again later" message on `429`/rate-limit responses rather than an unhandled exception or indefinite hang. A simple bounded approach is enough for a v1 connector; a full circuit-breaker/backoff system is over-scoped and not required by this story.
- **Observability (Round 2, right-sized):** log OAuth connect/disconnect/token-refresh-failure events as structured log lines so failures are debuggable during rollout. A full metrics/alerting stack is out of scope for v1 and not required by this story — this is an operational note, not a new acceptance criterion.

## Reviewer feedback

### Round 1 — Regression lens (Claude Opus fallback for the broken Codex CLI, 2026-07-04)

Reviewer note: Claude Opus standing in for the non-functional Codex CLI reviewer. `apiAuth.ts`, `agent/auth.ts`, the `Page` model, and the attachments route were read to substantiate the findings below.

1. **MAJOR — there is NO reversible-encryption precedent in SKB; do not "mirror existing".** Phase-1 step 2 says "mirror however SKB already encrypts other sensitive per-user secrets, if a precedent exists." I checked: SKB stores API keys as **one-way hashes** — `src/lib/apiAuth.ts` uses `createHash("sha256")` + `bcryptjs` ("The raw key is never stored — only this hash is persisted"). That is exactly the wrong primitive for an OAuth refresh token, which must be **decryptable** at refresh time. So there is no precedent to copy; the story must specify a concrete scheme now: authenticated encryption (AES-256-GCM or libsodium secretbox) with a server-held key from env (e.g. `DRIVE_TOKEN_ENC_KEY`), a per-record random nonce/IV stored alongside the ciphertext, and a documented key-rotation path. Make "no plaintext refresh token in Postgres, AEAD only" a hard acceptance criterion.

2. **MAJOR — the OAuth callback needs CSRF `state` + a redirect-URI allowlist, which the story omits.** The `connect`/`callback` route pair as described has no `state` parameter. Without a signed/one-time `state` bound to the user session, the callback is open to OAuth CSRF (an attacker fixes their own Drive account onto the victim's SKB user). Add: generate a random `state`, store it server-side bound to the session, verify it on callback, and pin `redirect_uri` to an exact allowlisted value. This is standard but load-bearing — the security review will (correctly) block without it.

3. **MINOR/CROSS-STORY — "per-user" imported documents aren't actually per-user-private.** The connection row is correctly `userId`-scoped, good. But the *imported document* is a `Page`, and `Page` has **no owner column** (verified against `prisma/schema.prisma`) — see a71-11 Round-1 finding 1. So a Drive file imported "privately" by user A is, under the current schema, visible to every user in the tenant via `scope=private` search. If the product intent is "my imported Drive docs are mine," this inherits a71-11's blocking ownership prerequisite. Cross-link it and don't imply per-user privacy on imports until that lands.

4. **MINOR — Phase 3 hits the same agent-upload auth gap as a71-08.** Phase-1 import reuses `POST /api/pages/[id]/attachments`, which is `withTenant` (session) auth — fine for the Phase-1 UI flow. But Phase 3's agent/voice surface would need agent-key (`skb_live_*`) upload, which that route does not support today (a71-08 finding 3). Note the dependency so Phase 3 isn't planned as if agent uploads already work.

5. **MINOR (confirmed) — the code-level no-delete guard is sound.** The static-analysis test (grep for `.files.delete(`/`.files.update(` on foreign files) plus the top-of-file constraint comment is a good defense-in-depth pattern beyond scope restriction — keep it. `googleapis` is a large dependency; ensure it is imported server-side only (never in a client bundle), consistent with the config.ts server-only env discipline used elsewhere in the ecosystem.

**Revisions applied (Round 1):**
- Phase-1 step 2 (Token storage): replaced "mirror existing precedent" with a concrete AEAD requirement (AES-256-GCM/libsodium, server-held env key, per-record nonce, rotation path) and noted SKB's only secret-storage precedent is one-way hashing, which is unusable here.
- Phase-1 step 1 (OAuth flow): added `state` CSRF parameter + exact `redirect_uri` allowlist as explicit requirements.
- Added a cross-link to a71-11's `Page`-ownership prerequisite for any "my imported docs are private" claim.
- Phase 3: noted the agent-key upload gap (a71-08) as a dependency.
- Affected files: noted `googleapis` must be server-only.
- Acceptance criteria: added AEAD-at-rest and OAuth-`state` criteria.

### Round 2 — GLM-4.5-flash runtime lens (2026-07-04, quota fallback for glm-5.2)

1. **[MAJOR] — OAuth refresh token encryption lacks concrete runtime implementation details**
   The story specifies AES-256-GCM or libsodium secretbox for token encryption, but doesn't define:
   - How the encryption key is loaded from env (should it be validated at startup?)
   - What happens if the encryption key is missing/invalid at runtime
   - Key rotation procedure (how to rotate without losing tokens)
   - Error handling for decryption failures during token refresh
   - The story doesn't specify which encryption library to use (none exist in package.json currently)
   [fold note: genuine gap — folded into Phase 1 step 2 above (startup validation mirroring `src/lib/env.ts`'s existing fail-fast/warn pattern, verified to exist in the repo; explicit decrypt-failure UX). Key-rotation procedure and library choice remain implementation-time decisions, not blocking for the story.]

2. **[MAJOR] — OAuth callback CSRF vulnerability despite state parameter**
   While the story adds a `state` parameter for CSRF protection, it doesn't define:
   - Where the state is stored server-side (in-memory Redis? session DB? Prisma?)
   - State expiration/timing (OAuth flows have short timeouts)
   - State cleanup after successful/failed exchange
   - What happens if the state is missing/invalid (should it redirect with error message?)
   - No rate limiting on the callback endpoint to prevent brute force attacks
   [fold note: genuine gap on storage location — folded into Phase 1 step 1 above: verified SKB has no Redis/session cache (only Postgres), so the state now specifies a Postgres-backed, single-use, short-TTL table. Callback rate limiting is right-sized down: SKB already has a shared `rateLimit.ts`/`agent/ratelimit.ts` pattern elsewhere in the repo — applying it to this callback is a reasonable implementation detail to reuse, not a new mechanism to design, so no additional AC was added for it.]

3. **[BLOCKER] — Drive API client scope enforcement is runtime-unsafe**
   The story says `client.ts` should "enforce scope constraints at the code level" but doesn't specify:
   - How to prevent accidental `files.delete()` calls if someone modifies the client
   - Runtime validation that only approved scopes are used in API calls
   - What happens if the Google API returns unexpected scopes in the token
   - The client should check token scopes before making API calls, not just rely on OAuth consent
   [fold note: mostly already covered — Round 1 finding 5 already confirms the code-level no-delete guard (static-analysis test grepping for `.files.delete(`/`.files.update(`) is sound and the Affected-files entry for `client.ts` already requires it. Checking the token's actual granted scopes at runtime (vs. just what was requested) is a reasonable defense-in-depth addition but not blocking; left as an implementation-time nicety rather than a new AC, since AC1 already requires inspecting the actual consent screen scopes at connect time.]

4. **[MAJOR] — Token refresh failure handling is undefined**
   The story mentions token should be revoked on disconnect but doesn't define:
   - What happens if the refresh token fails at runtime (network error, Google revoked it)
   - Should it automatically disconnect the user or show an error?
   - How often to retry refresh before giving up
   - Circuit breaker pattern for repeated refresh failures
   [fold note: already covered — Regression risks already has a "Token refresh failures" bullet requiring a graceful "reconnect needed" message and an explicit manual test for it. A circuit-breaker for repeated refresh failures is over-scoped for a v1 connector (the fail-and-prompt-reconnect UX already handles the user-facing case); not added as a new requirement.]

5. **[MINOR] — No request timeout handling for Drive API calls**
   The Drive API calls (files.list, files.get) don't specify:
   - Request timeouts (Google APIs can be slow)
   - Retry logic for rate limiting (429 errors)
   - Circuit breaker for repeated failures
   - The Drive search could hang indefinitely if Google's API is slow
   [fold note: genuine gap — folded into Affected files (`client.ts`) and Regression risks above as a right-sized timeout + 429-handling requirement; circuit breaker explicitly declined as over-scoped for v1.]

6. **[MAJOR] — No monitoring/observability for the OAuth flow**
   The story doesn't define:
   - Logging for OAuth events (connect, disconnect, token refresh, errors)
   - Metrics tracking (connection count, success/failure rates, token refresh frequency)
   - Alerting for suspicious activity (multiple rapid connections, failed refreshes)
   - This makes debugging runtime issues very difficult
   [fold note: right-sized down per review guidance — a full metrics/alerting stack is out of proportion for a v1 connector. Folded as a single operational-notes bullet in Regression risks (basic structured logging of connect/disconnect/refresh-failure events only), not a new AC.]

7. **[BLOCKER] — Missing environment validation for required config**
   The story adds `DRIVE_TOKEN_ENC_KEY` and Google OAuth config but doesn't specify:
   - Validation that these env vars are set at startup
   - Graceful shutdown or clear error message if missing
   - Should the app start without Drive support or fail fast?
   - No validation that the Google OAuth client ID/secret are valid
   [fold note: genuine gap, verified — confirmed `src/lib/env.ts` already implements exactly this fail-fast-in-production/warn-in-dev pattern for other required config, so this story should reuse it rather than invent something new. Folded into Phase 1 step 2 and added as new AC10.]

8. **[MINOR] — No concurrency handling for simultaneous Drive connections**
   If a user tries to connect multiple Google accounts simultaneously:
   - Race condition in storing the encrypted token
   - Which connection wins?
   - Should it reject concurrent connection attempts?
   - The story doesn't define the expected behavior
   [fold note: genuine gap, right-sized — folded into Affected files (`prisma/schema.prisma`) above as a `(tenantId, userId)` unique constraint on `GoogleDriveConnection`, which resolves the race at the DB layer (clean upsert/replace) without needing application-level locking.]

9. **[MAJOR] — No error handling for Google API quota limits**
   Google Drive API has daily quotas:
   - No handling for quota exceeded errors (429)
   - Should it back off exponentially?
   - Should it notify the user they've reached their limit?
   - The story doesn't mention quota management
   [fold note: genuine gap — folded together with finding 5 into the `client.ts` timeout/429-handling note above; exponential backoff beyond a single bounded retry is right-sized down as over-scoped for v1.]

10. **[MINOR] — No validation for Google OAuth redirect URI**
    The story says to pin the redirect URI but doesn't specify:
    - How to validate it matches exactly (case sensitivity, trailing slashes)
    - What if the configured redirect URI doesn't match what's registered in Google Cloud Console
    - Should it fail fast or show a clear error message
    [fold note: already covered — Round 1 finding 2 and Phase 1 step 1's existing text already require pinning `redirect_uri` to an exact allowlisted value and not accepting a caller-supplied redirect. Exact-match validation is inherent to "pinned to an exact allowlisted value"; no new body change needed.]

**Revisions applied (Round 2):**
- Phase 1 step 1 (OAuth CSRF): added a concrete state-storage mechanism — a short-lived, single-use Postgres table (`OAuthState`), since SKB has no Redis/session cache.
- Phase 1 step 2 (Token storage): added startup validation for `DRIVE_TOKEN_ENC_KEY` mirroring `src/lib/env.ts`'s existing pattern, plus an explicit decrypt-failure → "reconnect needed" UX path.
- Affected repos & files: `client.ts` gained a timeout + 429-handling note (no circuit breaker); `prisma/schema.prisma` gained the `OAuthState` table and a `(tenantId, userId)` unique constraint on `GoogleDriveConnection`.
- Acceptance criteria: added AC10 (startup env validation, mirroring `src/lib/env.ts`).
- Regression risks: added a right-sized Drive API request-handling bullet (timeout + 429, no circuit breaker) and a right-sized observability bullet (basic structured logging only, no metrics/alerting stack).
- Findings adjudicated as already covered or right-sized down, no body change beyond notes above: Drive-client scope enforcement at runtime (mostly covered by Round 1 finding 5), token-refresh-failure handling (already a Regression-risks bullet; circuit breaker declined as over-scoped), redirect-URI exact-match validation (already covered by Round 1 finding 2 + existing text), full OAuth-callback rate limiting (reuse existing `rateLimit.ts` pattern, not a new mechanism).

## Implementation notes (2026-07-05, backend pass)

**No `googleapis` npm dependency added.** `node_modules` in this worktree is a
read-only symlink into the main checkout and has no Google API client
installed; per the task's setup constraint, the connector talks to the
Drive v3 and OAuth2 REST endpoints directly via the built-in `fetch` — zero
new dependencies.

**Implemented:** Phase 1 (OAuth connect/callback with CSRF `state` bound to a
Postgres-backed `OAuthState` table, AES-256-GCM refresh-token encryption via
`DRIVE_TOKEN_ENC_KEY`, search, authenticated import into a `kind='DOCUMENT'`
page + `FileAttachment` via the existing `storeAttachment` path, disconnect
with best-effort Google-side revocation) and Phase 2 (export an existing SKB
attachment to Drive as a brand-new file via `files.create`). Unit tests cover
config-gating, token encryption round-trip/tamper/decrypt-failure, Drive
client request shaping, the no-delete/no-modify static-analysis guard, and
the search/callback routes' config-gating + error-handling paths (37 new
tests, all green; full suite 2393 passed / 0 failed / 38 pre-existing skips;
`tsc --noEmit` 0 errors; `eslint` 0 errors/warnings on touched files).

**Not implemented (explicit deviation, flagged rather than gold-plated):**
the frontend "From Google Drive" tab in the document-intake dialog, the
settings/revocation UI page, and Phase 3 (voice search tool). This story's
own verification plan is backend-only (`tsc`/`vitest`/`prisma validate`, plus
manual OAuth tests requiring a real Google Cloud OAuth client this pass had
no way to provision or click through); the frontend surfaces need a real dev
server + visual verification this worktree cannot run (no `DATABASE_URL`).
Recommend a follow-up story once the owner has registered the Google Cloud
OAuth client and can smoke-test the redirect end to end.

**No-delete/no-modify enforcement (code-level, per AC5):** `client.ts`
exposes exactly six Drive/OAuth operations (token exchange, refresh, revoke,
`files.list` search, `files.get` metadata + `alt=media` download,
`files.create` multipart upload) — there is no generic
`request(method, path)` escape hatch a caller could redirect to a mutating
endpoint, and no code path ever assigns HTTP method `DELETE`/`PATCH`/`PUT`
against a Drive files endpoint. A dedicated static-analysis test
(`src/__tests__/lib/googleDrive/client.test.ts`) greps the compiled source
for `.files.delete(`, `.files.update(`, `.files.emptyTrash(`, and the banned
HTTP-method literals, and separately asserts no exported function name
matches `/delete|trash|^update/i` — this is the regression guard the
verification plan asked for.

**Config gating:** the four required env vars
(`GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`,
`GOOGLE_DRIVE_REDIRECT_URI`, `DRIVE_TOKEN_ENC_KEY`) are read lazily by
`src/lib/integrations/googleDrive/config.ts`, which is NOT imported from the
root layout / `src/lib/env.ts` boot chain — importing it there would force
every SKB deployment to configure Drive just to boot, violating the task's
"never crash when unconfigured" constraint. Instead: none set → feature is
silently absent (no throw, no warn, in any environment); some-but-not-all
set → misconfiguration, throws in production / warns in development;
all four set but `DRIVE_TOKEN_ENC_KEY` isn't a valid 32-byte key → throws in
every environment (a broken key is never "just off"). This is a deliberate,
narrower reading of AC10's "fails fast in production if missing" — scoped to
this optional feature rather than the whole app — flagged here as an owner
decision point, not silently assumed.

**Owner setup needed to actually use this:** register a Google Cloud OAuth
2.0 **web application** client restricted to exactly the `drive.readonly` +
`drive.file` scopes (never the broad `drive` scope), then set:
`GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`,
`GOOGLE_DRIVE_REDIRECT_URI` (must exactly match a URI allowlisted in the
Cloud Console client, e.g. `https://<host>/api/integrations/google-drive/callback`),
and `DRIVE_TOKEN_ENC_KEY` (64 hex chars or 32-byte base64 — e.g.
`openssl rand -hex 32`). No `.env.example` entry was added in this pass since
this worktree has no write access to a shared `.env` file; add these four
names to whatever `.env.example`/secrets-doc convention the repo uses when
wiring real credentials.

## Frontend completion notes (2026-07-15, Agent 8)

Implemented the planned **From Google Drive** tab inside the Add document
dialog plus a Google Drive settings page. The UI reports configuration and
connection state, starts OAuth, searches connected Drive files, imports a
selected file, and disconnects the account. It also states the locked safety
boundary: SKB may search, download, and create new files, but cannot edit or
delete existing Drive files.

The unconfigured state was verified directly in the browser and both the
settings page and dialog render cleanly. Connected search/import behavior is
covered by component and backend tests. A real Google OAuth smoke test remains
blocked on the four deployment credentials listed above; Phase 3 voice search
also remains outside this UI completion pass.
