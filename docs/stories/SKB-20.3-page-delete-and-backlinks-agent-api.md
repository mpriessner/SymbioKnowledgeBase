# Story SKB-20.3: Page Deletion & Backlinks Agent API

**Epic:** Epic 20 - Agent Workflow Completion
**Story ID:** SKB-20.3
**Story Points:** 5 | **Priority:** High | **Status:** Draft
**Depends On:** SKB-20.2 (PageLink records must be accurate for backlinks)

---

## User Story

As an AI agent managing a knowledge base, I want to delete pages and query backlinks, So that I can clean up outdated content and understand which pages reference a given page before making changes.

---

## Acceptance Criteria

### DELETE Endpoint
- [ ] `DELETE /api/agent/pages/:id` deletes a page
- [ ] Returns `{ data: { id, deleted_at } }` with 200 status
- [ ] Deleting a non-existent page returns 404
- [ ] Deleting a page removes its associated blocks (cascade)
- [ ] Deleting a page removes PageLink records where it is source OR target
- [ ] Deleting a page does NOT delete child pages (they become root-level orphans)
- [ ] Agent must have `write` scope to delete
- [ ] Rate limiting applies (existing `withAgentAuth` middleware)
- [ ] Idempotent: deleting an already-deleted page returns 404 (not error)

### Backlinks Endpoint
- [ ] `GET /api/agent/pages/:id/backlinks` returns all pages that link TO the given page
- [ ] Response: `{ data: [{ id, title, icon, link_count, snippet? }], meta: { total } }`
- [ ] Each backlink entry includes a snippet showing the context around the wikilink
- [ ] Returns empty array if no backlinks exist
- [ ] Requesting backlinks for non-existent page returns 404
- [ ] Results sorted by title (alphabetical)
- [ ] Agent must have `read` scope

### MCP Tools
- [ ] New MCP tool: `delete_page(id: string)` → `{ success, deleted_at }`
- [ ] New MCP tool: `get_backlinks(id_or_title: string)` → `BacklinkResult[]`
- [ ] `get_backlinks` accepts page ID or title (resolves title to ID)

---

## Architecture Overview

```
Delete and Backlinks Flow
──────────────────────────

DELETE /api/agent/pages/:id
  │
  ├── 1. Validate page exists and belongs to tenant
  ├── 2. Delete PageLink records (source = id OR target = id)
  ├── 3. Delete Block records (pageId = id)
  ├── 4. Nullify parentId on child pages (UPDATE pages SET parent_id = NULL WHERE parent_id = id)
  ├── 5. Delete Page record
  └── 6. Return { data: { id, deleted_at } }

GET /api/agent/pages/:id/backlinks
  │
  ├── 1. Validate page exists
  ├── 2. Query: SELECT source_page_id FROM page_links WHERE target_page_id = :id
  ├── 3. Join with pages table for title, icon
  ├── 4. For each source page, extract snippet containing the [[wikilink]]
  └── 5. Return sorted results
```

---

## Implementation Steps

### Step 1: Add DELETE Handler to Agent Pages Route

**File: `src/app/api/agent/pages/[id]/route.ts`**

Add a `DELETE` export function alongside existing `GET` and `PUT`:

```typescript
export const DELETE = withAgentAuth(async (req, ctx, routeContext) => {
  const { id } = await routeContext.params;

  // Validate UUID
  if (!z.string().uuid().safeParse(id).success) {
    return errorResponse("VALIDATION_ERROR", "Invalid page ID", undefined, 400);
  }

  // Check page exists and belongs to tenant
  const page = await prisma.page.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });

  if (!page) {
    return errorResponse("NOT_FOUND", "Page not found", undefined, 404);
  }

  // Transaction: delete links, blocks, orphan children, then page
  await prisma.$transaction([
    prisma.pageLink.deleteMany({ where: { OR: [{ sourcePageId: id }, { targetPageId: id }], tenantId: ctx.tenantId } }),
    prisma.block.deleteMany({ where: { pageId: id, tenantId: ctx.tenantId } }),
    prisma.page.updateMany({ where: { parentId: id, tenantId: ctx.tenantId }, data: { parentId: null } }),
    prisma.page.delete({ where: { id } }),
  ]);

  return successResponse({ id, deleted_at: new Date().toISOString() });
});
```

### Step 2: Create Backlinks Route

**File: `src/app/api/agent/pages/[id]/backlinks/route.ts`**

```typescript
export const GET = withAgentAuth(async (req, ctx, routeContext) => {
  const { id } = await routeContext.params;

  // Validate page exists
  const page = await prisma.page.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });
  if (!page) {
    return errorResponse("NOT_FOUND", "Page not found", undefined, 404);
  }

  // Get all pages that link TO this page
  const links = await prisma.pageLink.findMany({
    where: { targetPageId: id, tenantId: ctx.tenantId },
    include: { sourcePage: { select: { id: true, title: true, icon: true } } },
  });

  const backlinks = links.map(link => ({
    id: link.sourcePage.id,
    title: link.sourcePage.title,
    icon: link.sourcePage.icon,
  }));

  // Sort alphabetically
  backlinks.sort((a, b) => a.title.localeCompare(b.title));

  return successResponse(backlinks, { total: backlinks.length });
});
```

### Step 3: Add MCP Tools

**File: `packages/mcp-server/src/tools/delete-page.ts`**

Implement `delete_page` tool that calls `DELETE /api/agent/pages/:id`.

**File: `packages/mcp-server/src/tools/backlinks.ts`**

Implement `get_backlinks` tool that:
1. If input looks like UUID, call `GET /api/agent/pages/:id/backlinks`
2. If input is a title, first resolve to ID via `list_pages(search: title)`, then call backlinks

### Step 4: Register New Tools

**File: `packages/mcp-server/src/tools/index.ts`**

Add `delete_page` and `get_backlinks` to the tool registry.

### Step 5: Update OpenAPI Spec

**File: `docs/api/agent-openapi.yaml`**

Add schemas for:
- `DELETE /api/agent/pages/{id}` — 200, 404 responses
- `GET /api/agent/pages/{id}/backlinks` — 200 response with backlink array

---

## Testing Requirements

### Unit Tests (10+ cases)
- Delete cascade: verify SQL transaction order is correct
- Backlink query: verify correct JOIN and WHERE clauses
- Orphan children: verify parentId set to null (not deleted)
- UUID validation on DELETE and backlinks endpoints

### Integration Tests (12+ cases)
- DELETE page → GET returns 404
- DELETE page → PageLinks involving that page are gone
- DELETE page with children → children still exist with null parentId
- DELETE non-existent page → 404
- DELETE page from wrong tenant → 404 (isolation)
- GET backlinks for page with 3 incoming links → returns 3 results
- GET backlinks for page with no incoming links → returns empty array
- GET backlinks for non-existent page → 404
- GET backlinks after DELETE source page → backlink disappears
- DELETE page → graph no longer shows that node
- Rate limiting applies to DELETE endpoint
- Read-only API key cannot DELETE

### E2E Tests (3+ cases)
- Agent creates page A linking to page B → GET backlinks for B shows A → DELETE A → backlinks for B is empty
- Agent deletes parent page → child pages still accessible
- MCP delete_page tool works end-to-end

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/app/api/agent/pages/[id]/route.ts` | Modify | Add DELETE handler |
| `src/app/api/agent/pages/[id]/backlinks/route.ts` | Create | GET backlinks endpoint |
| `packages/mcp-server/src/tools/delete-page.ts` | Create | MCP delete_page tool |
| `packages/mcp-server/src/tools/backlinks.ts` | Create | MCP get_backlinks tool |
| `packages/mcp-server/src/tools/index.ts` | Modify | Register new tools |
| `packages/mcp-server/src/api/client.ts` | Modify | Add deletePage() and getBacklinks() methods |
| `docs/api/agent-openapi.yaml` | Modify | Add DELETE and backlinks schemas |
| `src/__tests__/api/agent/pages/delete.test.ts` | Create | Delete endpoint tests |
| `src/__tests__/api/agent/pages/backlinks.test.ts` | Create | Backlinks endpoint tests |

---

**Last Updated:** 2026-02-25
