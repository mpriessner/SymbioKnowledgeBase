# Story SKB-20.4: Database Table Agent API

**Epic:** Epic 20 - Agent Workflow Completion
**Story ID:** SKB-20.4
**Story Points:** 10 | **Priority:** High | **Status:** Draft
**Depends On:** EPIC-08 (Database Table View must exist), EPIC-15 (Agent auth middleware)

---

## User Story

As an AI agent, I want to list, read, query, create, update, and delete database rows via the Agent API, So that I can manage structured data (bug trackers, experiment logs, inventories) programmatically without using the browser UI.

---

## Acceptance Criteria

### Database Listing & Schema
- [ ] `GET /api/agent/databases` — list all databases for the tenant
  - Response: `{ data: [{ id, title, page_id, column_count, row_count, created_at }], meta: { total } }`
- [ ] `GET /api/agent/databases/:id` — get database schema and metadata
  - Response: `{ data: { id, title, page_id, schema: { columns: [...] }, row_count, created_at, updated_at } }`
  - Schema includes column definitions: `{ id, name, type, options? }`
  - Column types supported: `text`, `number`, `select`, `multi_select`, `date`, `checkbox`, `url`, `email`
- [ ] Non-existent database returns 404

### Row CRUD
- [ ] `GET /api/agent/databases/:id/rows` — list rows with optional filtering and sorting
  - Query params: `limit` (default 50), `offset` (default 0), `sort` (column_id), `order` (asc/desc), `filter` (JSON-encoded filter object)
  - Filter format: `{ column_id: { op: "eq"|"contains"|"gt"|"lt"|"is_empty", value: any } }`
  - Response: `{ data: Row[], meta: { total, limit, offset } }`
  - Each Row: `{ id, properties: { [column_id]: value }, created_at, updated_at }`
- [ ] `POST /api/agent/databases/:id/rows` — create a row
  - Body: `{ properties: { [column_id]: value } }`
  - Validates property values against schema column types
  - Returns: `{ data: { id, properties, created_at } }` with 201 status
- [ ] `PUT /api/agent/databases/:id/rows/:rowId` — update a row
  - Body: `{ properties: { [column_id]: value } }` (partial update — merges with existing)
  - Returns: `{ data: { id, properties, updated_at } }`
- [ ] `DELETE /api/agent/databases/:id/rows/:rowId` — delete a row
  - Returns: `{ data: { id, deleted_at } }`

### Validation & Safety
- [ ] Property values validated against column types:
  - `text`: must be string
  - `number`: must be number
  - `select`: value must be in column's `options` array
  - `multi_select`: each value must be in column's `options` array
  - `date`: must be ISO 8601 string
  - `checkbox`: must be boolean
  - `url`: must be valid URL string
  - `email`: must be valid email string
- [ ] Unknown column IDs in properties are rejected with 400
- [ ] Tenant isolation: agent can only access databases in their tenant
- [ ] Rate limiting applies to all database endpoints

### MCP Tools
- [ ] `list_databases()` → list all databases
- [ ] `read_database(id)` → get schema and metadata
- [ ] `query_rows(database_id, filter?, sort?, limit?)` → query rows
- [ ] `create_row(database_id, properties)` → create a row
- [ ] `update_row(database_id, row_id, properties)` → update a row
- [ ] `delete_row(database_id, row_id)` → delete a row

---

## Architecture Overview

```
Database Agent API
───────────────────

┌─────────────────────────────────────────────────────────────────┐
│  Agent Request                                                    │
│  GET /api/agent/databases/:id/rows?filter={"col-status":         │
│    {"op":"eq","value":"Open"}}&sort=col-priority&order=desc      │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  Auth + Rate Limit (withAgentAuth)                               │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  Validate Database Ownership                                     │
│    SELECT * FROM databases WHERE id = :id AND tenant_id = :tid  │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  Parse Filter & Sort                                             │
│    filter = { "col-status": { op: "eq", value: "Open" } }       │
│    → WHERE properties->>'col-status' = 'Open'                   │
│                                                                  │
│    sort = "col-priority", order = "desc"                         │
│    → ORDER BY properties->>'col-priority' DESC                   │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  Query PostgreSQL                                                │
│    SELECT * FROM db_rows                                         │
│    WHERE database_id = :id AND tenant_id = :tid                 │
│      AND properties->>'col-status' = 'Open'                     │
│    ORDER BY properties->>'col-priority' DESC                     │
│    LIMIT 50 OFFSET 0                                            │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  Return Response                                                 │
│  { data: [...rows], meta: { total: 3, limit: 50, offset: 0 } } │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Create Database Listing Route

**File: `src/app/api/agent/databases/route.ts`**

GET handler that lists all databases for the tenant, joining with pages table for titles, and counting rows.

### Step 2: Create Database Detail Route

**File: `src/app/api/agent/databases/[id]/route.ts`**

GET handler that returns database schema, metadata, and row count.

### Step 3: Create Row CRUD Routes

**File: `src/app/api/agent/databases/[id]/rows/route.ts`**

- GET: List rows with filtering and sorting (parse filter JSON from query param)
- POST: Create row with validation against schema

**File: `src/app/api/agent/databases/[id]/rows/[rowId]/route.ts`**

- PUT: Update row (partial merge)
- DELETE: Delete row

### Step 4: Build Filter Engine

Create a utility that translates filter JSON into Prisma-compatible queries:

```typescript
// Filter operators
type FilterOp = "eq" | "neq" | "contains" | "gt" | "lt" | "gte" | "lte" | "is_empty" | "is_not_empty";

interface ColumnFilter {
  op: FilterOp;
  value?: unknown;
}

// Convert to Prisma JSON path query
function buildRowFilter(filters: Record<string, ColumnFilter>): object {
  // Uses Prisma's JSON path filtering: properties.path.contains, etc.
}
```

### Step 5: Build Schema Validator

Create a utility that validates row properties against the database schema:

```typescript
function validateRowProperties(
  properties: Record<string, unknown>,
  schema: { columns: Column[] }
): { valid: boolean; errors: string[] } {
  // Check each property key exists in schema columns
  // Validate value type matches column type
  // Check select values are in options
}
```

### Step 6: Add MCP Tools

**File: `packages/mcp-server/src/tools/databases.ts`**

Implement 6 tools: `list_databases`, `read_database`, `query_rows`, `create_row`, `update_row`, `delete_row`.

### Step 7: Register Tools

**File: `packages/mcp-server/src/tools/index.ts`**

Add all 6 database tools to the registry.

### Step 8: Update OpenAPI Spec

**File: `docs/api/agent-openapi.yaml`**

Add schemas for all 6 database endpoints.

---

## Testing Requirements

### Unit Tests (20+ cases)
- Filter parsing: each operator (`eq`, `contains`, `gt`, `lt`, `is_empty`)
- Schema validation: each column type (text, number, select, date, checkbox, url, email)
- Schema validation: reject unknown column IDs
- Schema validation: reject invalid select option
- Partial merge for PUT updates
- Zod schema validation for request bodies

### Integration Tests (20+ cases)
- GET /databases → returns list with correct counts
- GET /databases/:id → returns schema with columns
- GET /databases/nonexistent → 404
- GET /databases/:id/rows → returns all rows
- GET /databases/:id/rows with filter → returns filtered subset
- GET /databases/:id/rows with sort → returns sorted results
- GET /databases/:id/rows with pagination → correct total and offset
- POST /databases/:id/rows → creates row, returns 201
- POST with invalid properties → returns 400 with validation errors
- POST with unknown column → returns 400
- PUT /databases/:id/rows/:rowId → updates properties
- PUT partial update → only updates specified fields
- DELETE /databases/:id/rows/:rowId → deletes, returns 200
- DELETE non-existent row → 404
- Tenant isolation: agent A cannot see agent B's databases
- Rate limiting on database endpoints
- Read-only API key can GET but not POST/PUT/DELETE

### E2E Tests (5+ cases)
- Agent creates row in Bug Tracker → row visible in browser UI
- Agent queries "Open" bugs → gets correct filtered subset
- Agent updates bug status from "Open" to "Resolved" → change visible in UI
- MCP query_rows tool with filter returns correct results
- Full CRUD cycle: create → read → update → delete → verify gone

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/app/api/agent/databases/route.ts` | Create | GET list databases |
| `src/app/api/agent/databases/[id]/route.ts` | Create | GET database schema |
| `src/app/api/agent/databases/[id]/rows/route.ts` | Create | GET/POST rows |
| `src/app/api/agent/databases/[id]/rows/[rowId]/route.ts` | Create | PUT/DELETE row |
| `src/lib/agent/database-filter.ts` | Create | Filter/sort query builder |
| `src/lib/agent/database-validation.ts` | Create | Schema-based row validation |
| `packages/mcp-server/src/tools/databases.ts` | Create | 6 MCP database tools |
| `packages/mcp-server/src/tools/index.ts` | Modify | Register database tools |
| `packages/mcp-server/src/api/client.ts` | Modify | Add database API client methods |
| `docs/api/agent-openapi.yaml` | Modify | Add database endpoint schemas |
| `src/__tests__/api/agent/databases/route.test.ts` | Create | Database listing tests |
| `src/__tests__/api/agent/databases/rows.test.ts` | Create | Row CRUD tests |

---

**Last Updated:** 2026-02-25
