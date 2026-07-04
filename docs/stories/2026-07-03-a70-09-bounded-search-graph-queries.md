# A70-09 — Bound the unbounded reads on agent search and global graph

## Provenance & ownership
- **Project owner:** Martin Priessner (martin.priessner@scisymbio.ai)
- **Created by:** Agent 70
- **Created:** 2026-07-03
- **Status:** draft (improvement — do not implement yet; reviewed round 1)
- **Assigned to / currently owned by:** unassigned
- **Related / parallel work:** `EPIC-18-ENHANCED-GRAPH.md` (graph perf knobs), `SKB-53.x` KB query work, `SKB-15.2-mcp-server.md` (documented external MCP consumer of the graph endpoint).

## Problem
Two hot paths load entire tenant datasets on every request: the agent search
route fetches ALL tenant pages into a Map just to build breadcrumbs for ~a page
of results, and the global-graph endpoint fetches all pages + all pageLinks
with no cap. Fine at demo scale; linear degradation as the KB grows (chemistry
ingestion can create thousands of pages).

## Evidence
- `src/app/api/agent/search/route.ts:179` — `prisma.page.findMany` (no `take`)
  for breadcrumb resolution, feeding `generatePagePath` at
  **`src/lib/agent/pageTree.ts:109-124`** (imported at `search/route.ts:6`;
  the silent-truncation `if (!page) break` is at `:118`). *(Path corrected in
  round 2 — the draft cited a non-existent `src/lib/pages/pageTree.ts`; an
  implementer following it would edit an orphan file and leave the bug.)*
- `src/app/api/agent/graph/route.ts:92-98` — global mode: all pages + all
  links; link counts computed AFTER node selection (`:107-118`).
- **BFS mode equally unbounded (round-2):** `expandGraphBFS`
  (`graph/route.ts:16-54`) walks `pageLink.findMany` layer-by-layer to
  depth ≤5 and on a connected tenant visits the whole graph before the page
  fetch at `:92` — the `maxNodes` cap must apply to the BFS expansion too,
  not only the no-pageId branch (`:84-88`).

## Scope
1. Search: resolve breadcrumbs by fetching the FULL ancestor chain to the root
   for each result page (iterative parent fetch or recursive CTE) — NOT just
   the result rows themselves; `generatePagePath` silently truncates
   `/Experiments/Batch/EXP-1` to `/EXP-1` when an ancestor is absent from the
   map, so a partial map is a correctness regression, not an optimization.
   Bound = results × max depth (cap depth at e.g. 20).
2. Graph: add `maxNodes` cap (default e.g. 2000) + `truncated: true` flag.
   **Truncation key = `updatedAt DESC` (most-recent)** — NOT "highest degree":
   degree isn't known until links are fetched, and computing it first would
   require the very full-table read this story removes (or a `groupBy`
   aggregate; if cheap enough, that may be considered, but recent-first is the
   default). `node_count`/`edge_count` in the response must reflect the
   RETURNED set; add `total_node_count`/`total_edge_count` so consumers can
   detect truncation; document global mode as best-effort in
   `docs/api/agent-api.md` (currently documents nodes/edges/counts at
   :352-382).
3. **Below the cap, the response must be byte-identical to today** (skip the
   truncation code path entirely; no reordering) so existing shape/snapshot
   tests and consumers are untouched.
4. Micro-benchmark note in PR: measure both endpoints on a seeded 10k-page
   tenant before/after.

## Acceptance criteria
- AC1: Search route no longer scales its query count/rows with total tenant
  pages (verified via query logging in test) AND breadcrumbs remain complete
  to the root (regression test with a ≥3-deep hierarchy).
- AC2: Graph endpoint returns at most maxNodes nodes with truncation flag and
  total counts; sub-cap responses byte-identical to current behavior.
- AC3: External consumers documented: MCP server (SKB-15.2) and voice-agent
  flows tolerate the additive fields; `docs/api/agent-api.md` updated.
- AC4: tsc + vitest green; response-shape tests updated.

## Affected files (expected)
- `src/app/api/agent/search/route.ts`
- `src/app/api/agent/graph/route.ts` (global mode AND `expandGraphBFS`)
- `src/lib/agent/pageTree.ts` (ancestor-chain fetch helper — corrected path)
- `docs/api/agent-api.md`

## Verification
Unit tests (incl. deep-hierarchy breadcrumb regression test) + seeded-scale
manual benchmark.

## Reviewer Feedback / Codex (round 1) — FALLBACK: Claude Opus
*(Codex CLI broken: native binary ENOENT; lens covered by Claude Opus subagent per /story fallback rules.)*
- **(Critical)** Fetching only result-page rows breaks `generatePagePath` (`pageTree.ts:109` breaks on missing parent → silent path truncation). Must fetch full ancestor chains. → Fixed (Scope 1, AC1).
- **(Critical)** "Highest-degree" truncation requires the full pageLinks read the story is eliminating (degree computed after selection at `graph/route.ts:107-118`). → Switched to `updatedAt DESC` default (Scope 2).
- Contract: `truncated` is shape-additive (no in-repo packages/ MCP consumer found; `agent-api.md:352-382` documents the shape), but external MCP/voice consumers may assume completeness → counts must reflect returned set + `total_*` fields + docs update. → Fixed (Scope 2, AC3).
- Below-cap path must remain byte-identical (no reordering). → Fixed (Scope 3).

## Reviewer Feedback / GLM (round 2 — runtime lens, glm-5.2)
- **(Critical, factual)** Draft cited `generatePagePath` at a non-existent file (`src/lib/pages/pageTree.ts`); real site is `src/lib/agent/pageTree.ts:118`. → Paths corrected in Evidence + Affected files.
- **(Critical)** The `maxNodes` cap covered only the global branch; `expandGraphBFS` (`graph/route.ts:16-54`) is equally unbounded on connected tenants at depth ≤5. → BFS expansion brought under the cap.

## Revision History
- 2026-07-03 — Initial draft (Agent 70).
- 2026-07-03 — Round-1 regression review (Opus fallback for Codex): full ancestor-chain breadcrumbs, recent-first truncation key, total-count fields + docs, byte-identical sub-cap guarantee.
- 2026-07-03 — Round-2 GLM runtime review: corrected pageTree path, BFS mode capped. Status: Reviewed (draft — not to be implemented yet).
