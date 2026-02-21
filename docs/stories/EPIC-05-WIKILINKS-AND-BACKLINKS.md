# Epic 5: Wikilinks & Backlinks

**Epic ID:** EPIC-05
**Created:** 2026-02-21
**Total Story Points:** ~18
**Priority:** Critical
**Status:** Draft

---

## Epic Overview

Epic 5 implements the `[[wikilink]]` system that connects pages in the knowledge graph. This is the defining feature that transforms SymbioKnowledgeBase from a simple page editor into a networked knowledge base. The epic delivers: a custom TipTap extension for `[[` autocomplete, a wikilink parser that extracts links from block content, a `page_links` index table for fast backlink and graph queries, a backlinks panel on every page, and automatic link integrity on page rename.

Wikilinks use page IDs internally (not title text), ensuring links survive renames. The display text defaults to the page title but can be overridden with the `[[Page Name|Display Text]]` syntax.

This epic is the bridge between the editor (Epic 4) and the knowledge graph (Epic 7). The `page_links` table it maintains is the data source for graph visualization and relationship queries.

Covers FR15-19 (Wikilinks) and FR37 (REST API link endpoints).

---

## Business Value

- Transforms isolated pages into a connected knowledge network — the core differentiator from a simple note-taking app
- Backlinks surface implicit relationships that users may not have been aware of
- Autocomplete makes linking frictionless — users discover existing pages as they type
- Automatic link maintenance on rename eliminates broken links
- The `page_links` index enables the knowledge graph (Epic 7) and contextual search (Epic 6) with zero additional API calls for link data

---

## Architecture Summary

```
TipTap Editor (Epic 4)
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  User types: "See [[Inst"                                    │
│                                                              │
│  ┌─────────────────────────────────┐                        │
│  │  Wikilink Autocomplete          │                        │
│  │  ┌────────────────────────────┐ │                        │
│  │  │ 📄 Installation Guide      │ │  ← GET /api/pages?    │
│  │  │ 📄 Installing Docker       │ │     search=Inst&       │
│  │  └────────────────────────────┘ │     tenant_id=...      │
│  └─────────────────────────────────┘                        │
│                                                              │
│  Selects "Installation Guide" →                             │
│  Inserts: [[page_id:uuid|Installation Guide]]               │
│  Renders: "Installation Guide" as clickable link             │
│                                                              │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           │  On save (auto-save / manual)
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  Wikilink Parser & Indexer                                    │
│                                                              │
│  lib/wikilinks/parser.ts                                     │
│  ── Traverses JSONB block content                            │
│  ── Extracts all wikilink nodes (target page IDs)            │
│                                                              │
│  lib/wikilinks/indexer.ts                                     │
│  ── Diffs current links vs stored links                      │
│  ── INSERT new links, DELETE removed links                   │
│  ── Runs inside the block-save transaction                   │
│                                                              │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  PostgreSQL 18 — page_links table                            │
│                                                              │
│  id              UUID PRIMARY KEY                            │
│  tenant_id       UUID NOT NULL → tenants(id)                 │
│  source_page_id  UUID NOT NULL → pages(id)                   │
│  target_page_id  UUID NOT NULL → pages(id)                   │
│  created_at      TIMESTAMPTZ                                 │
│                                                              │
│  UNIQUE INDEX: (tenant_id, source_page_id, target_page_id)  │
│  INDEX: (tenant_id, target_page_id)  ← fast backlink lookup │
│  INDEX: (tenant_id, source_page_id)  ← fast outlink lookup  │
│                                                              │
└────────────┬─────────────────────────────────┬───────────────┘
             │                                 │
             ▼                                 ▼
┌──────────────────────┐          ┌──────────────────────────┐
│  Backlinks Panel     │          │  Knowledge Graph (Epic 7) │
│                      │          │                            │
│  GET /api/pages/:id  │          │  GET /api/graph            │
│       /backlinks     │          │  (reads page_links for     │
│                      │          │   nodes and edges)         │
│  Shows:              │          │                            │
│  📄 Page A           │          │  Visualizes with           │
│    "...links to      │          │  react-force-graph         │
│     this page..."    │          │                            │
│  📄 Page B           │          │                            │
│    "...also refs..." │          │                            │
└──────────────────────┘          └──────────────────────────┘

Link Integrity on Rename:
┌──────────────────────────────────────────────────────────────┐
│  PUT /api/pages/:id  { title: "New Name" }                   │
│                                                              │
│  Since wikilinks store page IDs (not titles), the link       │
│  [[page_id:uuid|Old Name]] still resolves correctly.         │
│                                                              │
│  Display text options:                                        │
│  1. [[page_id]] → always renders current page title (live)   │
│  2. [[page_id|Custom Text]] → renders "Custom Text" (static)│
│                                                              │
│  No bulk-update of content needed — links are ID-based.      │
└──────────────────────────────────────────────────────────────┘
```

---

## Stories Breakdown

### SKB-05.1: Wikilink Parser and Page Link Index — 5 points, Critical

**Delivers:**
- `src/lib/wikilinks/parser.ts` — Traverses TipTap JSONB document content and extracts all wikilink nodes, returning an array of `{ targetPageId, displayText }` objects.
- `src/lib/wikilinks/indexer.ts` — Maintains the `page_links` table. On every block save: (1) parses the saved content for wikilinks, (2) compares against existing `page_links` rows for that source page, (3) inserts new links, deletes removed links (diff-based approach to avoid unnecessary writes). Runs within the same database transaction as the block save.
- Index updated on every block save — both auto-save and manual save trigger re-indexing.
- Handles edge cases: duplicate links to same page counted once, links to non-existent pages stored but flagged, self-links allowed.

**Depends on:** SKB-04.1 (block content must be saveable in JSONB format)

---

### SKB-05.2: Wikilink TipTap Extension with Autocomplete — 5 points, Critical

**Delivers:**
- Custom TipTap node extension (`wikilinkNode`) that renders wikilink nodes in the editor as styled, clickable inline elements.
- Typing `[[` triggers an autocomplete popup showing page names matching the typed query (fetched via `GET /api/pages?search=<query>&tenant_id=<id>&limit=10`).
- Autocomplete is keyboard-navigable (arrow keys + Enter to select, Escape to dismiss).
- Selecting a page inserts a `wikilinkNode` with `targetPageId` (UUID) and `displayText` (page title) attributes.
- Support for `[[Page Name|Custom Display]]` syntax — if user types a pipe character, text after pipe becomes the display text.
- Clicking a rendered wikilink navigates to the target page (`/pages/:targetPageId`).
- Wikilinks to deleted or non-existent pages render with a "broken link" visual indicator (red styling, strikethrough).

**Depends on:** SKB-05.1 (parser must exist so links are indexed on save), SKB-04.1 (editor must be mounted)

---

### SKB-05.3: Backlinks Panel and API — 5 points, High

**Delivers:**
- `GET /api/pages/:id/backlinks` endpoint that queries the `page_links` table for all rows where `target_page_id = :id` and `tenant_id` matches. Returns an array of source pages with their titles, icons, and a text excerpt showing the context around the wikilink.
- `BacklinksPanel` component rendered below the editor on each page view. Shows a collapsible section titled "Backlinks (N)" where N is the count of linking pages.
- Each backlink entry shows: page icon, page title (clickable link), and a snippet of the surrounding text for context.
- Empty state: "No pages link to this page yet."
- Backlinks panel data fetched via TanStack Query with appropriate cache invalidation when links change.
- `GET /api/pages/:id/links` endpoint for forward links (outgoing links from this page) — used by the knowledge graph in Epic 7.

**Depends on:** SKB-05.1 (page_links table must be populated), SKB-03.1 (page API for fetching source page metadata)

---

### SKB-05.4: Auto-Update Links on Page Rename — 3 points, High

**Delivers:**
- Since wikilinks store `targetPageId` (UUID) internally rather than page title text, links inherently survive page renames — no content migration needed.
- When a wikilink node renders in the editor, it resolves the current page title from the page record (live resolution). This means if "Installation Guide" is renamed to "Setup Guide," all wikilinks to it automatically display "Setup Guide" on next load.
- Wikilinks with explicit display text (`[[page_id|Custom Text]]`) preserve the custom text — only auto-display-text links update.
- Cache invalidation: when a page is renamed, TanStack Query cache for any page containing wikilinks to the renamed page is invalidated so display text updates on next view.
- Edge case: if a linked page is deleted, the wikilink renders with broken-link styling and the display text falls back to "Deleted Page."

**Depends on:** SKB-05.2 (wikilink extension must be functional)

---

## Test Coverage Requirements

| Story | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 05.1 | Parser extracts correct link targets from JSONB, handles zero/one/many links, handles duplicate links, handles malformed nodes gracefully | Indexer creates correct page_links rows, diff logic adds new and removes stale links, transaction rollback on failure | - |
| 05.2 | Wikilink node renders with correct attributes, autocomplete filters pages by query, pipe syntax splits display text | Autocomplete fetches pages from API, inserted node contains correct targetPageId | Type [[ → see suggestions → select page → wikilink inserted → click → navigates |
| 05.3 | BacklinksPanel renders correct count and entries, empty state renders correctly | Backlinks API returns correct source pages with excerpts, respects tenant isolation | Create Page A → link to Page B from Page A → open Page B → see Page A in backlinks |
| 05.4 | Live title resolution returns current title, custom display text preserved on rename | Rename page → backlinks and wikilinks in other pages show updated title | Rename page → navigate to linking page → wikilink shows new name |

---

## Implementation Order

```
05.1 → 05.2 → 05.3 (sequential core path)
              │
              └──▶ 05.4 (after wikilink extension is functional)

Timeline visualization:
  05.1  Wikilink Parser & Page Link Index
    │
    └──▶ 05.2  Wikilink TipTap Extension with Autocomplete
          │
          ├──▶ 05.3  Backlinks Panel and API
          │
          └──▶ 05.4  Auto-Update Links on Page Rename
```

---

## Shared Constraints

- All wikilinks store `targetPageId` (UUID) internally — never raw page title text
- The `page_links` table is an index, not a source of truth — it can be fully rebuilt from block content at any time
- Link indexing runs inside the block-save database transaction — if the save fails, links are not updated
- All API responses follow the standard envelope: `{ data, meta }` for success, `{ error, meta }` for failure
- All database queries include `tenant_id` — a user in Tenant A cannot see links between pages in Tenant B
- Autocomplete queries are debounced (300ms) to avoid excessive API calls while typing
- Maximum 10 autocomplete suggestions returned per query
- TypeScript strict mode — all TipTap extension node attributes fully typed
- Wikilink rendering must be SSR-compatible (no `window` references in parser/indexer)

---

## Files Created/Modified by This Epic

### New Files
- `src/lib/wikilinks/parser.ts` — Extract wikilink targets from JSONB content
- `src/lib/wikilinks/indexer.ts` — Maintain page_links table (diff-based insert/delete)
- `src/lib/wikilinks/types.ts` — Wikilink TypeScript types
- `src/components/editor/extensions/wikilink.ts` — TipTap wikilink node extension
- `src/components/editor/WikilinkAutocomplete.tsx` — Autocomplete popup component
- `src/components/page/BacklinksPanel.tsx` — Backlinks display panel
- `src/app/api/pages/[id]/backlinks/route.ts` — Backlinks API endpoint
- `src/app/api/pages/[id]/links/route.ts` — Forward links API endpoint
- `src/hooks/useBacklinks.ts` — TanStack Query hook for backlinks data
- `src/hooks/usePageSearch.ts` — TanStack Query hook for autocomplete search
- `src/types/wikilink.ts` — Wikilink-related TypeScript types

### Modified Files
- `src/components/editor/BlockEditor.tsx` — Register wikilink extension, add autocomplete trigger
- `src/app/api/pages/[id]/blocks/route.ts` — Call wikilink indexer after block save
- `src/app/(workspace)/pages/[id]/page.tsx` — Add BacklinksPanel below editor
- `src/components/editor/SlashCommandMenu.tsx` — No changes (wikilinks inserted via [[ not /)
- `prisma/schema.prisma` — No changes (page_links table defined in Epic 1)

---

**Last Updated:** 2026-02-21
