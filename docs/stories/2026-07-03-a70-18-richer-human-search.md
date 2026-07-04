# A70-18 — Bring the richer retrieval stack to human search

## Provenance & ownership
- **Project owner:** Martin Priessner (martin.priessner@scisymbio.ai)
- **Created by:** Agent 70
- **Created:** 2026-07-03
- **Status:** draft (improvement — do not implement yet)
- **Assigned to / currently owned by:** unassigned
- **Related / parallel work:** `EPIC-53-DUAL-SEARCH-PIPELINE.md`, `SKB-51.3-search-depth-levels-api.md` (built the engines), `SKB-13.x` search UI.

## Problem
The agent API enjoys a multi-strategy retrieval stack (routeSearch, ragSearch,
agenticSearch, depthSearch — wikilink-hop expansion, hierarchy-guided, TF-IDF
ranking) while the human search dialog uses only basic Postgres FTS. Humans get
the weakest search in the product. Also `agenticSearch`'s category taxonomy is
hardcoded to chemistry, limiting reuse.

## Evidence
- Engines agent-only: `src/lib/agent/kbQuery.ts:1043`,
  `src/app/api/agent/search/route.ts:121`.
- Human path: `src/app/api/search/*` basic FTS; search dialog components.

## Scope
1. Add a "Deep search" mode toggle in the search dialog that calls a new
   session-authed endpoint wrapping the depth/RAG search (same tenant scoping,
   NOT the agent API key path), returning grouped results with snippet +
   relevance and link-hop context ("found via [[X]]").
2. Keep instant-FTS as the default typing experience; deep mode on demand
   (button or Cmd+Enter) since it's costlier.
3. De-chemistry-fy: make `agenticSearch` categories configurable (fallback to
   generic categories when no chemistry taxonomy present).
4. Explicit non-goal: no embedding/vector search in this story (no pgvector
   infra yet) — note as future work.

## Acceptance criteria
- AC1: Deep search finds a page whose match is only reachable via a wikilink
  hop / related page where FTS misses it (fixture-verified).
- AC2: Typing latency of default search unchanged.
- AC3: No agent-API auth bypass: new endpoint requires a session, tenant-scoped.
- AC4: tsc + vitest green.

## Affected files (expected)
- new `src/app/api/search/deep/route.ts`
- search dialog components; `src/lib/agent/kbQuery.ts` (export a
  session-callable entry + configurable categories)

## Verification
Fixture unit tests + live comparison FTS vs deep on seeded data.
