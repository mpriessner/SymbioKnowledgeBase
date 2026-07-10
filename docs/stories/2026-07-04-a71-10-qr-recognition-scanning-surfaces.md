# QR recognition on scanning surfaces (SKB page URLs)

## Provenance & ownership
- **Project owner:** Martin Priessner (martin.priessner@scisymbio.ai)
- **Created by:** Agent 70
- **Created:** 2026-07-04
- **Status:** draft
- **Assigned to / currently owned by:** unassigned
- **Related / parallel work:** Consumes the exact QR payload shape defined by [a71-09 QR generation + printable sheet](2026-07-04-a71-09-qr-generation-printable-sheet.md) — implement that first, or at minimum agree the payload contract before starting this one. Reuses the retrieval pattern from Epic-21's protocol-loader (`src/lib/protocol/parseProtocolQr.ts` in voice-companion-vision) and the voice-tool wiring from Epic A's [a71-05 Companion `search_knowledge_base` voice tool](2026-07-04-a71-05-companion-search-knowledge-base-voice-tool.md) and [a71-06 Android KB search reachability](2026-07-04-a71-06-android-kb-search-reachability.md) (both being drafted in parallel — this story's "load into context" step should match whatever bridge/client those stories define, not invent a third one). This is the only story in the epic that touches **two repos** at once (voice-companion-vision and SciSymbioLens-Android) plus a small SKB-side confirmation.

## Problem / motivation

Two independent QR classifiers already exist and both currently have no concept of "this QR points at an SKB page":

- **Companion** (`voice-companion-vision`): `src/lib/tools/vision/classifyQr.ts` classifies a decoded payload into `url | scisymbio_id | text` (regex `^scisymbio:[a-z]+:[A-Z0-9]+$` for the scisymbio-id shape, an http/https-only scheme allowlist plus punycode/mixed-script hostname flags for URL safety). Separately, `src/lib/protocol/parseProtocolQr.ts` (the Epic-21 "protocol loader" pattern) parses a decoded string into a JSON `{type:"protocol", title, url, docId?, rag?}` payload, a bare URL, or raw text, and hands URL payloads off to an SSRF-guarded fetch step that lands the content into a "protocol slot" the AI can retrieve via a `retrieve_protocol` tool.
- **Android**: `voice/VisionParsing.kt` is an explicit line-by-line Kotlin port of the same `classifyQrPayload` logic (`QrType {URL, SCISYMBIO_ID, TEXT}`, same regex, same scheme/punycode/mixed-script checks), wired into a voice-tool handler (~line 6180 per exploration) in the `capture` cluster.

Neither classifier — nor the Epic-21 protocol path — has any notion of an SKB-hosted URL shape (`${baseUrl}/shared/{token}`, the exact string a71-09 now generates and prints). Today, scanning a printed SKB document QR on either surface would just classify it as a generic `url` and, at best, offer to open it in a browser — it would not resolve the page content into the AI's context, announce the title, or offer a KB-search follow-up the way the Epic-21 protocol flow already does for protocol documents.

## Proposed change

Add a third classification bucket, `skb_page`, to both classifiers, and a matching resolve-and-load step that mirrors (not necessarily reuses code from, since it's cross-language) the existing Epic-21 protocol-slot pattern.

### 1. Classification
A decoded QR payload is `skb_page` when it is a URL whose scheme is http/https (already required to pass the existing safety checks) AND whose path matches `/shared/{24-char-alphanumeric-token}` AND whose host is on a configured SKB-host allowlist (mirror the existing `NOTEBOOK_CAPTURE_BASEURL_ALLOWLIST` env-driven allowlist pattern already used for the notebook bridge in companion's `src/lib/config.ts`, but for SKB hosts — new env `SKB_SHARE_HOST_ALLOWLIST`).

> **Hard cross-story contract (Round 1):** `SKB_SHARE_HOST_ALLOWLIST` MUST contain exactly the host a71-09 actually prints into the QR. a71-09's publish route derives that host from `x-forwarded-host`/request origin (`localhost:3000` in dev), so a71-09 now mandates a canonical `PUBLIC_BASE_URL`. If the generator's host and this allowlist disagree, every SKB QR silently falls through to the generic `url` bucket and this feature no-ops with no error. Configure both from the same value; do not implement this story until a71-09's base-URL contract lands. Classification order matters: check `skb_page` *before* falling through to the generic `url` bucket, but *after* the existing scheme/punycode/mixed-script safety checks (a punycode SKB-lookalike host must still be flagged unsafe, not treated as a trusted SKB page).

**Companion** (`src/lib/tools/vision/classifyQr.ts`): extend the `QrType` union to `'url' | 'scisymbio_id' | 'skb_page' | 'text'` and add the host+path check inside `classifyPayload()` right after the existing `ALLOWED_URL_SCHEMES` check, before returning the generic `{type: 'url', safe: true}`.

> **Round 2 implementation note:** validate the token segment strictly against `/^[a-zA-Z0-9]{24}$/` in both classifiers before treating a match as `skb_page` — a malformed near-match (wrong length, non-alphanumeric char) should fall through to the generic `url` bucket, not be passed downstream to the resolver where it would surface as a raw fetch/DB error instead of a clean "not an SKB page" classification.

**Android** (`voice/VisionParsing.kt`): extend `enum class QrType { URL, SCISYMBIO_ID, TEXT }` to add `SKB_PAGE`, mirroring the same order-of-checks inside `classifyQrPayload()`.

### 2. Resolution
Once classified as `skb_page`, extract the token and resolve content server-side rather than just handing the raw URL to the AI as an opaque string (mirrors why Epic-21 fetches protocol documents instead of just quoting the URL):

- **Companion**: new helper `src/lib/bridge/skbSharedPageRest.ts` (sibling to the existing `notebookCaptureRest.ts` pattern — bounded fetch, own AbortController, structured `RestResult<T>`, never logs any token) hits either (a) the public unauthenticated `GET /shared/{token}` endpoint, or (b) if the calling session already has an SKB agent API key configured (per a71-05's `SKB_BASE_URL`/`SKB_API_KEY`), prefer the agent API's page-by-externalId lookup for structured markdown. Recommend (b) as primary with (a) as fallback when no SKB key is configured. **Round 1 correction:** path (a) must NOT scrape the TipTap/React HTML of `/shared/[token]/page.tsx` — that render is a client-component tree and brittle to parse. Instead, add a small SKB-side plain-text/markdown export mode to the shared route (`?format=text` or `?format=json`) and consume that. Treat this SKB-side export as an **in-scope deliverable of this story**, not a maybe (see Affected files).
- **Android**: same choice — prefer resolving via the existing `SkbApi.kt` client (already used for `kb-query` and `experiment-context`, Bearer `skb_live_*` from SecureStorage per a71-06) if a KB API key is configured on-device; otherwise fall back to an unauthenticated fetch of the public `/shared/{token}` page.

> **Round 2 implementation note:** both resolution paths must use a bounded request timeout — mirror whatever timeout convention `SkbApi.kt` already applies to its other calls (per a71-06) for the keyed path, and give the public fallback fetch (and companion's `skbSharedPageRest.ts`) the same kind of bound. An unreachable SKB must never hang the voice session. On a transient network failure, allow one retry with backoff before falling back to the public route (not indefinite retry) — this failure handling is part of this story's scope, not a follow-up.

### 3. Context loading
Loaded content is fenced as low-trust DATA in the AI context, exactly as Epic-21's protocol slot does today (companion's addendum pattern: "read verbatim, block text = lowest-trust DATA") — this QR-scanned page content must NEVER be treated as instructions. Provide a `retrieve_skb_page` tool (or extend the existing `retrieve_protocol` tool's shape if design review decides one generic "retrieve scanned document" tool is cleaner than two near-identical ones — flag this design choice explicitly for the review loop) so the AI can re-fetch or refer back to it later in the conversation without re-scanning.

### 4. Voice announce + follow-up offer
On successful resolve, the voice agent announces the page title (e.g. "That's the page for <title> — want me to search inside it or read the summary?") and offers the KB-search tool (a71-05 on companion, `query_knowledge_base`/a71-06 on Android) as a natural follow-up, scoped to that page/experiment if the page's `Page.externalId` maps to an experiment.

## Affected repos & files

**voice-companion-vision**:
- `src/lib/tools/vision/classifyQr.ts` — add `skb_page` to `QrType`, extend `classifyPayload()`.
- `src/lib/protocol/parseProtocolQr.ts` or a new sibling `src/lib/protocol/parseSkbPageQr.ts` — decide during implementation whether to extend the existing protocol parser or add a parallel one; recommend a new sibling file since the payload shape (SKB share token) is materially different from the JSON protocol shape this parser already handles, and keeping them separate avoids regressing the well-tested existing protocol path.
- `src/lib/bridge/skbSharedPageRest.ts` (new).
- `src/lib/config.ts` — new `SKB_SHARE_HOST_ALLOWLIST` env-driven config (mirror `notebookBridge.captureBaseUrlAllowlist` pattern at lines ~192-200). **Round 2:** validate at startup (or first use) that this value is actually set when the feature is enabled, and log a clear warning if it disagrees with `PUBLIC_BASE_URL`'s host — silent no-op misconfiguration (Round 1 finding 1) is exactly the failure mode a cheap startup check catches early.
- Tool file for `retrieve_skb_page` (or the merged variant), added to whichever pack a71-05 defines.

**SciSymbioLens-Android**:
- `app/src/main/java/com/scisymbiolens/android/voice/VisionParsing.kt` — add `SKB_PAGE` to `QrType`, extend `classifyQrPayload()`.
- Voice tool call handler (~`ToolCallHandler.kt` line 6180 per exploration) — new branch for `SKB_PAGE`, calling `SkbApi.kt` or a public fallback fetch.
- `capture` cluster tool registration for the new/extended handler, mirroring how `classify_qr`'s handler is already registered there.

**SymbioKnowledgeBase** (Round 1: this IS an in-scope change, not "no code changes"): add a plain-text/markdown export mode to the shared route — a `?format=text` (or `json`) branch on `src/app/shared/[token]/page.tsx` / a sibling route handler — because the default render is a TipTap/React component tree that is fragile to scrape. Both companion and Android consume this export on the no-key fallback path. The export must honor the exact same `revokedAt`/`expiresAt` null-check the HTML view already does (confirmed present in `getShareLink`), so a revoked token returns 404 in the export path too.

## Out of scope
- Changing the QR *generation* side (a71-09) — this story only consumes what that one produces.
- Building a new SKB agent-key provisioning UI — this story assumes a71-05/a71-06 wire up `SKB_BASE_URL`/`SKB_API_KEY` (companion) and the on-device `skb_live_*` key (Android); if those land after this story, the "no SKB key configured" fallback path must work standalone.
- Any change to `classify_qr`'s or `VisionParsing.kt`'s existing safety semantics for the pre-existing `url`/`scisymbio_id`/`text` buckets — additive only.
- Non-SKB QR shapes (this story is scoped strictly to the `/shared/{token}` pattern a71-09 defines).

## Acceptance criteria
1. Scanning a printed SKB document QR (as produced by a71-09) on the companion surface classifies it as `skb_page` (not generic `url`), extracts the token, and successfully resolves and loads the page's content into the AI's context, fenced as low-trust DATA.
2. The same behavior holds on Android via `VisionParsing.kt` + the voice tool handler, using the existing `capture` cluster.
3. A punycode or mixed-script host that happens to also match the `/shared/{token}` path pattern is still flagged unsafe by the pre-existing checks and never reaches the `skb_page` classification branch (order-of-checks regression test).
4. After a successful scan, the voice agent announces the page title and offers a KB-search follow-up, without requiring the user to explicitly ask "what is this."
5. When no SKB API key is configured for the session/device, the fallback unauthenticated fetch of the shared route (via the new `?format=text|json` export) succeeds for **any non-revoked, non-expired** token — this does NOT depend on `allowIndexing` (that flag only controls the robots meta tag, not access; the `/shared/{token}` view is public for any live token regardless). Verified: the shared route requires no auth.
6. A revoked share token (per a71-09's revoke flow) is handled gracefully: the resolve step reports "this document is no longer available" rather than a raw fetch error or a hang.
7. No change in behavior for existing `scisymbio_id`, generic `url`, or `text` QR classifications on either surface (regression-tested).

## Verification plan
- Unit tests (companion, Vitest): `classifyPayload()` given a `${baseUrl}/shared/{token}` string on the allowlisted host → `skb_page`; given the same path shape on a non-allowlisted host → falls through to generic `url`; given a punycode host with the `/shared/` path → still `unsafe_scheme`/`punycode_hostname`, never `skb_page`.
- Unit tests (Android, JUnit): same three cases against `classifyQrPayload()`.
- Integration test: mock a `GET /shared/{token}` response (both the "has SKB key" and "no SKB key" branches) and assert the resolved title/content lands in context correctly fenced.
- Manual device test: print a real QR via a71-09 for a test page, scan it live with both the companion webcam/image-attach flow and the Android camera, confirm the voice announcement and follow-up offer on each.
- Manual: revoke the page's publish link, rescan the (now-dead) printed QR, confirm the graceful "no longer available" message on both surfaces.
- Regression suite: existing `classifyQr.test.ts`-equivalent and Android `VisionParsing`-equivalent test files must still pass unmodified for the three pre-existing QR types.

## Regression risks
- **Classification order bugs**: inserting a new branch into two independently-maintained classifiers (TS and Kotlin) risks the two implementations drifting again despite being described as a "port" of each other — add the same test cases to both suites in the same PR/commit set so drift is caught immediately, not discovered later when one surface behaves differently from the other (this already happened once per the file's own comments — `VisionParsing.kt` is explicitly described as "a port of classifyPayload").
- **SSRF via the resolve step**: fetching `/shared/{token}` from two client apps is a *new* outbound network call from previously vision-only code paths — reuse the existing SSRF-guard pattern (scheme allowlist, no redirect-following into private ranges) rather than a naive `fetch(url)`; this is the same class of risk already flagged and mitigated in Epic-21's protocol fetch step, so follow that precedent exactly.
- **Token/key handling**: if the SKB agent API key path is chosen as primary, ensure the key is never logged and never included in error messages surfaced to the model or the user, mirroring the existing rule in `notebookCaptureRest.ts` ("Authorization header is NEVER returned in an error string or logged").
- **`gatewayBackedToolNames`/`notebookModeSuppressedToolNames` interaction (Android)**: if the new SKB-resolve tool call routes through the same gateway health-check machinery as `query_knowledge_base` (a71-06), verify it isn't accidentally suppressed in notebook/capture mode when the whole point of this story is that QR scanning happens *during* capture mode.
- **Timeout/retry on the resolve step (Round 2):** both the keyed (`SkbApi.kt`) and public-fallback resolution paths must be bounded by a timeout and allow at most one backoff retry before giving up — an unreachable SKB must degrade to a spoken "couldn't load that page" rather than hanging the voice session indefinitely.
- **Rate limiting on `/shared/{token}` (Round 2, right-sized):** the underlying shared-page route is pre-existing and already public/unauthenticated for human sharing — this story doesn't newly expose it, it only adds a `?format=text|json` export mode to an existing public route. Rate limiting that route (if ever added) is a platform-level concern, not scoped to this story; tracked here as an operational note only, no new AC.

## Reviewer feedback

### Round 1 — Regression lens (Claude Opus fallback for the broken Codex CLI, 2026-07-04)

Reviewer note: Claude Opus standing in for the non-functional Codex CLI reviewer. Both classifiers and the SKB shared route were read before writing.

1. **MAJOR — the classify host must exactly match the host a71-09 actually prints, or classification silently fails.** The `skb_page` bucket keys on `SKB_SHARE_HOST_ALLOWLIST`, but the QR-emitted host comes from a71-09's publish route, which derives it from `x-forwarded-host`/request origin (`localhost:3000` in dev). If the generator prints `localhost` and the scanner's allowlist holds the prod host (or vice-versa), the scan falls through to generic `url` and the whole feature no-ops with no error. This is a hard cross-story contract: a71-09's canonical `PUBLIC_BASE_URL` host and this story's `SKB_SHARE_HOST_ALLOWLIST` must be the same value. Cross-linked to a71-09 finding 2 — do not implement this story until that base-URL contract is fixed.

2. **MAJOR — the unauthenticated fallback scrapes a TipTap/React server render; it is fragile as designed.** I read `src/app/shared/[token]/page.tsx`: content is rendered via `<SharedPageContent>` from the page's `DOCUMENT` block (TipTap JSON → React). Scraping readable text out of that HTML (resolution path (a)) is brittle and will break on any markup change. The story already flags a possible SKB-side `?format=text|json` addition — **promote that from "possible" to the recommended primary for the no-key path.** Without it, the "no SKB key configured" fallback (AC5) is unreliable. Recommend: make the small SKB-side plain-text/markdown export on `/shared/[token]` an explicit in-scope deliverable of this story rather than a maybe.

3. **FACTUAL CORRECTION — AC5 wrongly ties fetch success to `allowIndexing`.** `allowIndexing` only drives the robots `index/follow` meta tag (`generateMetadata` in `page.tsx`); it has **nothing** to do with access. The `/shared/{token}` page is publicly viewable for any non-revoked, non-expired token regardless of `allowIndexing`. Reworded AC5 accordingly.

4. **MINOR — Android `SKB_PAGE` needs a new path extractor.** `VisionParsing.kt`'s `classifyQrPayload` only extracts the *host* (`extractHost` strips scheme/userinfo/port/path/query/fragment); there is no path parsing today. Matching `/shared/{24-char token}` requires a new helper. The companion side (`classifyPayload` uses `new URL(...).pathname`) already has path access. Keep the TS and Kotlin changes in the same commit set — the file's own header says it "ports classifyPayload," and the two have drifted before.

5. **MINOR — update the `classify_qr` tool description string.** Companion `classifyQr.ts` embeds `CLASSIFY_DESCRIPTION` (lines 21-32) enumerating "url / scisymbio_id / text"; if it isn't updated to include `skb_page`, the model won't know the new type exists. Trivial but easy to miss on both surfaces.

6. **MINOR (confirmed) — revoked/expired token is a clean 404, not a hang.** Verified in a71-09 finding 3: `getShareLink` returns null on `revokedAt`/`expiresAt` and the route 404s. So AC6's "graceful no-longer-available" is a real HTTP 404 the resolver can map to a spoken "this document is no longer available." Good.

7. **MINOR — SSRF guard must be fetch-time, not scheme-only.** The story correctly says to reuse Epic-21's guard, but note `parseProtocolQr.ts` only allowlists the *scheme*; the DNS/IP/redirect gate is a separate fetch-time step per that file's header. Port the fetch-time guard into `skbSharedPageRest.ts`, not just the scheme check.

**Revisions applied (Round 1):**
- Section 1 (Classification): added the hard requirement that `SKB_SHARE_HOST_ALLOWLIST` equals a71-09's canonical `PUBLIC_BASE_URL` host, cross-linked.
- Section 2 (Resolution): promoted the SKB-side `?format=text|json` export from "possible" to the recommended primary for the no-key fallback path.
- Affected repos & files (SymbioKnowledgeBase): upgraded the shared-route note from "confirm/maybe" to "add a plain-text/markdown export mode" as an in-scope deliverable.
- Acceptance criteria: AC5 reworded (drop the `allowIndexing` coupling — any non-revoked token is publicly fetchable).
- Added implementation notes: Android needs a new path-matcher helper; both `classify_qr` tool descriptions must list `skb_page`; SSRF guard must run at fetch time.
- Open question for the owner (unfixable by editing): confirm the deployment's canonical public SKB host so the generator and both scanners can be configured to the same value.

### Round 2 — GLM-4.5-flash runtime lens (2026-07-04, quota fallback for glm-5.2)

1. **BLOCKER — SSRF vulnerability in SKB page fetch endpoint**: The story requires fetching `/shared/{token}` from client apps (companion and Android) but doesn't implement proper runtime SSRF guards. The Epic-21 protocol loader includes DNS/IP blocking and redirect prevention, but the proposed `skbSharedPageRest.ts` only mentions "scheme allowlist" (line 109 in story). The actual SSRF guard must be implemented at fetch time, not just URL classification time. Critical because this exposes internal services to DNS rebinding attacks. Fix: Port the full SSRF guard from `parseProtocolQr.ts` headers into `skbSharedPageRest.ts`.
   [fold note: already covered — Round 1 finding 7 states this exact requirement ("SSRF guard must be fetch-time, not scheme-only... Port the fetch-time guard into `skbSharedPageRest.ts`"), and the Regression risks section already calls out reusing Epic-21's SSRF-guard precedent. No new body change needed.]

2. **MAJOR — Token extraction path missing in Android**: `VisionParsing.kt`'s `extractHost()` only extracts the host, not the `/shared/{24-char-token}` path (lines 230-240). The story mentions this in finding 4 but doesn't require a new path-extraction helper for SKB page token validation. Runtime error: Android will classify correctly but fail to extract the token for resolution. Fix: Add a new `extractSharedToken()` method that validates path format `/shared/[a-zA-Z0-9]{24}`.
   [fold note: already covered — Round 1 finding 4 already requires a new Android path-parsing helper for this. `extractSharedToken()` is a reasonable name for it; no story change needed beyond the Round 2 token-regex note added to §1 above.]

3. **MAJOR — Missing timeout handling for SKB API fallback**: The "prefer SKB agent API" path uses `SkbApi.kt` on Android but doesn't specify timeouts. Android tool calls can hang if SKB is unreachable, blocking voice sessions. The notebook pattern uses 10s initial + 5s poll timeouts but these aren't applied to SKB page resolution. Fix: Add configurable timeouts to `SkbApi.kt`'s interface and Android resolution code.
   [fold note: genuine gap — folded into Proposed change §2 and Regression risks above.]

4. **MAJOR — No rate limiting on public SKB page fetch**: The `/shared/{token}` endpoint is public and unauthenticated. Without rate limiting, malicious actors could flood QR resolution requests with hundreds of different tokens. Runtime impact: DDoS vector against PostgreSQL queries. Fix: Add rate limiting middleware to the shared route, scoped to token count per minute.
   [fold note: right-sized down — `/shared/{token}` is a pre-existing public route this story doesn't newly expose; it already serves human sharing traffic today. Rate limiting it is a platform-level concern, not specific to this feature. Folded as a lightweight operational note in Regression risks rather than a new AC.]

5. **MINOR — Memory leak potential in companion resolution**: `skbSharedPageRest.ts` would need to buffer resolved content, but the story doesn't specify cleanup. Companion's protocol slot pattern uses bounded storage, but SKB page content could be larger. Fix: Implement content size limits and LRU eviction for resolved pages.
   [fold note: already covered — Proposed change §2 already specifies `skbSharedPageRest.ts` as a "bounded fetch" (mirroring `notebookCaptureRest.ts`'s pattern), which addresses unbounded content growth. No new body change needed.]

6. **MINOR — No validation for 24-char token format**: Both classifiers check path pattern `/shared/{token}` but don't validate it's exactly 24 alphanumeric chars. Malformed tokens could cause database errors. Fix: Add `TOKEN_RE = /^[a-zA-Z0-9]{24}$/` validation in all code paths.
   [fold note: genuine gap — folded into Proposed change §1 above as an explicit implementation note.]

7. **MINOR — Android API key dependency without recovery**: If Android's `SkbApi.kt` call fails, the story falls back to public fetch, but doesn't handle transient network errors. The voice tool could hang indefinitely. Fix: Add retry logic with exponential backoff for the SKB API path.
   [fold note: genuine gap — folded together with finding 3 into Proposed change §2 and Regression risks above (bounded timeout + single backoff retry).]

8. **MINOR — Environment validation at runtime**: The story mandates `SKB_SHARE_HOST_ALLOWLIST` must match `NEXT_PUBLIC_PUBLIC_BASE_URL`, but there's no runtime validation to ensure they agree before deployment. Runtime error: silent feature failure if misconfigured. Fix: Add startup validation that throws if the hosts don't match.
   [fold note: genuine gap — folded into Affected repos & files (companion `config.ts`) above.]

**Revisions applied (Round 2):**
- Proposed change §1 (Classification): added an explicit token-format validation note (`/^[a-zA-Z0-9]{24}$/`) so malformed near-matches fall through to generic `url` instead of erroring downstream.
- Proposed change §2 (Resolution): added a timeout + single-backoff-retry requirement for both the keyed (`SkbApi.kt`) and public-fallback resolution paths.
- Affected repos & files (companion `config.ts`): added a startup/first-use validation note for `SKB_SHARE_HOST_ALLOWLIST` vs. `PUBLIC_BASE_URL` agreement.
- Regression risks: added a timeout/retry bullet and a right-sized rate-limiting operational note (no new AC — pre-existing public route, platform-level concern).
- Findings adjudicated as already covered, no body change: SSRF guard (Round 1 finding 7), Android token path extractor (Round 1 finding 4), companion bounded-fetch memory handling (already in Proposed change §2's original text).
