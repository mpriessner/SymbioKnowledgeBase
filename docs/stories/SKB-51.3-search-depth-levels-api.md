# Story SKB-51.3: Search Depth Levels API

**Epic:** Epic 51 - Chemistry KB Voice Agent Integration
**Story ID:** SKB-51.3
**Story Points:** 5 | **Priority:** High | **Status:** Planned
**Depends On:** EPIC-46 (Chemistry KB Retrieval workflows must exist)

---

## User Story

As the voice agent, I want to search the Chemistry KB with configurable depth levels, So that simple queries return fast lightweight results while complex queries trigger deeper graph traversal for comprehensive institutional knowledge.

---

## Acceptance Criteria

1. **Enhanced Agent Search Endpoint**
   - [ ] Route: `GET /api/agent/search` (extend existing)
   - [ ] New query param: `depth` — `"default"` | `"medium"` | `"deep"`
   - [ ] New query param: `scope` — `"private"` | `"team"` | `"all"` (default: `"all"`)
   - [ ] New query param: `category` — `"experiments"` | `"chemicals"` | `"reactionTypes"` | `"researchers"` | `"substrateClasses"` (optional filter)

2. **Default Depth** (fast, lightweight)
   - [ ] Full-text search on `title` and `oneLiner` fields only
   - [ ] Returns: `pageId`, `title`, `oneLiner`, `score`, `category`, `space`
   - [ ] No content snippets (saves bandwidth)
   - [ ] Target: <100ms response time
   - [ ] Max results: 10

3. **Medium Depth** (includes content + 1-hop)
   - [ ] Full-text search on `title`, `oneLiner`, AND page content (DOCUMENT blocks)
   - [ ] Returns everything from default PLUS: `snippet` (matched content excerpt, 200 chars)
   - [ ] 1-hop expansion: for each result, also returns linked page titles
   - [ ] Target: <300ms response time
   - [ ] Max results: 20

4. **Deep Depth** (full graph traversal)
   - [ ] Full-text search across all indexed content
   - [ ] Returns everything from medium PLUS:
     - `relatedPages`: pages linked within 2 hops
     - `institutionalKnowledge`: extracted best practices sections
     - `yieldData`: historical yield information from related experiments
   - [ ] Graph traversal via `PageLink` model (breadth-first, max depth 3)
   - [ ] Target: <1,000ms response time
   - [ ] Max results: 50

5. **Scope Filtering**
   - [ ] `scope=private`: Only user's private pages
   - [ ] `scope=team`: Only team space pages (Chemistry KB)
   - [ ] `scope=all`: Both private and team (default)
   - [ ] Scope respects teamspace membership (user must be member to see team pages)

6. **Category Filtering**
   - [ ] Filter by Chemistry KB category using page ancestry
   - [ ] Category determined by parent page (Experiments, Chemicals, etc.)
   - [ ] Can combine with scope: `scope=team&category=experiments`

7. **Response Shape**
   ```json
   {
     "results": [{
       "pageId": "clx...",
       "title": "Suzuki Coupling — 4-Bromopyridine",
       "oneLiner": "Standard Suzuki coupling with Pd(PPh3)4 catalyst",
       "snippet": "...use freshly opened THF for optimal results...",
       "score": 0.85,
       "category": "experiments",
       "space": "team",
       "linkedPages": ["Pd(PPh3)4", "THF", "Dr. Anna Mueller"],
       "relatedPages": [],
       "institutionalKnowledge": []
     }],
     "totalCount": 42,
     "depth": "medium",
     "scope": "team",
     "searchTimeMs": 120
   }
   ```

---

## Technical Implementation Notes

### Extending Existing Search
The existing `/api/search` uses PostgreSQL tsvector full-text search. Extend it:

```typescript
// src/lib/search/depthSearch.ts

export type SearchDepth = "default" | "medium" | "deep";
export type SearchScope = "private" | "team" | "all";

export interface DepthSearchOptions {
  tenantId: string;
  query: string;
  depth: SearchDepth;
  scope: SearchScope;
  category?: string;
  limit?: number;
}

export async function depthSearch(opts: DepthSearchOptions): Promise<SearchResult[]> {
  // Default: title + oneLiner only
  // Medium: + content search + 1-hop
  // Deep: + graph traversal + knowledge extraction
}
```

### Graph Traversal for Deep Search
```typescript
async function expandGraph(pageIds: string[], maxDepth: number): Promise<Map<string, string[]>> {
  // BFS through PageLink table
  // Returns map of pageId → related page titles
  // Cap at maxDepth=3 to prevent runaway queries
}
```

### Content Extraction for Medium/Deep
```typescript
async function extractSnippet(pageId: string, query: string, maxLength: number): Promise<string> {
  // Fetch DOCUMENT block → TipTap JSON → plain text
  // Find best matching section around query terms
  // Return 200-char excerpt with highlights
}
```

### Key Files
- `src/app/api/agent/search/route.ts` — CREATE (or extend existing `/api/search`)
- `src/lib/search/depthSearch.ts` — CREATE
- `src/lib/search/graphExpansion.ts` — CREATE
- `src/lib/search/contentExtractor.ts` — CREATE (or reuse from SKB-51.2)

---

## Test Scenarios

| Scenario | Expected Result |
|----------|----------------|
| Default depth search for "Suzuki" | Fast (<100ms), titles only, no snippets |
| Medium depth search for "THF handling" | Includes content snippets, linked pages |
| Deep depth search for "yield optimization" | Full graph traversal, institutional knowledge |
| Scope=team search | Only team space results |
| Scope=private search | Only user's private results |
| Category=chemicals search | Only chemical pages in results |
| Empty query | 400 error |
| No results found | Empty results array, totalCount: 0 |
| Cross-tenant isolation | User A cannot see User B's private pages |
| Depth=invalid | 400 error |
| Large result set | Properly paginated, respects limit |
| searchTimeMs accuracy | Reflects actual query duration |

---

## Definition of Done

- [ ] All three depth levels return correct data shapes
- [ ] Scope filtering works correctly with teamspace membership
- [ ] Category filtering narrows results to correct KB section
- [ ] Performance targets met (100ms / 300ms / 1000ms)
- [ ] Unit tests for depthSearch, graphExpansion, contentExtractor
- [ ] API route tests with mock data
- [ ] Contract matches EPIC-51 specification
