# EPIC-53: Dual Search Pipeline (RAG + Hierarchy-Guided Agentic Search)

**Status:** Done
**Created:** 2026-03-27

## Context

The kb-query endpoint returned poor results for voice agent queries due to:
1. Entity extraction skipping Experiments and Substrate Classes
2. No relevance ranking (ILIKE ordered by updatedAt)
3. Naive answer synthesis (concatenation, hard 500-char cap)

## Stories

### SKB-53.1: Fix Entity Extraction (2 pts) — Done
Added Experiments + Substrate Classes to entity extraction categories. Added ELN ID regex matching.

### SKB-53.2: Replace ILIKE with PostgreSQL FTS (3 pts) — Done
Content search now uses `search_vector @@ plainto_tsquery()` with `ts_rank()` scoring. Title search still uses ILIKE. Results ranked by relevance.

### SKB-53.3: RAG Search with Wikilink Following (5 pts) — Done
New `ragSearch.ts`: FTS over all content + title matching, then configurable 0/1/2-hop wikilink following via PageLink table.

### SKB-53.4: Hierarchy-Guided Agentic Search (5 pts) — Done
New `agenticSearch.ts`: Deterministic state machine that navigates KB hierarchy — classifies intent, scans relevant category pages, deep-reads top matches using TF-IDF scoring, follows cross-references.

### SKB-53.5: Search Strategy Router (5 pts) — Done
New `searchRouter.ts`: Auto-selects RAG (short/specific), Agentic (complex/comparative), or Combined. Callers can force strategy via `strategy` param.

### SKB-53.6: Smart Answer Synthesis (5 pts) — Done
Rewritten synthesis with intent-specific templates, source citations, smart truncation at sentence boundaries. Configurable `max_answer_length` (500 for voice, up to 5000 for text chat).

### SKB-53.7: Query Result Caching (4 pts) — Done
In-memory LRU cache with query normalization (stopword removal, token sorting). 5-minute TTL, auto-invalidation on content changes.

## Files Created/Modified

| File | Action |
|------|--------|
| `src/lib/agent/kbQuery.ts` | Fixed entity extraction, integrated router, rewrote synthesis, added caching |
| `src/lib/search/depthSearch.ts` | Replaced ILIKE with FTS for content search |
| `src/lib/search/ragSearch.ts` | **NEW** — RAG search with wikilink following |
| `src/lib/search/agenticSearch.ts` | **NEW** — Hierarchy-guided agentic search |
| `src/lib/search/searchRouter.ts` | **NEW** — Strategy router |
| `src/lib/search/categoryUtils.ts` | **NEW** — Shared category detection |
| `src/lib/search/contentUtils.ts` | **NEW** — Shared content extraction |
| `src/lib/search/queryCache.ts` | **NEW** — LRU query cache |
| `src/lib/search/indexer.ts` | Added cache invalidation |
| `src/app/api/agent/kb-query/route.ts` | Added strategy, max_answer_length params |
| `scripts/seed-chemistry-kb.ts` | Fixed env loading, kept load-env.ts preloader |

## API Changes

`POST /api/agent/kb-query` now accepts:
- `strategy`: `"auto"` (default), `"rag"`, or `"agentic"`
- `max_answer_length`: 100-5000 (default 500)

Response `query_metadata` now includes:
- `search_strategy`: `"rag"`, `"agentic"`, or `"combined"`

## Verification

```bash
# RAG search
curl -X POST http://localhost:3000/api/agent/kb-query \
  -H "Authorization: Bearer skb_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{"query": "EXP-2026-0042", "strategy": "rag"}'

# Agentic search
curl -X POST http://localhost:3000/api/agent/kb-query \
  -H "Authorization: Bearer skb_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{"query": "Compare substrate classes for coupling", "strategy": "agentic"}'

# Auto routing + longer answers
curl -X POST http://localhost:3000/api/agent/kb-query \
  -H "Authorization: Bearer skb_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{"query": "aspirin synthesis procedure", "max_answer_length": 2000}'
```
