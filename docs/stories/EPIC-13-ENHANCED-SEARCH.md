# Epic 13: Enhanced Search

**Epic ID:** EPIC-13
**Created:** 2026-02-22
**Total Story Points:** 21
**Priority:** High
**Status:** Planned

---

## Epic Overview

Epic 13 enhances the existing PostgreSQL full-text search foundation with a comprehensive search dialog (not just the quick switcher), keyword highlighting in results, advanced filtering capabilities, and deep content search. The current QuickSwitcher provides basic title matching — this epic adds full content search with rich result previews showing matched text snippets with highlighted keywords, date filters, content type filters, and search history.

This epic transforms search from "find pages by title" to "find any content anywhere in the knowledge base with precision tools."

This epic covers advanced search requirements beyond the MVP search implemented in Epic 6.

---

## Business Value

- **Content discoverability**: Users can find information buried in page content, not just in titles — this makes large knowledge bases usable
- **Precision tools**: Filters by date and content type help users narrow down results when broad searches return too many matches
- **Keyword highlighting**: Visual feedback shows users exactly why a result matched, reducing time spent scanning results
- **Search history**: Repeated searches are faster — users can re-run common queries instantly
- **Agent-friendly**: Enhanced search API supports LLM agents that need to retrieve relevant context from the knowledge base
- **PostgreSQL-native**: All features use PostgreSQL's built-in full-text search — no external search service required, keeping the 2-container architecture simple

---

## Architecture Summary

```
Enhanced Search Architecture
────────────────────────────

User opens search → Cmd+Shift+F or sidebar "Search"
        │
        ▼
┌────────────────────────────────────────────────┐
│  EnhancedSearchDialog.tsx                      │
│  (larger than QuickSwitcher)                   │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │  🔍  Search...                            │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │  Filters:  [Date Range]  [Content Type]  │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │  📄 PostgreSQL Setup Guide    85%        │  │
│  │  ...setup <mark>PostgreSQL</mark>...     │  │
│  │  Updated: 2026-02-15                      │  │
│  ├──────────────────────────────────────────┤  │
│  │  📐 Database Architecture      72%        │  │
│  │  ...<mark>setup</mark> process...        │  │
│  │  Updated: 2026-02-10                      │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  Recent searches: [postgresql setup] [api]     │
└────────────────────────────────────────────────┘
        │
        ▼ GET /api/search?q=term&dateFrom=...&contentType=code
        │
┌────────────────────────────────────────────────┐
│  Enhanced Search API                            │
│  - PostgreSQL ts_rank for relevance            │
│  - ts_headline for snippet generation           │
│  - Filter by date range (createdAt/updatedAt)  │
│  - Filter by content type (has code/images)     │
│  - Pagination with cursor                       │
└────────────────────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────────────────┐
│  PostgreSQL                                     │
│  - search_vector (tsvector, GIN indexed)        │
│  - plain_text (extracted from TipTap JSON)      │
│  - Updated by trigger on block insert/update    │
└────────────────────────────────────────────────┘
```

---

## Stories Breakdown

### SKB-13.1: Enhanced Search Dialog UI — 5 points, High

**Delivers:** `EnhancedSearchDialog` component — a full-featured search modal (Cmd+Shift+F or click "Search" in sidebar). Larger than QuickSwitcher (full height, wider). Shows: search input, filter chips (date range, content type), result list with page title + content snippet + date + relevance indicator. Keyboard navigation (arrow keys, Enter to open). Infinite scroll for results (loads more on scroll). Accessibility: focus management, ARIA roles, screen reader support.

**Depends on:** SKB-06.3 (SearchDialog foundation), SKB-13.2 (Enhanced search API)

---

### SKB-13.2: Content Search API — 5 points, Critical

**Delivers:** Enhanced `/api/search` endpoint with content search and filters. Uses PostgreSQL `ts_rank` for relevance scoring. Returns matched snippets with `ts_headline` for keyword highlighting. Searches across page titles AND block plainText content. Supports filters: `dateFrom`, `dateTo`, `contentType` (has code blocks, has images, has links). Pagination with cursor-based approach for performance. All results include: `pageId`, `pageTitle`, `pageIcon`, `snippet` (with `<mark>` tags), `rank`, `updatedAt`, `matchedBlockIds` (for future "jump to block" feature).

**Depends on:** SKB-06.1 (FTS infrastructure), SKB-06.2 (basic search API)

---

### SKB-13.3: Keyword Highlighting in Results — 3 points, High

**Delivers:** Client-side keyword highlighting in search results. Uses `<mark>` tags from `ts_headline` server-side, styles them with custom CSS (yellow background in light mode, dark yellow in dark mode). Handles partial matches and multiple terms. Works in both page title and snippet preview. Uses DOMPurify for XSS safety. Custom `HighlightedText` component for reusability.

**Depends on:** SKB-13.2 (API must return snippets with `<mark>` tags)

---

### SKB-13.4: Search Filters & History — 8 points, High

**Delivers:** Filter chips UI: date range picker (react-day-picker), content type toggles (code/images/links). Recent searches stored in `localStorage` (last 10, FIFO). Search suggestions based on page titles (autocomplete dropdown). Clear search history button. Filter state managed with URL query params (shareable search URLs). "Save search" feature (stores filter + query to localStorage with custom name).

**Depends on:** SKB-13.2 (API must support filter params), SKB-13.1 (UI to host filters)

---

## Test Coverage Requirements

| Story | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 13.1 | EnhancedSearchDialog renders correctly; filter chips update state; infinite scroll triggers fetch | - | Open dialog, apply filters, scroll results, verify more load |
| 13.2 | Enhanced search API validates filter params; filters applied to query | Search with filters returns filtered results; ts_headline generates snippets | API call with filters returns correct results |
| 13.3 | HighlightedText component renders mark tags; DOMPurify sanitizes HTML | - | Search results show highlighted keywords |
| 13.4 | Search history saves/loads from localStorage; date picker updates filter state | - | Apply filters, verify URL updates; reload page, filters persist |

---

## Implementation Order

```
13.2 → 13.1 → 13.3 → 13.4 (sequential with parallel opportunities)

┌────────┐
│ 13.2   │──┐
│ API    │  │
└────────┘  │
            ├──▶ ┌────────┐
            │    │ 13.1   │──┐
            └──▶ │ Dialog │  │
                 └────────┘  │
                             ├──▶ ┌────────┐
                             │    │ 13.3   │
                             └──▶ │Highlight│
                                  └────────┘
                                       │
                                       ▼
                                  ┌────────┐
                                  │ 13.4   │
                                  │Filters │
                                  └────────┘
```

**Rationale:**
- 13.2 (API) must be completed first — it's the foundation for all UI features
- 13.1 (Dialog) and 13.3 (Highlighting) can start once API is working
- 13.4 (Filters) should be last — it builds on the complete search UI

---

## Shared Constraints

- All database queries must include `tenant_id` for multi-tenant isolation
- API responses follow the standard envelope: `{ data, meta }` for success, `{ error, meta }` for failure
- TypeScript strict mode — no `any` types allowed
- All UI components use Tailwind utility classes only — no custom CSS classes
- Search input must be sanitized before being passed to `plainto_tsquery` to prevent SQL injection
- Debounce interval remains 300ms for consistency with QuickSwitcher
- Maximum search result limit is 100 to prevent excessive database load
- Filter state must be URL-serializable for shareable search URLs
- `ts_headline` configuration: `MaxWords=50, MinWords=25, MaxFragments=2` for consistent snippet length
- localStorage keys must be tenant-scoped to support multi-tenant usage
- All search features must work with keyboard-only navigation (accessibility requirement)

---

## Files Created/Modified by This Epic

### New Files
- `src/components/search/EnhancedSearchDialog.tsx` — full search dialog with filters
- `src/components/search/FilterChips.tsx` — filter UI components
- `src/components/search/HighlightedText.tsx` — keyword highlighting component
- `src/components/search/SearchHistory.tsx` — recent searches display
- `src/components/search/DateRangePicker.tsx` — date filter UI
- `src/hooks/useSearchHistory.ts` — localStorage-backed search history hook
- `src/hooks/useSearchFilters.ts` — URL-backed filter state hook
- `src/lib/search/filters.ts` — filter query builder utilities
- `src/lib/search/highlight.ts` — client-side highlight utilities
- `src/types/search.ts` — enhanced search types (SearchFilters, ContentTypeFilter)
- `src/__tests__/components/search/EnhancedSearchDialog.test.tsx`
- `src/__tests__/components/search/FilterChips.test.tsx`
- `src/__tests__/components/search/HighlightedText.test.tsx`
- `src/__tests__/hooks/useSearchHistory.test.ts`
- `src/__tests__/hooks/useSearchFilters.test.ts`
- `src/__tests__/lib/search/filters.test.ts`
- `tests/e2e/enhanced-search.spec.ts`

### Modified Files
- `src/app/api/search/route.ts` — add filter params (dateFrom, dateTo, contentType)
- `src/lib/search/query.ts` — enhance buildSearchQuery with filter support
- `src/components/sidebar/Sidebar.tsx` — add "Search" button that opens EnhancedSearchDialog
- `src/app/(workspace)/layout.tsx` — register EnhancedSearchDialog at workspace level
- `src/types/search.ts` — add SearchFilters, ContentTypeFilter types

---

**Last Updated:** 2026-02-22
