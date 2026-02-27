# Story SKB-33.5: Agent Page Tree API

**Epic:** Epic 33 - Agent Navigation Metadata & Page Summaries
**Story ID:** SKB-33.5
**Story Points:** 3 | **Priority:** Medium | **Status:** Draft
**Depends On:** SKB-33.1 (summary fields must exist on Page model)

---

## User Story

As an AI agent, I want a lightweight API endpoint that returns all pages in the knowledge base with their one-liners and hierarchy, so that I can quickly scan the entire structure and decide which pages to explore in depth.

---

## Acceptance Criteria

### Tree Format Endpoint
- [ ] `GET /api/agent/pages?format=tree` returns pages in nested tree structure:
  ```json
  {
    "pages": [
      {
        "id": "uuid-1",
        "title": "Projects",
        "icon": "📁",
        "oneLiner": "Active and archived project documentation",
        "childCount": 3,
        "linkCount": 12,
        "updatedAt": "2026-02-27T14:25:00Z",
        "summaryStale": false,
        "children": [
          {
            "id": "uuid-2",
            "title": "Alpha",
            "icon": "🚀",
            "oneLiner": "ML pipeline for drug discovery",
            "childCount": 0,
            "linkCount": 8,
            "updatedAt": "2026-02-26T09:00:00Z",
            "summaryStale": true,
            "children": []
          }
        ]
      }
    ],
    "meta": {
      "totalPages": 42,
      "pagesWithSummaries": 38,
      "staleSummaries": 4,
      "generatedAt": "2026-02-27T15:00:00Z"
    }
  }
  ```
- [ ] Root pages (parentId = null) are top-level entries
- [ ] Children nested under their parent recursively
- [ ] Sorted by `position` within each level (matching sidebar order)

### Flat Format Endpoint
- [ ] `GET /api/agent/pages?format=flat` returns all pages as a flat list:
  ```json
  {
    "pages": [
      {
        "id": "uuid-1",
        "title": "Projects",
        "icon": "📁",
        "oneLiner": "Active and archived project documentation",
        "parentId": null,
        "depth": 0,
        "path": "/Projects",
        "childCount": 3,
        "linkCount": 12,
        "updatedAt": "2026-02-27T14:25:00Z",
        "summaryStale": false
      }
    ],
    "meta": { ... }
  }
  ```
- [ ] `depth` field indicates nesting level (0 = root, 1 = child, etc.)
- [ ] `path` field is the slash-separated breadcrumb: `/Projects/Alpha/Design Docs`
- [ ] Sorted by tree order (parent before children, respecting position)

### Default Format
- [ ] If `format` query param is omitted, defaults to `tree`

### Single Page Detail
- [ ] `GET /api/agent/pages/{id}` returns full detail for one page:
  ```json
  {
    "id": "uuid-1",
    "title": "API Authentication Guide",
    "icon": "🔑",
    "oneLiner": "JWT authentication for REST API",
    "summary": "Covers JWT setup, token refresh flow...",
    "summaryUpdatedAt": "2026-02-27T14:30:00Z",
    "path": "/Engineering/API/Authentication",
    "parentId": "uuid-parent",
    "childCount": 0,
    "outgoingLinks": [
      { "pageId": "uuid-2", "title": "JWT Reference", "oneLiner": "Standard JWT claims" }
    ],
    "incomingLinks": [
      { "pageId": "uuid-3", "title": "Getting Started", "oneLiner": "Onboarding guide" }
    ],
    "updatedAt": "2026-02-27T14:25:00Z",
    "createdAt": "2026-02-20T10:00:00Z"
  }
  ```
- [ ] Includes both outgoing and incoming links with one-liners

### Search Endpoint
- [ ] `GET /api/agent/search?q=authentication` searches pages by title and plainText
- [ ] Returns matching pages with one-liner and relevance context:
  ```json
  {
    "results": [
      {
        "id": "uuid-1",
        "title": "API Authentication Guide",
        "oneLiner": "JWT authentication for REST API",
        "path": "/Engineering/API/Authentication",
        "matchContext": "...configure JWT **authentication** middleware...",
        "updatedAt": "2026-02-27T14:25:00Z"
      }
    ],
    "totalResults": 5,
    "query": "authentication"
  }
  ```
- [ ] Uses existing PostgreSQL full-text search (Block.searchVector) for relevance
- [ ] `matchContext` extracts a snippet around the matched term (80 chars, bold matched term)

### Pagination
- [ ] Flat format supports pagination: `?page=1&pageSize=50` (default: all pages)
- [ ] Search results support pagination: `?page=1&pageSize=20` (default: 20)
- [ ] Tree format returns all pages (no pagination — trees must be complete)
- [ ] Response includes `totalPages` and `hasMore` when paginated

### Filtering
- [ ] `?spaceType=PRIVATE|TEAM|AGENT` — filter by space type
- [ ] `?staleOnly=true` — only pages where summary is stale (updatedAt > summaryUpdatedAt)
- [ ] `?noSummary=true` — only pages with null oneLiner
- [ ] Filters are combinable

### Performance
- [ ] Tree endpoint for 1000 pages completes in < 200ms
- [ ] Flat endpoint for 1000 pages completes in < 100ms
- [ ] Search endpoint for common terms completes in < 300ms
- [ ] Response size minimized — no block content included, just metadata

---

## Architecture Overview

```
Endpoint Map:
─────────────

GET /api/agent/pages
  ?format=tree|flat    (default: tree)
  ?spaceType=PRIVATE
  ?staleOnly=true
  ?noSummary=true
  ?page=1&pageSize=50  (flat only)

GET /api/agent/pages/{id}
  → Full page detail with links

GET /api/agent/search
  ?q=search+term
  ?page=1&pageSize=20


Tree Building Algorithm:
────────────────────────

function buildAgentPageTree(pages: PageWithMeta[]): TreeNode[] {
  // 1. Group pages by parentId
  const byParent = groupBy(pages, 'parentId');

  // 2. Build tree recursively from roots (parentId = null)
  function buildSubtree(parentId: string | null): TreeNode[] {
    const children = byParent[parentId] || [];
    return children
      .sort((a, b) => a.position - b.position)
      .map(page => ({
        id: page.id,
        title: page.title,
        icon: page.icon,
        oneLiner: page.oneLiner,
        childCount: (byParent[page.id] || []).length,
        linkCount: page._count.sourceLinks + page._count.targetLinks,
        updatedAt: page.updatedAt,
        summaryStale: page.updatedAt > page.summaryUpdatedAt,
        children: buildSubtree(page.id),
      }));
  }

  return buildSubtree(null);
}


Path Generation (Flat Format):
──────────────────────────────

function generatePath(page: Page, pagesById: Map<string, Page>): string {
  const segments: string[] = [page.title];
  let current = page;
  while (current.parentId) {
    current = pagesById.get(current.parentId)!;
    segments.unshift(current.title);
  }
  return '/' + segments.join('/');
}
```

---

## Implementation Steps

### Step 1: Create Agent Pages List Endpoint

**File: `src/app/api/agent/pages/route.ts`** (create)

```typescript
export async function GET(req: NextRequest) {
  // 1. Authenticate + resolve tenant
  // 2. Parse query params: format, spaceType, staleOnly, noSummary, page, pageSize
  // 3. Fetch all pages with:
  //    - select: id, title, icon, oneLiner, parentId, position, spaceType, updatedAt, summaryUpdatedAt
  //    - include: _count { sourceLinks, targetLinks }
  //    - where: tenantId + filters
  // 4. If format=tree: buildAgentPageTree(pages)
  //    If format=flat: buildFlatList(pages) with pagination
  // 5. Compute meta: totalPages, pagesWithSummaries, staleSummaries
  // 6. Return response
}
```

### Step 2: Create Agent Page Detail Endpoint

**File: `src/app/api/agent/pages/[id]/route.ts`** (create)

```typescript
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  // 1. Authenticate + resolve tenant
  // 2. Fetch page with:
  //    - Full metadata
  //    - sourceLinks with target page title + oneLiner
  //    - targetLinks with source page title + oneLiner
  // 3. Generate path (breadcrumb)
  // 4. Return response
}
```

### Step 3: Create Agent Search Endpoint

**File: `src/app/api/agent/search/route.ts`** (create)

```typescript
export async function GET(req: NextRequest) {
  // 1. Authenticate + resolve tenant
  // 2. Parse query: q (required), page, pageSize
  // 3. Search using PostgreSQL full-text search:
  //    - Match against Block.searchVector
  //    - Join to Page for metadata
  //    - Extract match context with ts_headline()
  // 4. Include oneLiner and path in results
  // 5. Return paginated results
}
```

### Step 4: Create Tree Building Utilities

**File: `src/lib/agent/pageTree.ts`** (create)

```typescript
export function buildAgentPageTree(pages: PageWithCounts[]): AgentTreeNode[];
export function buildFlatList(pages: PageWithCounts[]): AgentFlatNode[];
export function generatePagePath(pageId: string, pagesById: Map<string, Page>): string;
export function computeTreeMeta(pages: PageWithCounts[]): TreeMeta;
```

### Step 5: Create Agent API Types

**File: `src/lib/agent/types.ts`** (create)

```typescript
export interface AgentTreeNode {
  id: string;
  title: string;
  icon: string | null;
  oneLiner: string | null;
  childCount: number;
  linkCount: number;
  updatedAt: string;
  summaryStale: boolean;
  children: AgentTreeNode[];
}

export interface AgentFlatNode {
  id: string;
  title: string;
  icon: string | null;
  oneLiner: string | null;
  parentId: string | null;
  depth: number;
  path: string;
  childCount: number;
  linkCount: number;
  updatedAt: string;
  summaryStale: boolean;
}

export interface AgentSearchResult { ... }
export interface TreeMeta { ... }
```

---

## Testing Requirements

### Unit Tests (8+ cases)

**File: `src/__tests__/lib/agent/pageTree.test.ts`**

- Empty page list → empty tree
- Single root page → one node, no children
- Root with 2 children → correct nesting
- 3-level deep nesting → all levels present
- Children sorted by position
- `summaryStale` computed correctly (updatedAt > summaryUpdatedAt)
- `linkCount` sums source + target links
- Flat list includes depth and path correctly
- Path generation: `/Projects/Alpha/Design Docs`

### Integration Tests (5+ cases)

**File: `src/__tests__/integration/agent-pages.test.ts`**

- GET /api/agent/pages?format=tree → correct tree structure
- GET /api/agent/pages?format=flat → correct flat list with paths
- GET /api/agent/pages?staleOnly=true → only stale pages
- GET /api/agent/pages/{id} → full detail with links
- GET /api/agent/search?q=term → relevant results with context

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/app/api/agent/pages/route.ts` | Create | Agent page tree/list endpoint |
| `src/app/api/agent/pages/[id]/route.ts` | Create | Agent page detail endpoint |
| `src/app/api/agent/search/route.ts` | Create | Agent search endpoint |
| `src/lib/agent/pageTree.ts` | Create | Tree/flat list building utilities |
| `src/lib/agent/types.ts` | Create | Agent API TypeScript types |
| Tests | Create | Unit + integration tests |

---

**Last Updated:** 2026-02-27
