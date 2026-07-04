# A70-13 — Surface unlinked mentions in the page connections panel

## Provenance & ownership
- **Project owner:** Martin Priessner (martin.priessner@scisymbio.ai)
- **Created by:** Agent 70
- **Created:** 2026-07-03
- **Status:** draft (improvement — do not implement yet)
- **Assigned to / currently owned by:** unassigned
- **Related / parallel work:** `SKB-34.3-link-discovery-and-connection-suggestions.md` (built the engine this story exposes), `SKB-33.3-enriched-page-connections-panel.md` (the panel this extends).

## Problem
The link-discovery engine already finds unlinked title mentions with confidence
scores, but its only consumer is the agent sweep — no human ever sees them. The
connections panel shows backlinks and outgoing links only. "Unlinked mentions
with one-click link" is a defining Obsidian feature and directly strengthens
the knowledge graph.

## Evidence
- Engine: `src/lib/sweep/linkDiscovery.ts:70-175`
  (`discoverUnlinkedReferences`, confidence-scored).
- Sole consumer: `src/app/api/agent/sweep/route.ts:47`.
- Panel without mentions: `src/components/page/PageConnectionsPanel.tsx`.

## Scope
1. Endpoint `GET /api/pages/[id]/unlinked-mentions` (tenant-scoped) wrapping the
   discovery engine for a single target page, capped (e.g. 20), sorted by
   confidence. Watch cost: engine may scan many pages — reuse the search index
   rather than full scans if that's how the sweep does it; cache briefly.
2. Connections panel: "Unlinked mentions" section listing source page + snippet
   with the mention highlighted; per-item **Link** button that converts the
   plain-text mention into a `[[wikilink]]` in the source page (server-side
   content edit through the normal save path so links/search/mirror update) —
   plus "dismiss" (per-page, persisted, so dismissed suggestions stay hidden).
3. Loading/empty states; count badge on the section header.

## Acceptance criteria
- AC1: A page titled X shows pages that mention "X" without linking; clicking
  Link rewrites the mention into a wikilink and moves the item to backlinks.
- AC2: The rewrite respects optimistic-concurrency (bumps block version) and
  never corrupts unrelated content (positional replace validated against
  current text).
- AC3: Dismissed mentions persist across reloads.
- AC4: tsc + vitest green; unit tests for mention→wikilink rewriting edge cases
  (mention inside code block, multiple occurrences, case sensitivity).

## Affected files (expected)
- new `src/app/api/pages/[id]/unlinked-mentions/route.ts`
- `src/components/page/PageConnectionsPanel.tsx`
- `src/lib/sweep/linkDiscovery.ts` (single-target entry point)

## Verification
Unit tests + live check with seeded mention pages.
