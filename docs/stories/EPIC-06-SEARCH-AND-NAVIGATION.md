# Epic 6: Search & Navigation

**Epic ID:** EPIC-06
**Created:** 2026-02-21
**Total Story Points:** 13
**Priority:** High
**Status:** Draft

---

## Epic Overview

Epic 6 implements full-text search using PostgreSQL tsvector, the search API endpoint, search-as-you-type UI, and the quick switcher overlay (Cmd/Ctrl+K). The search pipeline starts at the database level with a tsvector column and GIN index on the blocks table, flows through a tenant-scoped REST API that returns ranked results with highlighted snippets, and surfaces in the frontend as both a dedicated search dialog and a global command palette.

This epic covers FR20-24 (search functionality) and FR35 (quick switcher navigation).

---

## Business Value

- Full-text search is the primary way users rediscover information in a knowledge base — without it, content is effectively lost once it scrolls out of the sidebar
- PostgreSQL-native FTS avoids introducing a separate search service (Elasticsearch/Meilisearch), keeping the 2-container architecture simple
- The quick switcher (Cmd/Ctrl+K) is the power-user navigation pattern that Notion, Obsidian, and VS Code users expect — it dramatically reduces time-to-page
- Search-as-you-type with debouncing provides instant feedback without overwhelming the database

---

## Architecture Summary

```
User types search query
        │
        ▼
┌──────────────────────────────┐
│  SearchDialog / QuickSwitcher │
│  (debounce 300ms)             │
│  components/search/           │
└──────────┬───────────────────┘
           │  GET /api/search?q=term&limit=20&offset=0
           ▼
┌──────────────────────────────┐
│  /api/search/route.ts        │
│  - Validate query params     │
│  - Build tsquery from input  │
│  - Scope by tenant_id        │
│  - Return { data, meta }     │
└──────────┬───────────────────┘
           │  Prisma raw query
           ▼
┌──────────────────────────────────────────────────┐
│  PostgreSQL 18                                    │
│                                                   │
│  blocks table                                     │
│  ┌────────────────────────────────────────────┐  │
│  │ id │ page_id │ content │ search_vector     │  │
│  │    │         │         │ (tsvector, GIN)   │  │
│  └────────────────────────────────────────────┘  │
│                                                   │
│  Trigger: tsvector_update_trigger                 │
│  - Fires on INSERT/UPDATE of blocks.content      │
│  - Updates search_vector automatically            │
│                                                   │
│  Query: ts_rank(search_vector, plainto_tsquery()) │
│  Snippet: ts_headline(content, plainto_tsquery()) │
└──────────────────────────────────────────────────┘
```

---

## Stories Breakdown

### SKB-06.1: PostgreSQL Full-Text Search Setup — 3 points, Critical

**Delivers:** tsvector column (`search_vector`) on the `blocks` table with a GIN index for fast full-text lookups. A PostgreSQL trigger (`tsvector_update_trigger`) that automatically updates `search_vector` whenever `blocks.content` is inserted or updated. `lib/search/indexer.ts` providing a `reindexAllBlocks(tenantId)` function for manual bulk reindexing. `lib/search/query.ts` providing `buildSearchQuery(term, tenantId, limit, offset)` that constructs the FTS query with `plainto_tsquery`, `ts_rank` for relevance scoring, and `ts_headline` for snippet generation.

**Depends on:** SKB-04.1 (block CRUD must exist so blocks table has content to index)

---

### SKB-06.2: Search API Endpoint — 3 points, Critical

**Delivers:** `GET /api/search?q=term&limit=20&offset=0` endpoint. Validates query parameters with Zod (q required, min length 1; limit optional, default 20, max 100; offset optional, default 0). Calls `buildSearchQuery` from `lib/search/query.ts`. Returns standard API envelope `{ data: SearchResult[], meta: { total, limit, offset } }` where each `SearchResult` includes `pageId`, `pageTitle`, `snippet` (from `ts_headline`), `rank`, and `updatedAt`. All queries scoped by `tenant_id` from session. Returns 401 if unauthenticated.

**Depends on:** SKB-06.1 (FTS infrastructure must exist)

---

### SKB-06.3: Search UI with Instant Results — 4 points, High

**Delivers:** `SearchDialog` component (`components/search/SearchDialog.tsx`) with a search input field, debounced search-as-you-type (300ms debounce using a custom `useDebounce` hook), result cards showing page title and matching snippet with highlighted search terms, click-to-navigate using `next/navigation`. Loading skeleton shown during search. Empty state for no results. TanStack Query for data fetching with caching. Accessible: input is focused on mount, results navigable with arrow keys, Enter to select.

**Depends on:** SKB-06.2 (search API must return results)

---

### SKB-06.4: Quick Switcher (Cmd/Ctrl+K) — 3 points, High

**Delivers:** `QuickSwitcher` component (`components/search/QuickSwitcher.tsx`) — a global command palette overlay triggered by Cmd+K (macOS) / Ctrl+K (Windows/Linux). Uses a `useHotkeys` hook registered at the root layout level. Modal overlay with backdrop blur. Same search functionality as `SearchDialog` (reuses search hook). When the search input is empty, displays recent pages (last 5 visited, stored in `localStorage`). Escape key or clicking backdrop closes the overlay. Focus trapped within the modal while open.

**Depends on:** SKB-06.3 (SearchDialog provides shared search logic and components)

---

## Test Coverage Requirements

| Story | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 06.1 | `indexer.ts` reindexes blocks correctly; `query.ts` builds valid SQL | Trigger updates tsvector on block insert/update; GIN index used in query plan | - |
| 06.2 | Zod validation rejects invalid params; response shape matches envelope | Search returns ranked results for known content; tenant isolation verified | Search API returns results via HTTP |
| 06.3 | SearchDialog renders input; debounce delays API call; result cards render | - | Type query, see results, click result navigates to page |
| 06.4 | Cmd+K opens overlay; Escape closes; recent pages shown when empty | - | Cmd+K opens switcher, type query, arrow-key select, Enter navigates |

---

## Implementation Order

```
06.1 → 06.2 → 06.3 → 06.4 (strictly sequential)

┌────────┐     ┌────────┐     ┌────────┐     ┌────────┐
│ 06.1   │────▶│ 06.2   │────▶│ 06.3   │────▶│ 06.4   │
│ FTS    │     │ API    │     │ Search │     │ Quick  │
│ Setup  │     │ Route  │     │ UI     │     │Switcher│
└────────┘     └────────┘     └────────┘     └────────┘
```

---

## Shared Constraints

- All database queries must include `tenant_id` for multi-tenant isolation
- API responses follow the standard envelope: `{ data, meta }` for success, `{ error, meta }` for failure
- TypeScript strict mode — no `any` types allowed
- All UI components use Tailwind utility classes only — no custom CSS classes
- Search input must be sanitized before being passed to `plainto_tsquery` to prevent SQL injection
- Debounce interval is 300ms — not configurable by the user in MVP but extracted as a constant
- Maximum search result limit is 100 to prevent excessive database load

---

## Files Created/Modified by This Epic

### New Files
- `prisma/migrations/XXXXXX_add_search_vector/migration.sql` — adds search_vector column, GIN index, trigger
- `src/lib/search/indexer.ts` — bulk reindex utility
- `src/lib/search/query.ts` — FTS query builder with ts_rank and ts_headline
- `src/app/api/search/route.ts` — search API endpoint
- `src/components/search/SearchDialog.tsx` — search-as-you-type dialog
- `src/components/search/SearchResultCard.tsx` — individual search result display
- `src/components/search/QuickSwitcher.tsx` — Cmd/Ctrl+K command palette overlay
- `src/hooks/useDebounce.ts` — debounce hook for search input
- `src/hooks/useHotkeys.ts` — global keyboard shortcut hook
- `src/hooks/useSearch.ts` — shared TanStack Query search hook
- `src/__tests__/lib/search/indexer.test.ts`
- `src/__tests__/lib/search/query.test.ts`
- `src/__tests__/api/search/route.test.ts`
- `src/__tests__/components/search/SearchDialog.test.tsx`
- `src/__tests__/components/search/QuickSwitcher.test.tsx`

### Modified Files
- `prisma/schema.prisma` — add search_vector field annotation (if using Prisma-level representation)
- `src/app/(workspace)/layout.tsx` — register QuickSwitcher at workspace layout level
- `src/types/api.ts` — add SearchResult type definition

---

**Last Updated:** 2026-02-21