# Story SKB-20.5: Agent Navigation & Link Traversal

**Epic:** Epic 20 - Agent Workflow Completion
**Story ID:** SKB-20.5
**Story Points:** 6 | **Priority:** Medium | **Status:** Draft
**Depends On:** SKB-20.3 (Backlinks endpoint must exist)

---

## User Story

As an AI agent exploring a knowledge base, I want navigation tools that let me traverse the page hierarchy, follow links between pages, and get rich context about a page's neighborhood, So that I can efficiently gather related information without making many individual API calls.

---

## Acceptance Criteria

### Page Tree Endpoint
- [ ] `GET /api/agent/pages/tree` — returns the full page hierarchy as a nested tree
  - Response: `{ data: TreeNode[] }` where `TreeNode = { id, title, icon, children: TreeNode[] }`
  - Root-level pages (no parent) are top-level nodes
  - Children nested under their parents
  - Sorted by `position` within each level
  - Returns empty array if no pages exist

### Outgoing Links Endpoint
- [ ] `GET /api/agent/pages/:id/links` — returns pages that this page links TO
  - Response: `{ data: [{ id, title, icon, link_count }], meta: { total } }`
  - Returns empty array if no outgoing links
  - 404 if page doesn't exist

### Page Context Endpoint (Composite)
- [ ] `GET /api/agent/pages/:id/context` — returns comprehensive context about a page in one call
  - Response:
    ```json
    {
      "data": {
        "page": { "id", "title", "icon", "parent_id", "created_at", "updated_at" },
        "markdown": "# Full page content...",
        "parent": { "id", "title", "icon" } | null,
        "children": [{ "id", "title", "icon" }],
        "outgoing_links": [{ "id", "title", "icon" }],
        "backlinks": [{ "id", "title", "icon" }],
        "graph_neighborhood": { "nodes": [...], "edges": [...] }
      }
    }
    ```
  - Combines page content, parent, children, outgoing links, backlinks, and local graph in one response
  - This is the primary tool for agent orientation — "tell me everything about this page"

### MCP Tools
- [ ] `get_page_tree()` → returns nested page hierarchy
- [ ] `navigate_link(from_page_id, link_target)` → resolves a link target (by title or ID) from a source page and returns the target page's full markdown content
  - If link_target is a title, resolve via outgoing links of from_page_id first, then global search
  - Returns target page markdown + its outgoing links (for continued traversal)
- [ ] `get_page_context(id_or_title)` → returns the comprehensive context object (composite endpoint)

---

## Architecture Overview

```
Agent Navigation Flow — "Follow the Links"
────────────────────────────────────────────

Agent Goal: "Summarize everything about the system architecture"

Step 1: Search
  search_pages("system architecture")
  → [{ id: "d0...02", title: "System Architecture", score: 0.95 }]

Step 2: Get Context (ONE call gets everything)
  get_page_context("d0...02")
  → {
      page: { title: "System Architecture" },
      markdown: "# System Architecture\n...",
      parent: null,
      children: [
        { title: "Developer Setup Guide" },
        { title: "LLM Integration Guide" },
        { title: "Data Models & Schema" }
      ],
      outgoing_links: [
        { title: "API Reference" },
        { title: "Design System" },
        ...
      ],
      backlinks: [
        { title: "Welcome to SymbioKnowledgeBase" },
        { title: "AI Research Notes" },
        ...
      ],
      graph_neighborhood: { nodes: [...11 nodes...], edges: [...] }
    }

Step 3: Follow Links (Agent decides which to explore)
  navigate_link("d0...02", "Data Models & Schema")
  → {
      page: { title: "Data Models & Schema", markdown: "..." },
      outgoing_links: [{ title: "API Reference" }, ...]
    }

Step 4: Continue traversing...
  navigate_link("d0...09", "API Reference")
  → { page: { ... }, outgoing_links: [...] }

Agent now has deep context from 3+ pages, gathered in 4 API calls.
```

---

## Implementation Steps

### Step 1: Create Page Tree Route

**File: `src/app/api/agent/pages/tree/route.ts`**

```typescript
export const GET = withAgentAuth(async (req, ctx) => {
  // Fetch all pages for tenant
  const pages = await prisma.page.findMany({
    where: { tenantId: ctx.tenantId },
    orderBy: { position: "asc" },
    select: { id: true, title: true, icon: true, parentId: true, position: true },
  });

  // Build tree structure
  const tree = buildTree(pages);
  return successResponse(tree);
});

function buildTree(pages) {
  const map = new Map();
  const roots = [];

  // First pass: create nodes
  for (const p of pages) {
    map.set(p.id, { id: p.id, title: p.title, icon: p.icon, children: [] });
  }

  // Second pass: attach children
  for (const p of pages) {
    const node = map.get(p.id);
    if (p.parentId && map.has(p.parentId)) {
      map.get(p.parentId).children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
```

### Step 2: Create Outgoing Links Route

**File: `src/app/api/agent/pages/[id]/links/route.ts`**

Query PageLink records where `sourcePageId = id`, join with target pages for metadata.

### Step 3: Create Page Context Route

**File: `src/app/api/agent/pages/[id]/context/route.ts`**

Composite endpoint that executes multiple queries in parallel:
1. Fetch page + block content
2. Fetch parent page
3. Fetch child pages
4. Fetch outgoing links (PageLink source = id)
5. Fetch backlinks (PageLink target = id)
6. Fetch local graph (reuse graph API logic with depth=1)

Convert block content to markdown and assemble response.

### Step 4: Add MCP Tools

**File: `packages/mcp-server/src/tools/navigation.ts`**

Implement:
- `get_page_tree()` — calls `GET /api/agent/pages/tree`
- `navigate_link(from_page_id, link_target)` — resolves link, calls read_page on target, includes outgoing links
- `get_page_context(id_or_title)` — calls `GET /api/agent/pages/:id/context`

### Step 5: Register Tools

**File: `packages/mcp-server/src/tools/index.ts`**

Add `get_page_tree`, `navigate_link`, `get_page_context` to registry.

---

## Testing Requirements

### Unit Tests (10+ cases)
- Tree building: flat list → nested tree
- Tree building: orphan pages (null parentId) appear at root
- Tree building: correct ordering by position
- Empty page list → empty tree
- Link resolution: title matching (case-insensitive)

### Integration Tests (15+ cases)
- GET /pages/tree → returns correct nested structure
- GET /pages/tree → children appear under parents
- GET /pages/:id/links → returns outgoing links
- GET /pages/:id/links → returns empty for page with no links
- GET /pages/:id/links → 404 for non-existent page
- GET /pages/:id/context → returns all sections (parent, children, links, backlinks, graph)
- GET /pages/:id/context → markdown content matches read_page response
- GET /pages/:id/context → parent is null for root-level page
- GET /pages/:id/context → children is empty for leaf page
- GET /pages/:id/context → graph_neighborhood matches graph API with depth=1
- Tenant isolation on all endpoints
- navigate_link MCP tool: resolves title to page, returns content
- navigate_link MCP tool: handles non-existent target gracefully
- get_page_context MCP tool: returns composite object

### E2E Tests (3+ cases)
- Agent gets tree → selects node → get_page_context → follow outgoing link → full traversal chain
- Agent uses get_page_context on hub page (System Architecture) → sees all connected pages
- MCP navigate_link: agent follows 3 links sequentially, each returns valid content

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/app/api/agent/pages/tree/route.ts` | Create | GET page hierarchy tree |
| `src/app/api/agent/pages/[id]/links/route.ts` | Create | GET outgoing links |
| `src/app/api/agent/pages/[id]/context/route.ts` | Create | GET composite page context |
| `packages/mcp-server/src/tools/navigation.ts` | Create | MCP navigation tools |
| `packages/mcp-server/src/tools/index.ts` | Modify | Register navigation tools |
| `packages/mcp-server/src/api/client.ts` | Modify | Add tree, links, context client methods |
| `docs/api/agent-openapi.yaml` | Modify | Add tree, links, context schemas |
| `src/__tests__/api/agent/pages/tree.test.ts` | Create | Tree endpoint tests |
| `src/__tests__/api/agent/pages/context.test.ts` | Create | Context endpoint tests |

---

**Last Updated:** 2026-02-25
