# Story SKB-20.6: End-to-End Agent Workflow Tests

**Epic:** Epic 20 - Agent Workflow Completion
**Story ID:** SKB-20.6
**Story Points:** 8 | **Priority:** High | **Status:** Draft
**Depends On:** SKB-20.1 through SKB-20.5 (all features must be implemented)

---

## User Story

As a developer maintaining SymbioKnowledgeBase, I want comprehensive end-to-end tests that validate the full agent lifecycle, So that I can confidently make changes without breaking agent workflows.

---

## Acceptance Criteria

### Test Coverage
- [ ] **Full CRUD lifecycle test:** Create page → read → update → verify update → delete → verify gone
- [ ] **Wikilink round-trip test:** Create page A → create page B with `[[A]]` → verify PageLink exists → read backlinks of A → verify B appears → update B removing link → verify PageLink removed
- [ ] **Search-to-navigate test:** Search for keyword → read top result → get page context → follow outgoing link → read linked page
- [ ] **Graph traversal test:** Get global graph → verify node count and edge count → get local graph for hub page → verify neighborhood size
- [ ] **Database CRUD test:** List databases → read schema → create row → query with filter → update row → delete row → verify
- [ ] **Page hierarchy test:** Get page tree → verify parent-child structure → create child page → verify tree updates → delete parent → verify children orphaned
- [ ] **Rate limiting test:** Send 100 requests rapidly → 101st request returns 429 → wait for window reset → next request succeeds
- [ ] **Multi-tenant isolation test:** Create two API keys for different tenants → agent A creates page → agent B cannot see it → agent B searches → no results from A
- [ ] **Concurrent write test:** Two agents update same page simultaneously → last write wins → no data corruption → both versions are valid TipTap JSON
- [ ] **MCP tool chain test:** Use MCP server to execute: search → read → create → update → delete → graph — all via stdio transport
- [ ] **Error recovery test:** Agent handles 404 (page not found), 400 (bad input), 429 (rate limit), 500 (server error) gracefully
- [ ] **Markdown fidelity test:** Create page with complex markdown (headings, lists, code blocks, tables, wikilinks, task lists, blockquotes) → read back → verify markdown matches (modulo whitespace normalization)

### Test Infrastructure
- [ ] Tests run against a real database (test tenant, isolated data)
- [ ] Test setup creates a dedicated test tenant and API key
- [ ] Test teardown cleans up all test data (pages, blocks, links, database rows)
- [ ] Tests can run in CI (no manual steps required)
- [ ] Test suite completes in under 60 seconds
- [ ] All tests are independent (no ordering dependencies between test files)
- [ ] MCP integration tests spawn the MCP server as a child process

### Quality Gates
- [ ] All tests pass on `main` branch
- [ ] No flaky tests (run 3 times, all green)
- [ ] Test coverage: >90% of agent API route handlers
- [ ] Test coverage: >90% of wikilink processing logic
- [ ] Test coverage: >80% of MCP tool handlers

---

## Architecture Overview

```
Test Architecture
──────────────────

┌─────────────────────────────────────────────────────────────────┐
│  Test Runner (Vitest)                                            │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Setup (beforeAll)                                           ││
│  │    1. Connect to test database                               ││
│  │    2. Create test tenant "test-tenant-e2e"                   ││
│  │    3. Create test user + API key                             ││
│  │    4. Store API key for test requests                        ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Test Suites                                                  ││
│  │                                                               ││
│  │  Suite 1: REST API CRUD Lifecycle                             ││
│  │    test("create page with markdown")                          ││
│  │    test("read page returns markdown")                         ││
│  │    test("update page content")                                ││
│  │    test("delete page")                                        ││
│  │                                                               ││
│  │  Suite 2: Wikilink Processing                                 ││
│  │    test("wikilinks create PageLink records")                  ││
│  │    test("removing wikilink deletes PageLink")                 ││
│  │    test("backlinks reflect wikilinks")                        ││
│  │                                                               ││
│  │  Suite 3: Search & Navigation                                 ││
│  │    test("search finds created pages")                         ││
│  │    test("page context returns complete data")                 ││
│  │    test("navigate_link follows connections")                  ││
│  │                                                               ││
│  │  Suite 4: Database Operations                                 ││
│  │    test("list databases")                                     ││
│  │    test("create and query rows")                              ││
│  │    test("filter rows by column value")                        ││
│  │                                                               ││
│  │  Suite 5: Graph Integrity                                     ││
│  │    test("graph reflects page links")                          ││
│  │    test("local graph shows neighborhood")                     ││
│  │                                                               ││
│  │  Suite 6: Security & Resilience                               ││
│  │    test("rate limiting at 100 req/min")                       ││
│  │    test("tenant isolation")                                   ││
│  │    test("read-only key cannot write")                         ││
│  │    test("concurrent writes don't corrupt")                    ││
│  │                                                               ││
│  │  Suite 7: MCP Integration                                     ││
│  │    test("MCP tools via stdio")                                ││
│  │    test("MCP resources return content")                       ││
│  │    test("MCP error handling")                                 ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Teardown (afterAll)                                          ││
│  │    1. Delete all test pages, blocks, links, rows              ││
│  │    2. Delete test tenant and user                             ││
│  │    3. Disconnect from database                                ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Create Test Utilities

**File: `src/__tests__/api/agent/helpers.ts`**

```typescript
// Test tenant and API key management
export async function createTestTenant(): Promise<{ tenantId: string; apiKey: string }>;
export async function cleanupTestTenant(tenantId: string): Promise<void>;

// HTTP request helper
export function agentRequest(
  method: string,
  path: string,
  apiKey: string,
  body?: object
): Promise<Response>;

// Assertions
export function expectSuccess(res: Response, status?: number): Promise<object>;
export function expectError(res: Response, status: number, code: string): Promise<void>;
```

### Step 2: Suite 1 — REST API CRUD Lifecycle

**File: `src/__tests__/api/agent/e2e-crud.test.ts`**

```typescript
describe("Agent CRUD Lifecycle", () => {
  let tenantCtx: TestContext;
  let createdPageId: string;

  beforeAll(async () => { tenantCtx = await createTestTenant(); });
  afterAll(async () => { await cleanupTestTenant(tenantCtx.tenantId); });

  it("creates a page from markdown", async () => {
    const res = await agentRequest("POST", "/api/agent/pages", tenantCtx.apiKey, {
      title: "E2E Test Page",
      markdown: "# Test\n\nThis is a test page with **bold** and `code`.",
    });
    const data = await expectSuccess(res, 201);
    createdPageId = data.id;
    expect(createdPageId).toBeDefined();
  });

  it("reads the page back as markdown", async () => {
    const res = await agentRequest("GET", `/api/agent/pages/${createdPageId}`, tenantCtx.apiKey);
    const data = await expectSuccess(res);
    expect(data.markdown).toContain("# Test");
    expect(data.markdown).toContain("**bold**");
    expect(data.markdown).toContain("`code`");
  });

  it("updates the page content", async () => {
    const res = await agentRequest("PUT", `/api/agent/pages/${createdPageId}`, tenantCtx.apiKey, {
      markdown: "# Updated\n\nNew content here.",
    });
    const data = await expectSuccess(res);
    expect(data.updated_at).toBeDefined();
  });

  it("verifies the update", async () => {
    const res = await agentRequest("GET", `/api/agent/pages/${createdPageId}`, tenantCtx.apiKey);
    const data = await expectSuccess(res);
    expect(data.markdown).toContain("# Updated");
    expect(data.markdown).not.toContain("# Test");
  });

  it("deletes the page", async () => {
    const res = await agentRequest("DELETE", `/api/agent/pages/${createdPageId}`, tenantCtx.apiKey);
    await expectSuccess(res);
  });

  it("verifies page is gone", async () => {
    const res = await agentRequest("GET", `/api/agent/pages/${createdPageId}`, tenantCtx.apiKey);
    await expectError(res, 404, "NOT_FOUND");
  });
});
```

### Step 3: Suite 2 — Wikilink Processing

**File: `src/__tests__/api/agent/e2e-wikilinks.test.ts`**

Test cases:
- Create page A, create page B with `[[A]]` → verify PageLink in DB
- GET backlinks of A → B appears
- Update B, remove `[[A]]`, add `[[C]]` → PageLink A removed, C added
- Create page with `[[NonExistent]]` → no error, no PageLink

### Step 4: Suite 3 — Search & Navigation

**File: `src/__tests__/api/agent/e2e-navigation.test.ts`**

Test cases:
- Create 3 pages with unique keywords → search finds them
- Get page context → verify all sections populated
- Navigate link from page to linked page → content returned
- Get page tree → verify hierarchy matches created structure

### Step 5: Suite 4 — Database Operations

**File: `src/__tests__/api/agent/e2e-database.test.ts`**

Test cases:
- List databases → includes test database
- Create row → read back → verify properties
- Filter rows by column → correct subset
- Update row → verify change
- Delete row → verify gone

### Step 6: Suite 5 — Graph Integrity

**File: `src/__tests__/api/agent/e2e-graph.test.ts`**

Test cases:
- Global graph includes test pages
- Local graph for page with links shows correct neighborhood
- After creating wikilink, graph edge appears
- After deleting page, graph node disappears

### Step 7: Suite 6 — Security & Resilience

**File: `src/__tests__/api/agent/e2e-security.test.ts`**

Test cases:
- Rate limiting: 100 requests succeed, 101st returns 429
- Tenant isolation: create page as tenant A, search as tenant B → not found
- Read-only API key: GET succeeds, POST returns 403
- Invalid API key: returns 401
- Concurrent PUT requests: both succeed, last write wins

### Step 8: Suite 7 — MCP Integration

**File: `packages/mcp-server/__tests__/e2e-workflow.test.ts`**

Test cases:
- Spawn MCP server as child process
- Send tool/list request → verify all tools listed
- Chain: search → read → create → update → delete via JSON-RPC
- Error: call tool with invalid arguments → MCP error response
- Resource: read pages://list → verify page titles

### Step 9: CI Configuration

Ensure tests run in GitHub Actions / CI pipeline:
- Start PostgreSQL service
- Run migrations
- Seed test data
- Execute test suites
- Report coverage

---

## Testing Requirements

This story IS the testing story. Success criteria:

- All 7 test suites pass
- Zero flaky tests across 3 consecutive runs
- Total execution time <60 seconds
- Coverage report generated showing >90% on agent routes
- Tests are documented: each test has a descriptive name explaining what it verifies

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/__tests__/api/agent/helpers.ts` | Create | Shared test utilities (tenant setup, HTTP helpers, assertions) |
| `src/__tests__/api/agent/e2e-crud.test.ts` | Create | Suite 1: CRUD lifecycle |
| `src/__tests__/api/agent/e2e-wikilinks.test.ts` | Create | Suite 2: Wikilink processing |
| `src/__tests__/api/agent/e2e-navigation.test.ts` | Create | Suite 3: Search & navigation |
| `src/__tests__/api/agent/e2e-database.test.ts` | Create | Suite 4: Database operations |
| `src/__tests__/api/agent/e2e-graph.test.ts` | Create | Suite 5: Graph integrity |
| `src/__tests__/api/agent/e2e-security.test.ts` | Create | Suite 6: Security & resilience |
| `packages/mcp-server/__tests__/e2e-workflow.test.ts` | Create | Suite 7: MCP integration |
| `vitest.config.ts` | Modify | Add agent E2E test pattern, increase timeout |

---

**Last Updated:** 2026-02-25
