# A70-22 — Pay down lint debt and close test-coverage holes

## Provenance & ownership
- **Project owner:** Martin Priessner (martin.priessner@scisymbio.ai)
- **Created by:** Agent 70
- **Created:** 2026-07-03
- **Status:** draft (improvement — do not implement yet)
- **Assigned to / currently owned by:** unassigned
- **Related / parallel work:** CLAUDE.md notes eslint is CI-reported but non-blocking "until the lint debt is cleared" — this story is that clearing. CI: `.github/workflows/ci.yml`.

## Problem
184 eslint errors + 11 warnings accrete because CI doesn't block on them. The
19 react-hooks findings (set-state-in-effect, refs misuse) are the kind that
hide real render-loop/stale-closure bugs. Separately, the largest agent module
(`src/lib/agent/kbQuery.ts`, the core KB-query engine) and the rate limiter
have ZERO unit tests while chemEln/markdown/sync are well covered.

## Evidence
- `npx eslint .`: no-explicit-any 86, no-unused-vars 59, react-hooks 24 (10
  set-state-in-effect, 9 refs, 5 misc), no-require-imports 6,
  no-unsafe-function-type 6, no-img-element 5, prefer-const 5; 4 stale
  eslint-disable directives (GraphView.tsx + graph builder test).
- Coverage: only `wikilinks.ts` tested in `src/lib/agent/`.

## Sequencing
Implement LAST among the A70 stories: the "184 errors" baseline churns as the
other stories land; running this first would create constant merge noise.

## Scope
1. Mechanical wave: `--fix` prefer-const, remove stale disables, delete unused
   vars/imports (59) — zero behavior change, reviewed as one PR.
2. react-hooks wave: fix all 24 hook findings individually with understanding
   (each can be a real bug); note any true positives found.
3. any-reduction wave: type the `src/lib/` occurrences first (86 total; target
   ≤30 remaining, rest annotated with eslint-disable + reason).
4. Flip eslint to BLOCKING in CI once errors reach 0 (separate final commit).
5. Tests: characterization tests for `kbQuery.ts` main paths (routeSearch,
   depth levels, response shaping) + rate limiter unit tests (shared with
   [A70-08](2026-07-03-a70-08-api-hardening-validation-errors-ratelimit.md) —
   whichever lands first implements them).

## Acceptance criteria
- AC1: eslint errors 184 → 0 (or documented allowlist), CI flipped to blocking.
- AC2: No behavior change: full vitest suite identical pass count before/after
  each wave.
- AC3: kbQuery characterization suite covers the top-level query modes.

## Affected files (expected)
- broad, mechanical; kbQuery tests under `src/__tests__/lib/agent/`

## Verification
vitest before/after parity + eslint zero-count in CI.
