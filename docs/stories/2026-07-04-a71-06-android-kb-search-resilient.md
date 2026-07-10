# Android KB search — reachable in notebook mode, resilient to a down gateway

## Provenance & ownership
- **Project owner:** Martin Priessner (martin.priessner@scisymbio.ai)
- **Created by:** Agent 70
- **Created:** 2026-07-04
- **Status:** draft
- **Assigned to / currently owned by:** unassigned
- **Related / parallel work:** Android parity partner to [a71-05-companion-kb-search-tool](./2026-07-04-a71-05-companion-kb-search-tool.md) — review together to keep the query/depth contract consistent across both voice stacks. Benefits from [a71-04-agent-wiki-overview-okf](./2026-07-04-a71-04-agent-wiki-overview-okf.md) (richer KB content). No `/api/sync/experiments` involvement — no direct dependency on `2026-07-03-a70-06-sync-tenant-binding-timing-safe-key.md`.

## Problem / motivation
Android already has a voice-callable KB search tool, `query_knowledge_base` (declared in `voice/ToolCallHandler.kt` ~L1926, dispatched at L3341 to `handleQueryKnowledgeBase` at L7012-7029). It calls `clawdbotKbClient.kbQueryVoiceSync(query, depth, experimentId, sessionId)` (`data/remote/gateway/ClawdbotKbClient.kt` L75), which reaches the Mac mini Clawdbot Gateway (`Gateway POST /kb/query`, port 18799) that in turn proxies SKB. Results feed `kbContextAccumulator` (`data/kb/KbContextAccumulator.kt`) so context survives WebSocket reconnects. This works — **when the gateway is up and the tool is advertised.** Two real gaps exist today:

**Gap 1 — availability in notebook/capture mode.** `query_knowledge_base` is a member of `notebookModeSuppressedToolNames` (`ToolCallHandler.kt` L2512-2513, alongside `ask_clawdbot`), suppressed whenever the user is in notebook or capture context (Story 2026-06-11's decision: routing "add this to the experiment" intents to `ask_clawdbot`'s broad catch-all kept failing, so both tools were dropped from the advertised set in that mode to force intents onto the native `promote_capture`/`forward_to_notebook` tools instead — see the code comment at L2499-2510). **This is already partially solved**: `advertisedToolDefinitions()`'s filter (L2571-2581) exempts any tool in `activeClusterToolNames` from the suppression, and `ToolsetCatalog.currentToolsetDefinitions()` (L262-276) documents exactly this mechanism — switching to the `assistant` cluster (which owns `ask_clawdbot`/`query_knowledge_base`, per `ToolsetCatalog.kt` L254) re-exposes both tools even in notebook mode, via `clusteredToolDefinitions()` (`ToolCallHandler.kt` L2603+) passing the active toolset through as the exemption set. So the tool **is** reachable today, but only after the user (or the model) explicitly calls `switch_toolset("assistant")` — there is no direct path from, say, the `notebook` cluster. Whether that friction is acceptable or should be reduced (e.g. a lighter-weight per-tool exemption independent of cluster-switching) needs an explicit decision, not a silent "fix."

**Gap 2 — no fallback when the gateway is unhealthy.** `query_knowledge_base` is also a member of `gatewayBackedToolNames` (L2493-2497, alongside `ask_clawdbot`/`session_status`) — "stripped from the advertised set when the gateway health check fails so the model never offers a feature that would hang" (L2486-2492). When the gateway is down, the tool disappears entirely, even though Android has a **second, direct path to SKB that bypasses the gateway completely**: `data/remote/skb/SkbApi.kt` (`POST api/agent/kb-query` at L32-33, Bearer `skb_live_*` from `SecureStorage.getSkbApiKey()`/`setSkbApiKey()`), wrapped by `data/remote/skb/SkbClient.kt` (pre-flight host+key validation, 15s timeouts, `NetworkResult`-wrapped, never throws — per its own header comment). Today this path is wired **only** into the Settings "Test Connection" flow (`ui/settings/SettingsScreen.kt` L904/1020/1025) — it is invisible to voice. `data/kb/KbContextProvider.kt`, the facade the voice/chat prompt-builder is supposed to call for KB context, is a thin wrapper over `ClawdbotKbClient.fetchSessionContext` only (L31-48) — its own doc comment already anticipates this exact gap: *"This also gives us an obvious place to add caching, telemetry, or a fallback to `com.scisymbiolens.android.data.remote.skb.SkbClient` in future without touching call sites"* (`KbContextProvider.kt` L14-16).

## Proposed change
Two independent fixes; land both, but they can be reviewed and shipped as separable commits.

**1. Gateway-down fallback via the existing direct SKB path.** Extend `handleQueryKnowledgeBase` (`ToolCallHandler.kt` L7012-7029) so that when `clawdbotKbClient.kbQueryVoiceSync(...)` returns a `NetworkResult.Error` that indicates unreachability (connection failure / timeout, not an auth or bad-request error — those should still surface as-is so the user gets an accurate message rather than a silently degraded answer), the handler falls back to `skbClient.kbQuery(...)`. **Two runtime details AC4 depends on, verified in the actual error-handling code (not previously spelled out):**
- **Error classification requires inspecting `cause`, not `code`.** `NetworkResult.Error(code: Int? = null, message: String, cause: Throwable? = null)` (`NetworkResult.kt:8`) has an optional `code`, but `safeApiCall` (`core/network/SafeApiCall.kt`) never populates it — it only distinguishes `SocketTimeoutException`/`IOException` (network/timeout) from a generic `catch (e: Exception)` bucket that also swallows `ClawdbotHttpException` (which itself carries an `httpCode`, per `ClawdbotHttpException(val httpCode: Int, message: String)`). So today, a 401 auth error and a genuine 5xx/connection failure both surface as `NetworkResult.Error(code = null, ...)` with no structural way to tell them apart from the outside. Implementing AC4's "network/timeout triggers fallback, auth/4xx does not" therefore requires either: (a) inspecting `error.cause as? ClawdbotHttpException` and checking `httpCode` at the call site, or (b) widening `safeApiCall`/`kbQueryVoiceSync` to populate `NetworkResult.Error.code` from a caught `ClawdbotHttpException` before it reaches the generic catch. Pick one explicitly — this is not a detail that falls out "for free" from the existing types.
- **Bound the fallback's own timeout so the combined budget doesn't blow past the voice-sync window.** The primary gateway call already runs inside `withTimeoutOrNull(VOICE_SYNC_TOOL_TIMEOUT_MS = 8_000L)` (`ToolCallHandler.kt:639`, `:3309`). `SkbClient.kbQuery` uses OkHttp-level timeouts of 15s (per its own header comment). If the gateway call times out at 8s and then the fallback runs for up to 15s more, the tool call could take up to ~23s total — far beyond the voice-sync budget the primary path is designed to respect, likely triggering a separate voice-layer timeout that surfaces a worse error than either path alone would. Wrap the fallback call in its own bounded timeout (e.g. a `withTimeoutOrNull` sized to whatever budget remains after the primary attempt, or a fixed smaller cap such as 5-6s) so the total stays within a predictable voice-turn budget. **Correction (verified): `SkbClient.kbQuery` already exists** at `SkbClient.kt:50` with the signature `suspend fun kbQuery(query: String, depth: String = "medium", experimentId: String? = null, sessionId: String? = null): NetworkResult<SkbKbQueryResponseDto>` — it already does the pre-flight credential check (`requireCredentials()`), calls `SkbApi.kbQuery` → `POST api/agent/kb-query` (`SkbApi.kt:32`), and returns `NetworkResult`-wrapped without throwing. **No new method is needed.** The actual work is narrower than the draft implied: (a) inject `SkbClient` into `ToolCallHandler`, (b) call the existing `kbQuery` in the fallback branch, (c) map the returned `SkbKbQueryResponseDto.context_blocks` into `kbContextAccumulator`. Pass `depth` through explicitly so the fallback doesn't silently apply the `"medium"` default when the gateway path used a different depth. This makes `KbContextProvider`'s anticipated fallback real: inject `SkbClient` into `ToolCallHandler` (it's already a `@Singleton` with `@Inject constructor`, so standard Hilt wiring) and call it only as the fallback branch, not the primary path — the gateway path stays primary because it also populates `kbContextAccumulator` server-side (gateway-side accumulation, per the existing code comment at L7025-7028) and other gateway-mediated context depends on that. On successful fallback, still populate `kbContextAccumulator` locally from the direct SKB response's `context_blocks` (same shape `SkbKbQueryResponseDto` already defines, per `SkbClient.kt`'s import list) so downstream behavior (context surviving reconnects) doesn't regress just because the fallback path was used.

Pre-flight requirement: the fallback only fires if `SecureStorage.getSkbApiKey()` is non-null and a SKB host is configured (`SkbClient`'s own pre-flight check already returns a clean `NetworkResult.Error` if not — reuse that, don't duplicate the check). If neither the gateway nor the direct path is usable, return the existing "tool execution timed out"/error shape unchanged (`ToolCallHandler.kt` L3347-3355's existing timeout-to-error conversion already covers this — no new error path needed for the fully-unavailable case).

**2. Notebook/capture-mode reachability — analysis and decision, not a blind removal.** Do **not** simply delete `query_knowledge_base` from `notebookModeSuppressedToolNames` — that resurrects the exact confusion Story 2026-06-11 fixed (intents like "add this to the experiment" mis-routing to the broad KB/Clawdbot tools instead of the native notebook tools). Instead: confirm with the owner whether the existing cluster-switch path (`switch_toolset("assistant")` in notebook mode, already functional per the Gap 1 analysis above) is sufficient, or whether `query_knowledge_base` specifically (not `ask_clawdbot`) should get an independent exemption from `notebookModeSuppressedToolNames` — since the original 2026-06-11 confusion was about the broad `ask_clawdbot` catch-all, not the narrower, single-purpose `query_knowledge_base`. If the owner confirms a narrower fix is wanted: split `notebookModeSuppressedToolNames` into two sets (or add a new one) so `query_knowledge_base` can be exempted independently of `ask_clawdbot`, keeping `ask_clawdbot` suppressed in notebook mode exactly as today. This is the "cluster exemption... after analyzing why it was suppressed first" the brief calls for — the analysis above **is** that first step; this story's acceptance criteria capture the decision explicitly rather than assuming an answer.

**3. Parity across both voice managers + live-video.** `advertisedToolDefinitions()`/`clusteredToolDefinitions()` and `gatewayBackedToolNames`/`notebookModeSuppressedToolNames` are shared static members read by both `VoiceAgentManager.kt` (Gemini path) and `GenericVoiceConversationManager` — confirm the fallback (1) and any suppression-set change (2) apply identically to both by construction (they will, since both call through the same `ToolCallHandler` companion-object functions), and add/update `ToolParityTest.kt` coverage accordingly. `VideoChatSessionController.kt` already allowlists `query_knowledge_base` for live-video sessions — confirm the gateway-down fallback also applies there (it should, since it dispatches through the same `handleQueryKnowledgeBase`), and add a `VideoChatSessionControllerTest.kt` case if one doesn't already cover this.

## Affected repos & files
**SciSymbioLens-Android:**
- `app/src/main/java/com/scisymbiolens/android/voice/ToolCallHandler.kt` — `handleQueryKnowledgeBase` (L7012-7029) gains the fallback branch; inject `SkbClient`.
- `app/src/main/java/com/scisymbiolens/android/data/remote/skb/SkbClient.kt` — **no change needed**: `kbQuery(query, depth, experimentId?, sessionId?)` already exists (L50) and is more general than this story requires. (Method-set note: the real methods are `kbQuery` (L50), `experimentContext` (L77), `healthCheck` (L98) — the draft's `health()`/`testConnection()` names were approximate.)
- `app/src/main/java/com/scisymbiolens/android/data/kb/KbContextProvider.kt` — optionally extend to expose the fallback for the prompt-builder path too, fulfilling its own L14-16 comment (decide whether this is in scope for this story or deferred, since the tool-call path and the prompt-injection path are two different consumers of KB data).
- `app/src/main/java/com/scisymbiolens/android/voice/ToolsetCatalog.kt` — only if the owner confirms the narrower-exemption path in (2); otherwise no change needed here (the cluster-switch mechanism already exists).
- `app/src/test/java/com/scisymbiolens/android/voice/provider/ToolParityTest.kt`, `CaptureToolGateTest.kt`, `GenericToolAdapterTest.kt`, `app/src/test/java/com/scisymbiolens/android/video/VideoChatSessionControllerTest.kt` — new/updated test cases.

## Out of scope
- Building anything on the SKB or Gateway side — both `POST api/agent/kb-query` and the Gateway's `/kb/query` proxy already exist and are unmodified by this story.
- Removing `ask_clawdbot` from any suppression set — that tool's suppression in notebook mode is unaffected.
- A UI affordance for the user to manually trigger "use direct SKB" — the fallback is automatic and silent (the user just gets an answer either way); no new settings toggle beyond the existing SKB host/key fields already in Settings.

## Acceptance criteria
1. When the Clawdbot Gateway is unreachable (simulated via a network-error `NetworkResult` from `clawdbotKbClient.kbQueryVoiceSync`), `handleQueryKnowledgeBase` falls back to the direct `SkbClient` call and returns a usable answer, provided a SKB host + API key are configured.
2. When neither the gateway nor a configured SKB host/key is available, the tool returns the existing clean error shape — no crash, no hang beyond the existing `VOICE_SYNC_TOOL_TIMEOUT_MS` budget.
3. A successful fallback populates `kbContextAccumulator` with the direct-path response's context blocks, in the same shape as a gateway-path success would.
4. An auth error (invalid/missing SKB key) or a bad-request error from the gateway path does **not** trigger the fallback — it surfaces as today, since falling back on an auth error would mask a real configuration problem behind a possibly-successful direct call using different (also possibly broken) credentials. Document this distinction clearly in the implementation (network/timeout errors trigger fallback; 4xx auth/validation errors from the gateway do not). **Implementation note:** this requires classifying the error by unwrapping `error.cause as? ClawdbotHttpException` (or an equivalent explicit code-population change to `safeApiCall`) — `NetworkResult.Error.code` is not populated by the existing error path, so a naive "check `code`" implementation will not work (see §1's runtime-detail callout).
5. The fallback call itself is bounded so that a gateway timeout (8s, `VOICE_SYNC_TOOL_TIMEOUT_MS`) followed by a full-length `SkbClient` timeout (15s) never together exceed a predictable total voice-turn budget — verified via a test that simulates a gateway timeout followed by a slow-but-successful direct SKB response near the fallback's own timeout boundary.
6. `notebookModeSuppressedToolNames` behavior is unchanged unless an explicit owner decision authorizes the narrower split described in (2) — the story's implementer must record which outcome was chosen and why, in the PR description or a follow-up note in this story file.
7. Both `VoiceAgentManager` (Gemini) and `GenericVoiceConversationManager` (OpenAI/others) exhibit identical fallback behavior, verified by `ToolParityTest.kt`.
8. Live-video sessions (`VideoChatSessionController.kt`) retain `query_knowledge_base` availability and gain the same fallback behavior.
9. `ToolsetCatalog.validateClusters()` continues to pass (no cluster exceeds `TOOLSET_CAP = 17`) after any changes in this story.

## Verification plan
- Unit tests in `ToolCallHandlerTest`-equivalent (or wherever `handleQueryKnowledgeBase` is currently tested, if it is): mock `clawdbotKbClient` to return network-error, auth-error, and success cases; assert fallback fires only for the network-error case.
- `CaptureToolGateTest.kt` / `ToolParityTest.kt` — extend to cover the fallback behavior identically for both providers.
- `VideoChatSessionControllerTest.kt` — add a case confirming the live-video path also benefits from the fallback.
- Manual on-device/emulator: with the Clawdbot Gateway stopped and a valid SKB host+key configured in Settings, ask a KB question by voice in a plain (non-notebook) session; confirm an answer is returned and `kbContextAccumulator` reflects it (check via existing debug/logging, or a subsequent turn that relies on accumulated context).
- Regression: run the full Android unit test suite (`./gradlew testDebugUnitTest` or equivalent) to confirm `ToolsetCatalog.validateClusters()` and existing suppression-set tests still pass unchanged (if the narrower-exemption path in (2) is not adopted) or pass with the updated split (if it is).

## Regression risks
- **Silently masking real gateway outages.** If the fallback is too eager, a genuinely broken gateway could go unnoticed because SKB answers still come through directly — operationally this might be desirable (graceful degradation) but it changes what "gateway health" telemetry means. Mitigate: keep gateway-health logging/alerting independent of whether the fallback succeeded, so an outage is still visible in monitoring even if the user experience is unaffected. Concretely, log a fallback-usage event (timestamp, gateway error, whether the direct call then succeeded) each time the fallback fires, so a run of fallback events is itself a visible signal rather than something only inferable from the absence of gateway-side telemetry.
- **Re-introducing the 2026-06-11 notebook-mode confusion** if the suppression-set change in (2) is implemented without the owner's explicit sign-off, or if it's applied to `ask_clawdbot` by mistake instead of just `query_knowledge_base`. Mitigate: AC5's explicit record-the-decision requirement, and scoping any change narrowly to `query_knowledge_base` only.
- **Divergent credentials between the gateway path and the direct path** (the gateway proxies SKB using its own server-side credential; the direct path uses the user's own `skb_live_*` key from `SecureStorage`) could mean the fallback answers with a different privilege scope (e.g. missing team-space content the gateway's credential could see, or vice versa) than the primary path would have. Mitigate: document this discrepancy clearly for whoever reviews the story; if it proves material, a future story may need to reconcile the two credentials' scopes.

## Reviewer feedback

### Round 1 — Regression lens (Claude Opus fallback for Codex, 2026-07-04)
Reviewer note: local Codex CLI is broken; Claude Opus stood in for Codex. Cited paths read directly.

1. **MAJOR (accuracy, simplifies the story) — `SkbClient.kbQuery` already exists.** Draft's primary text said "new method on `SkbClient`." Verified it exists at `SkbClient.kt:50` with a richer signature than proposed (`query, depth="medium", experimentId?, sessionId?` → `NetworkResult<SkbKbQueryResponseDto>`), already credential-pre-flighted and non-throwing, hitting `POST api/agent/kb-query` (`SkbApi.kt:32`). The work reduces to inject-`SkbClient` + call-in-fallback + map-context-blocks. *(Fixed in §1 + Affected files.)*
2. **MINOR — method-name approximations.** Draft referenced `health()`/`testConnection()`; the actual `SkbClient` methods are `kbQuery`/`experimentContext`/`healthCheck`. Cosmetic; corrected in Affected files.
3. **VERIFIED OK — all suppression/gating anchors are exact.** `notebookModeSuppressedToolNames = setOf("ask_clawdbot","query_knowledge_base")` (L2512-2513); `gatewayBackedToolNames` includes `query_knowledge_base` (L2493-2497/L2495); `handleQueryKnowledgeBase` L7012; dispatch L3341; declaration L1926; the `activeClusterToolNames` exemption in `advertisedToolDefinitions` (L2576-2577); `clusteredToolDefinitions` strips `gatewayBackedToolNames` (L2625). The Gap-1 analysis (already reachable via `switch_toolset("assistant")`) is correct, and `KbContextProvider.kt`'s L14-16 comment anticipating an `SkbClient` fallback is real.
4. **VERIFIED OK (and important) — the network-vs-auth error distinction (AC4) is the right call.** Falling back only on connection/timeout errors, not on 4xx auth/validation, correctly avoids masking a real gateway config problem with a possibly-different-privilege direct answer. The credential-scope-divergence risk (gateway's server credential vs the user's `skb_live_*` key) is genuine and already flagged.
5. **MINOR — decision-deferred framing (Gap 2 suppression split) is correctly left to the owner.** AC5's "record which outcome was chosen" is the right guard against silently resurrecting the 2026-06-11 notebook-mode confusion. No change.

**Revisions applied (Round 1):**
- §1 corrected: `SkbClient.kbQuery` already exists (with verified signature); reframed the task as inject + call + map-context-blocks, with an explicit note to pass `depth` through rather than inherit the `"medium"` default.
- Affected files: marked `SkbClient.kt` as "no change needed" and corrected the method-name list.

This is the strongest story in the set; the only substantive issue was the stale "new method" framing. No blockers.

### Round 2 — GLM-4.5-flash runtime lens (2026-07-04, quota fallback for glm-5.2)

1. **[BLOCKER] Timeout budget clash — primary 8s timeout + fallback's 15s timeout could total ~23s.** Genuine, verified, and load-bearing: confirmed `VOICE_SYNC_TOOL_TIMEOUT_MS = 8_000L` (`ToolCallHandler.kt:639`) wraps the primary gateway call, and `SkbClient`'s OkHttp timeouts are 15s (per its own header comment). The story's original AC2 only bounded the fully-unavailable case ("no hang beyond the existing `VOICE_SYNC_TOOL_TIMEOUT_MS` budget"), not the fallback-after-gateway-timeout case. [fold note: genuine — folded into §1 and a new AC5 requiring the fallback to be independently bounded.]
2. **[MAJOR] Error type ambiguity — `NetworkResult.Error` doesn't structurally distinguish network/timeout from 4xx auth errors.** Genuine and verified: `safeApiCall` (`core/network/SafeApiCall.kt`) only special-cases `SocketTimeoutException`/`IOException`; a `ClawdbotHttpException` (which carries `httpCode`) falls into the generic `catch (e: Exception)` branch and produces `NetworkResult.Error(code = null, ...)` — same shape as a genuine connection failure. AC4 (network/timeout triggers fallback, auth/4xx does not) is not implementable by a naive `code` check given this. [fold note: genuine — folded into §1 and AC4's implementation note.]
3. **[MINOR] Memory-leak/concurrent-fallback risk under rapid repeated calls during an outage.** Plausible but speculative — no evidence in the codebase that `query_knowledge_base` calls aren't already serialized per voice turn the way other tool calls are. [fold note: not folded — the story's fallback is a straightforward per-call operation with no shared mutable state beyond `kbContextAccumulator`, which already needs to be concurrency-safe today regardless of this story; no concrete new risk identified.]
4. **[MINOR] Lack of telemetry for fallback events.** Reasonable operational suggestion with real value for detecting silent gateway outages once the fallback masks them from the user's perspective. [fold note: genuine, light — folded into Regression risks as a logging recommendation.]
5. **[MINOR] API scope confusion (gateway's server credential vs. the user's `skb_live_*` key).** [fold note: already covered — this is already the story's own Regression risks bullet ("Divergent credentials between the gateway path and the direct path... could mean the fallback answers with a different privilege scope"). Not folded again.]

**Revisions applied (Round 2):**
- §1: added two verified runtime-detail callouts — the error-classification gap (`code` not populated, must inspect `cause`) and the timeout-budget clash (8s + 15s could total ~23s) — with concrete fix directions for each.
- AC4: added an implementation note pointing at the `ClawdbotHttpException`/`cause` unwrap needed to make the network-vs-auth distinction real.
- Added new AC5 requiring the fallback's own timeout to be bounded against the voice-turn budget (existing AC5–AC8 renumbered to AC6–AC9).
- Regression risks: added a telemetry/logging recommendation for fallback usage.
- Findings #3 and #5 were adjudicated as speculative/already covered respectively; no changes made for those.

## Implementation decision (AC6)

Implemented on `feat/a71-06-android-kb-search` (2026-07-05). Both fixes landed:

- **Fix 1 (gateway-down fallback):** `handleQueryKnowledgeBase` now takes an
  injected `SkbClient?` (nullable/defaulted, matching the handler's existing
  optional-dependency pattern) and falls back to `skbClient.kbQuery(...)` only
  when the gateway error's `cause` is NOT a `ClawdbotHttpException` (i.e. a
  genuine network/timeout failure, not an HTTP response the gateway actually
  returned — approach (a) from the story's two options, chosen because it
  needed no change to `safeApiCall`/`kbQueryVoiceSync`). The fallback runs
  inside its own `withTimeoutOrNull(SKB_FALLBACK_TIMEOUT_MS = 6_000L)`, a fixed
  cap chosen (over a remaining-budget calculation) for simplicity — worst case
  8s (gateway) + 6s (fallback) = 14s, still well inside a predictable
  voice-turn window. A successful fallback maps `SkbContextBlockDto` →
  `GatewayContextBlockDto` field-by-field and populates `kbContextAccumulator`
  exactly as the gateway-success path does.

- **Fix 2 (notebook-mode reachability, AC6 decision):** the **narrow
  independent exemption** was chosen, per the owner's explicit direction
  passed into this implementation task — `query_knowledge_base` was split out
  of `notebookModeSuppressedToolNames` into a new
  `notebookModeAlwaysAvailableToolNames` set, so it is no longer suppressed in
  notebook/capture mode. `ask_clawdbot` remains in
  `notebookModeSuppressedToolNames` unchanged — its suppression (the actual
  subject of the 2026-06-11 confusion) is untouched. No blanket removal, no
  change to the `switch_toolset("assistant")` cluster-exemption path (still
  intact for `ask_clawdbot`).

- **Fix 3 (parity):** verified by construction — both voice managers and the
  live-video controller dispatch through the same
  `ToolCallHandler.handleToolCall`, with no tool-specific branching for
  `query_knowledge_base` in either `GenericToolAdapter` or
  `VideoChatSessionController`. Added a fallback-shaped-result pass-through
  test to `GenericToolAdapterTest.kt` and to `VideoChatSessionControllerTest.kt`
  to pin this.

**Verification note:** `./gradlew :app:testDebugUnitTest` for the touched
suites: 175 run, 172 passed, 3 pre-existing failures unrelated to this story
(a stale "6 capture tools" count in three tests — `search_captures`/
`forget_captures` grew the real capture-tool set to 7 without those assertions
being updated; reproduced on the untouched base commit before any of this
story's changes, so left alone as out of scope here).
