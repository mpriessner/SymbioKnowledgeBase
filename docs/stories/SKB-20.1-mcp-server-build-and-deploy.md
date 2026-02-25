# Story SKB-20.1: MCP Server Build, Test & Deployment

**Epic:** Epic 20 - Agent Workflow Completion
**Story ID:** SKB-20.1
**Story Points:** 5 | **Priority:** Critical | **Status:** Draft
**Depends On:** EPIC-15 (MCP server code exists in `packages/mcp-server/`)

---

## User Story

As a Claude Desktop / Claude Code user, I want the SymbioKnowledgeBase MCP server to be compiled, tested, and registered, So that I can search, read, and create knowledge base pages directly from Claude without switching to a browser.

---

## Acceptance Criteria

- [ ] `packages/mcp-server/` compiles without errors via `npm run build`
- [ ] TypeScript strict mode — no `any` types, no implicit any
- [ ] MCP server starts successfully with `node dist/index.js`
- [ ] Server connects via stdio transport (JSON-RPC over stdin/stdout)
- [ ] Server validates `SYMBIO_AUTH_TOKEN` environment variable on startup (exits with clear error if missing)
- [ ] Server validates `SYMBIO_API_URL` (defaults to `http://localhost:3000`)
- [ ] All 7 existing tools respond correctly:
  - `search_pages(query, limit?)` → returns search results
  - `read_page(id_or_title)` → returns page with markdown content
  - `create_page(title, markdown?, parent_id?)` → creates page, returns ID
  - `update_page(id, markdown)` → updates page, returns updated_at
  - `list_pages(parent_id?, limit?)` → returns paginated page list
  - `get_graph(page_id?, depth?)` → returns nodes and edges
  - `get_recent_pages(limit?)` → returns recently updated pages
- [ ] All 3 resources respond correctly:
  - `pages://list` → all page titles with IDs
  - `pages://{id}` → full markdown content for specific page
  - `graph://overview` → knowledge graph summary (node count, edge count, clusters)
- [ ] Error handling: invalid tool names return MCP-compliant error
- [ ] Error handling: API connection failure returns clear error message
- [ ] Error handling: invalid auth token returns authentication error
- [ ] Debug logging to stderr (does not pollute stdout JSON-RPC stream)
- [ ] Claude Desktop config example works: `claude_desktop_config.json`
- [ ] Quick-start documentation written: `docs/guides/mcp-quickstart.md`
- [ ] Integration test suite passes (at least 15 test cases)

---

## Architecture Overview

```
MCP Server Deployment
──────────────────────

┌──────────────────────────────────────────────────────────────────┐
│  Claude Desktop / Claude Code                                     │
│                                                                    │
│  claude_desktop_config.json:                                      │
│  {                                                                │
│    "mcpServers": {                                                │
│      "symbio": {                                                  │
│        "command": "node",                                         │
│        "args": ["/path/to/packages/mcp-server/dist/index.js"],   │
│        "env": {                                                   │
│          "SYMBIO_AUTH_TOKEN": "skb_live_...",                     │
│          "SYMBIO_API_URL": "http://localhost:3000"                │
│        }                                                          │
│      }                                                            │
│    }                                                              │
│  }                                                                │
└───────────────────────┬──────────────────────────────────────────┘
                        │ stdio (JSON-RPC 2.0)
                        ▼
┌──────────────────────────────────────────────────────────────────┐
│  MCP Server Process (Node.js)                                     │
│                                                                    │
│  1. Read SYMBIO_AUTH_TOKEN from env                               │
│  2. Create AgentClient(apiUrl, authToken)                         │
│  3. Register 7 tools + 3 resources                                │
│  4. Connect StdioServerTransport                                  │
│  5. Listen for JSON-RPC requests on stdin                         │
│  6. Forward to Agent REST API via HTTP                            │
│  7. Return results via stdout                                     │
│                                                                    │
│  Logging: stderr only (never stdout)                              │
└───────────────────────┬──────────────────────────────────────────┘
                        │ HTTP + Bearer token
                        ▼
┌──────────────────────────────────────────────────────────────────┐
│  SymbioKnowledgeBase (http://localhost:3000)                      │
│  /api/agent/* endpoints                                           │
└──────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Fix Build Issues

**File: `packages/mcp-server/tsconfig.json`**

Ensure TypeScript config is correct for Node.js ESM output:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "__tests__"]
}
```

Run:
```bash
cd packages/mcp-server
npm install
npm run build
```

Fix any TypeScript errors that arise. Common issues:
- Missing type imports from `@modelcontextprotocol/sdk`
- Implicit `any` in catch blocks (use `unknown` + type guard)
- Import path extensions (`.js` required for ESM)

### Step 2: Validate API Client

**File: `packages/mcp-server/src/api/client.ts`**

Verify the `AgentClient` correctly:
- Sets `Authorization: Bearer ${token}` header on all requests
- Handles non-200 responses with clear error messages
- Parses JSON responses correctly
- Handles network errors (connection refused, timeout)

Add timeout handling:
```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 10000);
try {
  const res = await fetch(url, { ...options, signal: controller.signal });
  // ...
} finally {
  clearTimeout(timeout);
}
```

### Step 3: Test Each Tool Manually

Start the server and test with a JSON-RPC request:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | \
  SYMBIO_AUTH_TOKEN=test SYMBIO_API_URL=http://localhost:3000 \
  node packages/mcp-server/dist/index.js
```

Verify each tool:
```bash
# search_pages
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_pages","arguments":{"query":"architecture"}}}' | ...

# read_page
echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"read_page","arguments":{"id_or_title":"d0000000-0000-4000-a000-000000000002"}}}' | ...

# list_pages
echo '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"list_pages","arguments":{}}}' | ...
```

### Step 4: Write Integration Tests

**File: `packages/mcp-server/__tests__/integration.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";

describe("MCP Server Integration", () => {
  // Test tool listing
  it("should list all 7 tools", async () => { /* ... */ });

  // Test each tool
  it("search_pages returns results for known query", async () => { /* ... */ });
  it("read_page returns markdown for valid page ID", async () => { /* ... */ });
  it("read_page returns error for non-existent page", async () => { /* ... */ });
  it("create_page creates a page and returns ID", async () => { /* ... */ });
  it("update_page updates content and returns timestamp", async () => { /* ... */ });
  it("list_pages returns paginated results", async () => { /* ... */ });
  it("list_pages filters by parent_id", async () => { /* ... */ });
  it("get_graph returns nodes and edges", async () => { /* ... */ });
  it("get_graph with page_id returns local neighborhood", async () => { /* ... */ });
  it("get_recent_pages returns ordered by updated_at", async () => { /* ... */ });

  // Test resources
  it("pages://list returns all page summaries", async () => { /* ... */ });
  it("pages://{id} returns markdown content", async () => { /* ... */ });
  it("graph://overview returns summary stats", async () => { /* ... */ });

  // Test error handling
  it("unknown tool returns MCP error", async () => { /* ... */ });
  it("invalid arguments return validation error", async () => { /* ... */ });
});
```

### Step 5: Create Quick-Start Guide

**File: `docs/guides/mcp-quickstart.md`**

Contents:
1. Prerequisites (Node.js 18+, running SymbioKnowledgeBase instance)
2. Generate an API key in Settings
3. Build the MCP server
4. Configure Claude Desktop
5. Test with a sample query
6. Troubleshooting (common errors, log locations)

### Step 6: Register in Claude Desktop Config

**File: Example `claude_desktop_config.json`**

```json
{
  "mcpServers": {
    "symbio-knowledge-base": {
      "command": "node",
      "args": ["/absolute/path/to/packages/mcp-server/dist/index.js"],
      "env": {
        "SYMBIO_AUTH_TOKEN": "skb_live_your_api_key_here",
        "SYMBIO_API_URL": "http://localhost:3000"
      }
    }
  }
}
```

---

## Testing Requirements

### Unit Tests
- API client: mock HTTP responses, verify correct URL building and header passing
- Tool input validation: test Zod schemas reject invalid arguments
- Resource URI parsing: verify `pages://list` and `pages://{id}` patterns

### Integration Tests (requires running server)
- Start MCP server as child process, send JSON-RPC via stdin, read stdout
- Test all 7 tools with real API calls
- Test all 3 resources
- Test error scenarios (bad auth, missing page, invalid arguments)
- Test connection timeout handling

### Manual Verification
- Install in Claude Desktop, run 5 queries, verify responses are correct
- Verify debug logs appear in stderr, not stdout

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `packages/mcp-server/tsconfig.json` | Modify | Fix build configuration |
| `packages/mcp-server/src/api/client.ts` | Modify | Add timeout handling, improve error messages |
| `packages/mcp-server/src/index.ts` | Modify | Improve startup validation and error messages |
| `packages/mcp-server/__tests__/integration.test.ts` | Create | 15+ integration test cases |
| `docs/guides/mcp-quickstart.md` | Create | Setup guide with troubleshooting |

---

**Last Updated:** 2026-02-25
