# Epic 20: Agent Workflow Completion

**Epic ID:** EPIC-20
**Created:** 2026-02-25
**Total Story Points:** 42
**Priority:** Critical
**Status:** Draft

---

## Epic Overview

Epic 20 closes the remaining gaps between the existing Agent REST API (EPIC-15) and a fully autonomous agent workflow. While EPIC-15 delivered the core REST endpoints and MCP server code, several critical pieces are missing before an agent can reliably navigate, search, read, write, link, and traverse the knowledge base end-to-end.

This epic covers six areas:
1. **MCP Server Build & Deployment** — compile, test, and register the existing MCP server so Claude Desktop/Claude Code can use it
2. **Wikilink Auto-Linking on Agent Writes** — ensure `[[Page Name]]` in agent-submitted markdown creates `PageLink` records and backlinks
3. **Page Deletion & Backlinks API** — add DELETE endpoint and a dedicated backlinks endpoint for agents
4. **Database Table Agent API** — expose database (table) CRUD so agents can read/write structured data
5. **Agent Navigation & Link Traversal** — add tools for following links page-to-page and getting page hierarchy
6. **End-to-End Agent Workflow Tests** — comprehensive integration and E2E tests validating the full agent lifecycle

**Dependencies:**
- EPIC-15 (Agent API) — REST endpoints and MCP server code must exist (done)
- EPIC-14 (Markdown Conversion) — `tiptapToMarkdown` and `markdownToTiptap` must work (done)
- EPIC-05 (Wikilinks & Backlinks) — wikilink parsing logic must exist (done)

---

## Business Value

- **Complete Agent Autonomy:** Agents can perform every operation a human can — search, navigate, read, write, link, delete, and manage structured data — without human intervention
- **Graph Integrity:** Wikilinks written by agents automatically create graph connections, keeping the knowledge graph accurate and navigable
- **Structured Data Access:** Agents can populate and query database tables (e.g., bug trackers, experiment logs), unlocking structured knowledge management
- **MCP Integration:** Claude Desktop and Claude Code users can interact with the knowledge base natively through MCP tools, reducing context-switching
- **Reliability:** End-to-end tests ensure agent workflows don't break during future development

---

## Architecture Summary

```
Agent Workflow — Complete Architecture
────────────────────────────────────────

┌─────────────────────────────────────────────────────────────────────┐
│  Agent (Claude Desktop, Claude Code, custom script)                   │
│                                                                        │
│  MCP Tools (stdio):                   REST API (HTTP):                │
│    search_pages(query)                  GET  /api/agent/search        │
│    read_page(id_or_title)               GET  /api/agent/pages/:id     │
│    create_page(title, markdown)         POST /api/agent/pages         │
│    update_page(id, markdown)            PUT  /api/agent/pages/:id     │
│    delete_page(id)            [NEW]     DEL  /api/agent/pages/:id     │
│    list_pages(parent_id?)               GET  /api/agent/pages         │
│    get_backlinks(id)          [NEW]     GET  /api/agent/pages/:id/bl  │
│    get_graph(page_id?, depth?)          GET  /api/agent/graph         │
│    get_page_tree()            [NEW]     GET  /api/agent/pages/tree    │
│    navigate_link(from, to)    [NEW]     (composed from read + graph)  │
│    list_databases()           [NEW]     GET  /api/agent/databases     │
│    read_database(id)          [NEW]     GET  /api/agent/databases/:id │
│    query_rows(db_id, filter?) [NEW]     GET  /api/agent/db/:id/rows   │
│    create_row(db_id, data)    [NEW]     POST /api/agent/db/:id/rows   │
│    update_row(db_id, row, d)  [NEW]     PUT  /api/agent/db/:id/r/:r   │
│    get_recent_pages(limit?)             (existing)                    │
│                                                                        │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  SymbioKnowledgeBase Server (Next.js)                                 │
│                                                                        │
│  Auth Middleware (withAgentAuth)                                       │
│    → API Key (skb_*) or Supabase JWT                                  │
│    → Rate limiting (100 req/min)                                      │
│    → Scope check (read / write)                                       │
│                                                                        │
│  Wikilink Processing [NEW]:                                           │
│    Agent writes markdown with [[Page Name]]                           │
│      → markdownToTiptap() converts to TipTap JSON                    │
│      → parseWikilinks() extracts link targets                         │
│      → Resolve page titles to IDs                                     │
│      → Upsert PageLink records (source → target)                     │
│      → Remove stale PageLink records                                  │
│                                                                        │
│  Database:                                                             │
│    PostgreSQL (tenant-scoped queries)                                  │
│    Tables: pages, blocks, page_links, databases, db_rows              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Stories Breakdown

### SKB-20.1: MCP Server Build, Test & Deployment — 5 points, Critical

**Delivers:** A working MCP server that Claude Desktop and Claude Code can connect to. Compiles the existing `packages/mcp-server/` TypeScript code, fixes any build issues, adds integration tests, and provides setup documentation.

**Depends on:** EPIC-15 (MCP server code exists)

---

### SKB-20.2: Wikilink Auto-Linking on Agent Markdown Writes — 8 points, High

**Delivers:** When an agent creates or updates a page via the Agent API using markdown containing `[[Page Name]]` wikilinks, the system automatically:
1. Parses wikilinks from the markdown/TipTap content
2. Resolves page titles to page IDs (case-insensitive, fuzzy)
3. Creates `PageLink` records for each resolved link
4. Removes stale `PageLink` records for links that were removed
5. Optionally auto-creates target pages if they don't exist (configurable)

**Depends on:** SKB-20.1 (MCP server must be working to test full flow)

---

### SKB-20.3: Page Deletion & Backlinks Agent API — 5 points, High

**Delivers:** Two new agent API capabilities:
- `DELETE /api/agent/pages/:id` — soft-delete a page (with cascade options)
- `GET /api/agent/pages/:id/backlinks` — list all pages that link TO a given page
- Corresponding MCP tools: `delete_page`, `get_backlinks`

**Depends on:** SKB-20.2 (backlinks depend on PageLink records being accurate)

---

### SKB-20.4: Database Table Agent API — 10 points, High

**Delivers:** Agent API endpoints for reading and writing database tables (Notion-style structured data):
- `GET /api/agent/databases` — list all databases
- `GET /api/agent/databases/:id` — get database schema and metadata
- `GET /api/agent/databases/:id/rows` — query rows with filtering and sorting
- `POST /api/agent/databases/:id/rows` — create a new row
- `PUT /api/agent/databases/:id/rows/:rowId` — update a row
- `DELETE /api/agent/databases/:id/rows/:rowId` — delete a row
- Corresponding MCP tools: `list_databases`, `read_database`, `query_rows`, `create_row`, `update_row`, `delete_row`

**Depends on:** EPIC-08 (Database Table View must exist)

---

### SKB-20.5: Agent Navigation & Link Traversal — 6 points, Medium

**Delivers:** Tools for structured navigation through the knowledge graph:
- `GET /api/agent/pages/tree` — full page hierarchy tree
- `GET /api/agent/pages/:id/links` — outgoing links from a page (with target page summaries)
- MCP tool: `navigate_link(from_page_id, link_target)` — follows a link and returns the target page content
- MCP tool: `get_page_tree()` — returns the full page hierarchy for orientation
- MCP tool: `get_page_context(id)` — returns a page with its backlinks, outgoing links, parent, and children in one call

**Depends on:** SKB-20.3 (backlinks endpoint must exist)

---

### SKB-20.6: End-to-End Agent Workflow Tests — 8 points, High

**Delivers:** Comprehensive test suite validating the full agent lifecycle:
- **REST API integration tests** for every endpoint (happy path + error cases)
- **MCP server integration tests** validating tool calls and responses
- **Wikilink round-trip tests** (agent writes markdown with links → links appear in graph → backlinks resolve)
- **Database CRUD tests** (agent creates database, adds rows, queries, updates, deletes)
- **Navigation flow tests** (agent searches → reads page → follows links → reads linked pages)
- **Rate limiting tests** (agent hits rate limit, receives 429, retries after cooldown)
- **Multi-tenant isolation tests** (agent in tenant A cannot see tenant B's pages)
- **Concurrent agent tests** (two agents writing to same page — last-write-wins)

**Depends on:** SKB-20.1 through SKB-20.5 (all features must be implemented)

---

## Test Coverage Requirements

| Story | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 20.1 | MCP tool schema validation; client method return types | MCP server starts, responds to tool calls via stdio; auth token forwarded | Claude Desktop config: search pages, read page, create note |
| 20.2 | Wikilink regex extraction; title-to-ID resolution; stale link detection | POST page with wikilinks → PageLink records created; PUT page removing link → PageLink deleted | Agent creates page with `[[System Architecture]]` → graph shows edge |
| 20.3 | Delete cascade logic; backlink query building | DELETE page → 404 on read; GET backlinks returns correct pages | Agent deletes page → graph updates; agent gets backlinks for hub page |
| 20.4 | Row validation against schema; filter/sort parsing | Full database CRUD cycle; schema enforcement; tenant isolation | Agent populates bug tracker from list → rows visible in UI |
| 20.5 | Tree building; link resolution; context assembly | GET tree returns correct hierarchy; navigate_link returns target page | Agent traverses: search → read → follow link → read linked page |
| 20.6 | N/A (integration-only story) | Full lifecycle: create 5 pages with links → search → traverse graph → update → delete | Complete agent session: 20+ sequential operations without errors |

---

## Implementation Order

```
20.1 → 20.2 → 20.3 → 20.4 → 20.5 → 20.6

┌────────┐     ┌────────┐     ┌────────┐     ┌────────┐     ┌────────┐     ┌────────┐
│ 20.1   │────▶│ 20.2   │────▶│ 20.3   │────▶│ 20.4   │────▶│ 20.5   │────▶│ 20.6   │
│ MCP    │     │ Wiki   │     │ Delete │     │ DB     │     │ Nav    │     │ E2E    │
│ Deploy │     │ Links  │     │ + Back │     │ Tables │     │ Tools  │     │ Tests  │
└────────┘     └────────┘     └────────┘     └────────┘     └────────┘     └────────┘

20.1: Get MCP server running (compile, test, register)
20.2: Wikilink auto-linking ensures graph stays accurate
20.3: Add delete + backlinks (completes page CRUD)
20.4: Database table access (structured data for agents)
20.5: Navigation tools (page-to-page traversal)
20.6: End-to-end tests (validates everything works together)

Note: 20.4 can be developed in parallel with 20.3 if needed.
```

---

## Shared Constraints

- **Multi-Tenant Isolation:** All queries must filter by `tenant_id` — agents must never access cross-tenant data
- **Backward Compatibility:** No changes to existing REST API response formats — new endpoints only
- **Markdown Fidelity:** Wikilinks in markdown (`[[Page Name]]`) must survive round-trip conversion (markdown → TipTap → markdown)
- **Rate Limiting:** All new endpoints must use the existing `withAgentAuth` middleware (100 req/min per key)
- **Error Responses:** Follow standard envelope `{ error: { code, message, details? }, meta: { timestamp } }`
- **MCP Protocol Compliance:** New tools must follow MCP v1.0 spec — validate with official MCP validator
- **No Breaking Changes:** Existing MCP tools and REST endpoints must continue to work identically
- **Idempotency:** PUT/DELETE requests must be idempotent — repeated calls produce same result
- **Performance:** Agent API reads <200ms, writes <500ms, graph queries <1s
- **TypeScript Strict:** No `any` types in new code

---

## Files Created/Modified by This Epic

### New Files
- `src/app/api/agent/pages/[id]/backlinks/route.ts` — GET backlinks
- `src/app/api/agent/pages/tree/route.ts` — GET page hierarchy tree
- `src/app/api/agent/pages/[id]/links/route.ts` — GET outgoing links
- `src/app/api/agent/databases/route.ts` — GET list databases
- `src/app/api/agent/databases/[id]/route.ts` — GET database schema
- `src/app/api/agent/databases/[id]/rows/route.ts` — GET/POST rows
- `src/app/api/agent/databases/[id]/rows/[rowId]/route.ts` — PUT/DELETE row
- `src/lib/agent/wikilinks.ts` — Wikilink parsing and PageLink sync for agent writes
- `packages/mcp-server/src/tools/delete-page.ts` — MCP delete_page tool
- `packages/mcp-server/src/tools/backlinks.ts` — MCP get_backlinks tool
- `packages/mcp-server/src/tools/databases.ts` — MCP database tools
- `packages/mcp-server/src/tools/navigation.ts` — MCP navigate_link, get_page_tree, get_page_context
- `src/__tests__/api/agent/pages/delete.test.ts`
- `src/__tests__/api/agent/pages/backlinks.test.ts`
- `src/__tests__/api/agent/databases/route.test.ts`
- `src/__tests__/api/agent/databases/rows.test.ts`
- `src/__tests__/lib/agent/wikilinks.test.ts`
- `src/__tests__/api/agent/e2e-workflow.test.ts`
- `packages/mcp-server/__tests__/integration.test.ts`
- `packages/mcp-server/__tests__/tools-new.test.ts`
- `docs/guides/mcp-quickstart.md` — Quick-start guide for MCP setup

### Modified Files
- `src/app/api/agent/pages/[id]/route.ts` — Add DELETE handler
- `src/app/api/agent/pages/route.ts` — Add wikilink processing to POST handler
- `packages/mcp-server/src/tools/index.ts` — Register new tools
- `packages/mcp-server/src/resources/index.ts` — Register new resources
- `packages/mcp-server/src/api/client.ts` — Add new API client methods
- `packages/mcp-server/package.json` — Update dependencies if needed
- `packages/mcp-server/tsconfig.json` — Ensure build settings are correct
- `docs/api/agent-openapi.yaml` — Add new endpoint schemas
- `.claude/settings.json` or equivalent — MCP server registration (if applicable)

---

**Last Updated:** 2026-02-25
