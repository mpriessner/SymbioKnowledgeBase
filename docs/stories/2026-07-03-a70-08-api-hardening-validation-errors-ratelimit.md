# A70-08 — API hardening pass: body validation, error hygiene, rate-limiter correctness

## Provenance & ownership
- **Project owner:** Martin Priessner (martin.priessner@scisymbio.ai)
- **Created by:** Agent 70
- **Created:** 2026-07-03
- **Status:** draft (improvement — do not implement yet; reviewed round 1)
- **Assigned to / currently owned by:** unassigned
- **Related / parallel work:** `SKB-15.3-agent-auth-and-rate-limiting.md` (original limiter), 2026-06-13 audit story 05 (shared rate limit).

## Problem
Three consistency gaps across the API surface: (1) four mutating routes parse
`req.json()` with no zod validation; (2) the transcribe route returns raw
upstream error messages to clients; (3) the agent rate limiter is per-instance
in-memory, counts REJECTED requests against the window (so a client hammering
a 429 never recovers at the nominal rate), hardcodes the limit in multiple
places, and has zero tests. In multi-instance Docker the effective limit
silently multiplies.

## Evidence
- No validation: `src/app/api/workspaces/route.ts`,
  `src/app/api/workspaces/switch/route.ts`,
  `src/app/api/pages/[id]/favorite/route.ts`,
  `src/app/api/pages/[id]/summary/route.ts`.
- Raw error leak: `src/app/api/ai/transcribe/route.ts` (~:248,
  `errorResponse("AI_ERROR", error.message, ..., 502)`).
  *(Correction from review: `og-metadata/route.ts:41` is NOT a leak — that
  line returns zod field errors; its catch at :80 is already generic.)*
- Limiter: `src/lib/agent/ratelimit.ts` (Map at :10, TODO Redis at :3,
  timestamp pushed before the allow check at :42-46, module-level
  `setInterval` at :13 not `unref`'d); limit hardcoded as `"100"` at
  `src/lib/agent/auth.ts:96` AND `:135`, and again in `ratelimit.ts:6`.

## Scope
1. zod schemas for the four unvalidated bodies (match existing route style:
   `safeParse` → `VALIDATION_ERROR` 400). **Preserve current lenient
   semantics:** e.g. `favorite` treats a missing `isFavorite` as `false` via
   `Boolean(body.isFavorite)` (`favorite/route.ts:16`) — new schemas mark such
   fields `.optional()` with the same defaulting, so no existing valid caller
   flips 200→400.
2. Error hygiene: generic client message + server-side `console.error` detail
   for the transcribe route; grep for other verbatim `error.message` returns
   and fix any found (og-metadata already clean).
3. Rate limiter: only count allowed requests (or fixed-window counter); ONE
   source of truth for the limit consumed by `auth.ts:96`, `auth.ts:135`, and
   `ratelimit.ts` (headers must never drift from enforcement).
   **Operator pin (round-2):** with push-on-allow, the check must become
   `count < LIMIT` — carrying over the existing `count <= LIMIT`
   (`ratelimit.ts:46`, correct only when the timestamp is pre-pushed) lets
   the limit drift to LIMIT+1. Boundary test required (request #100 allowed,
   #101 rejected).
   **Reset semantics (round-2):** `resetAt = now + WINDOW_MS` recomputed per
   request (`ratelimit.ts:48`) makes `X-RateLimit-Reset`/`Retry-After`
   (`auth.ts:89,99-102`) claim a full window even when the oldest slot frees
   in seconds — clients over-back-off. Compute reset from the OLDEST retained
   timestamp + window (sliding) or the window boundary (fixed).
   `unref()` the cleanup interval; unit tests (window expiry with fake
   timers, burst, rejected-request-doesn't-consume, boundary operator, reset
   accuracy, header values match config). Document the single-instance
   limitation prominently; a shared store (Postgres/Redis) is follow-up, not
   this story.

## Acceptance criteria
- AC1: Malformed bodies on the four routes return 400 with field details,
  never a 500; all currently-valid callers keep succeeding (leniency
  preserved).
- AC2: The transcribe route no longer returns upstream `error.message`
  verbatim; no other route does either.
- AC3: Limiter tests prove a client at the limit recovers after the window
  even if it kept retrying; `X-RateLimit-*` headers always reflect the
  enforced config.
- AC4: tsc + vitest green (existing `agentAuth.test.ts` mocks `checkRateLimit`
  and stays green unmodified).

## Affected files (expected)
- the four route files, `src/app/api/ai/transcribe/route.ts`
- `src/lib/agent/ratelimit.ts`, `src/lib/agent/auth.ts`
- new `src/__tests__/lib/agent/ratelimit.test.ts`

## Verification
Unit tests; curl malformed bodies against a dev server.

## Reviewer Feedback / Codex (round 1) — FALLBACK: Claude Opus
*(Codex CLI broken: native binary ENOENT; lens covered by Claude Opus subagent per /story fallback rules.)*
- **(Critical, factual)** Original evidence wrongly cited `og-metadata:41` as a raw-error leak — that's the zod-validation response; only `transcribe` leaks. → Evidence corrected.
- Rate-limit header contract: `agentAuth.test.ts:10-16` fully mocks `checkRateLimit` (safe), but the single-source-of-truth change must cover BOTH `auth.ts:96` and `:135` plus `ratelimit.ts:6`. → Fixed (Scope 3).
- `ratelimit.ts:13` module-level `setInterval` not `unref`'d — tests need fake timers; add `unref()`. → Fixed (Scope 3).
- zod must preserve lenient semantics (`favorite`'s `Boolean(body.isFavorite)`) or valid callers flip to 400. → Fixed (Scope 1, AC1).

## Reviewer Feedback / GLM (round 2 — runtime lens, glm-5.2)
- **(Critical)** Push-on-allow with the carried-over `<=` operator (`ratelimit.ts:46`) drifts the limit to LIMIT+1 — must become `<` with a boundary test. → Scope 3.
- `resetAt = now + WINDOW_MS` per request (`ratelimit.ts:48`) makes Reset/Retry-After headers claim a full window regardless of when quota actually frees. → Reset computed from oldest retained timestamp (Scope 3).

## Revision History
- 2026-07-03 — Initial draft (Agent 70).
- 2026-07-03 — Round-1 regression review (Opus fallback for Codex): corrected og-metadata evidence, three-site limit consolidation, unref/fake-timer note, leniency-preserving schemas.
- 2026-07-03 — Round-2 GLM runtime review: boundary-operator pin, accurate reset semantics. Status: Reviewed (draft — not to be implemented yet).
