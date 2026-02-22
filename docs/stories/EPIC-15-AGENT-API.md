# Epic 15: Agent API & MCP Server

**Epic ID:** EPIC-15
**Created:** 2026-02-22
**Total Story Points:** 34
**Priority:** High
**Status:** Planned

---

## Epic Overview

Epic 15 delivers a programmatic API for AI agents to interact with SymbioKnowledgeBase. This includes RESTful endpoints for CRUD operations on pages using markdown format, an MCP (Model Context Protocol) server for LLM integration, authentication via Supabase JWT tokens, and comprehensive rate limiting and audit logging.

The Agent API enables AI agents from across the Symbio ecosystem (ExpTube, CAM ELN, SciSymbioLens, SymbioAgentMac) to read, search, create, and update knowledge base pages. All content is exchanged in markdown format for maximum agent compatibility.

This epic covers:
- REST API endpoints under `/api/agent/` prefix (markdown-based CRUD)
- MCP server implementation with tools and resources
- Supabase JWT authentication (shared across Symbio apps)
- API key management for third-party integrations
- Rate limiting (100 req/min per key)
- Audit logging of all agent actions
- Interactive API documentation

**Dependencies:**
- EPIC-14 (Markdown Conversion) — must have `tiptapToMarkdown` and `markdownToTiptap` utilities
- EPIC-19 (Supabase Auth Migration) — must have Supabase JWT validation

---

## Business Value

- **AI-Agent-First Design:** Enables autonomous agents to create, update, and query knowledge without human intervention — core to the vision of agent-augmented knowledge management
- **Ecosystem Integration:** Shared Supabase auth allows agents running in ExpTube (video transcription), CAM ELN (lab notebooks), SciSymbioLens (mobile), and SymbioAgentMac (voice) to seamlessly access the knowledge base
- **Markdown Format:** Universal agent compatibility — Claude, GPT, Gemini, and other LLMs work natively with markdown, eliminating the need for agents to understand TipTap JSON structures
- **MCP Protocol:** Following the Model Context Protocol standard enables Claude Desktop, VSCode extensions, and other MCP-compatible tools to consume SymbioKnowledgeBase as a knowledge source
- **Rate Limiting & Audit Logs:** Prevents abuse while maintaining full transparency of agent actions for security and debugging

---

## Architecture Summary

```
┌────────────────────────────────────────────────────────────────────┐
│                          Agent API Architecture                     │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │  MCP Server (stdio or HTTP/SSE transport)                      ││
│  │                                                                 ││
│  │  Tools:                                                         ││
│  │    search_pages(query: string) → SearchResult[]                ││
│  │    read_page(id_or_title: string) → { markdown, metadata }     ││
│  │    create_page(title, markdown, parent?) → { id, title }       ││
│  │    update_page(id, markdown) → { success, updated_at }         ││
│  │    list_pages(folder?, sort?) → Page[]                         ││
│  │    get_graph(page_id?, depth?) → { nodes, edges }              ││
│  │    get_recent_pages(limit?) → Page[]                           ││
│  │                                                                 ││
│  │  Resources:                                                     ││
│  │    pages://list → All page titles with IDs                     ││
│  │    pages://{id} → Full markdown content for page               ││
│  │    graph://overview → Knowledge graph summary                  ││
│  │                                                                 ││
│  │  Auth: Supabase JWT token via environment variable             ││
│  └────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │  REST Agent API (/api/agent/*)                                 ││
│  │                                                                 ││
│  │  Endpoints:                                                     ││
│  │    GET    /api/agent/pages                                     ││
│  │           → { data: Page[], meta: { total, limit, offset } }   ││
│  │                                                                 ││
│  │    GET    /api/agent/pages/:id                                 ││
│  │           → { data: { markdown, title, icon, ... } }           ││
│  │                                                                 ││
│  │    POST   /api/agent/pages                                     ││
│  │           Body: { title, markdown, parent_id? }                ││
│  │           → { data: { id, title, created_at } }                ││
│  │                                                                 ││
│  │    PUT    /api/agent/pages/:id                                 ││
│  │           Body: { markdown }                                   ││
│  │           → { data: { id, updated_at } }                       ││
│  │                                                                 ││
│  │    GET    /api/agent/search?q=query&limit=20                   ││
│  │           → { data: SearchResult[], meta }                     ││
│  │                                                                 ││
│  │    GET    /api/agent/graph?pageId=X&depth=2                    ││
│  │           → { data: { nodes, edges } }                         ││
│  │                                                                 ││
│  │  Auth: Bearer token (Supabase JWT or API key)                  ││
│  │        Authorization: Bearer <token>                           ││
│  │                                                                 ││
│  │  Rate Limiting: 100 requests/minute per API key                ││
│  │  Audit Logging: All mutations logged to audit_logs table       ││
│  └────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │  Authentication Flow                                            ││
│  │                                                                 ││
│  │  Supabase JWT (from other Symbio apps):                        ││
│  │    1. Agent passes Supabase JWT in Authorization header        ││
│  │    2. Middleware validates JWT with Supabase public key        ││
│  │    3. Extract user_id, tenant_id from JWT claims               ││
│  │    4. Proceed with request (scoped to tenant_id)               ││
│  │                                                                 ││
│  │  API Key (for third-party integrations):                       ││
│  │    1. Agent passes API key in Authorization header             ││
│  │    2. Middleware looks up key in api_keys table                ││
│  │    3. Verify key is not revoked, update last_used_at           ││
│  │    4. Extract tenant_id and user_id from api_keys record       ││
│  │    5. Check rate limit (100 req/min per key)                   ││
│  │    6. Proceed with request                                     ││
│  │                                                                 ││
│  │  Rate Limiting:                                                 ││
│  │    - Redis-backed sliding window (100 req/min)                 ││
│  │    - Key: api_key_id or user_id                                ││
│  │    - Response: 429 Too Many Requests with Retry-After header   ││
│  └────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │  Markdown Conversion                                            ││
│  │                                                                 ││
│  │  TipTap ↔ Markdown:                                            ││
│  │    - tiptapToMarkdown(doc: TipTapDocument) → string            ││
│  │    - markdownToTiptap(md: string) → TipTapDocument             ││
│  │                                                                 ││
│  │  Supported Markdown:                                            ││
│  │    - Headings: # ## ###                                        ││
│  │    - Lists: - * 1. [ ] [x]                                     ││
│  │    - Formatting: **bold** _italic_ `code`                      ││
│  │    - Links: [[wikilinks]] [external](url)                      ││
│  │    - Code blocks: ```language                                  ││
│  │    - Blockquotes: >                                            ││
│  │    - Tables: | col | col |                                     ││
│  │    - Images: ![alt](url)                                       ││
│  │                                                                 ││
│  │  Round-trip fidelity:                                           ││
│  │    - Preserve wikilinks as [[Page Title]]                      ││
│  │    - Preserve task lists as - [ ] and - [x]                    ││
│  │    - Preserve table alignment                                  ││
│  └────────────────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────────────┘
```

---

## Symbio Ecosystem Context

SymbioKnowledgeBase is the central knowledge hub for the Symbio ecosystem:

| App | Purpose | Auth | Agent Integration |
|-----|---------|------|-------------------|
| **ExpTube** | Video transcription platform | Supabase Auth | Agent uploads videos, transcribes, saves summaries to knowledge base |
| **CAM ELN** | Electronic Lab Notebook | Supabase Auth | Agent extracts protocols, links to knowledge base |
| **SciSymbioLens** | iOS mobile app | Supabase Auth | Agent queries knowledge base, creates notes from camera |
| **SymbioAgentMac** | Mac voice agent | Needs Supabase Auth (EPIC-19) | Voice-driven knowledge creation/search |
| **SymbioKnowledgeBase** | Knowledge management | Supabase Auth (EPIC-19) | Central repository, serves all agents |

**Authentication Flow:**
1. User logs into any Symbio app via Supabase Auth
2. App obtains Supabase JWT token
3. Agent running in that app uses JWT to access SymbioKnowledgeBase Agent API
4. All actions scoped to user's tenant_id (from JWT)

**Use Cases:**
- ExpTube agent transcribes video → creates page "Meeting Notes 2026-02-22" with transcript
- CAM ELN agent extracts protocol from lab notebook → creates page "PCR Protocol v2"
- SymbioAgentMac voice agent: "Summarize all pages about machine learning" → queries `/api/agent/search?q=machine+learning`
- Claude Desktop with MCP: User asks "What protocols do I have?" → MCP server calls `list_pages()` tool

---

## Stories Breakdown

### SKB-15.1: REST Agent API Endpoints — 8 points, High

**Delivers:** Six new API routes under the `/api/agent/` prefix, all returning markdown-based responses:
- `GET /api/agent/pages` — list all pages (returns: `id`, `title`, `icon`, `parent_id`, `created_at`, `updated_at`)
- `GET /api/agent/pages/:id` — read page as markdown (uses `tiptapToMarkdown` to convert DOCUMENT block)
- `POST /api/agent/pages` — create page from markdown (uses `markdownToTiptap` to convert to TipTap JSON)
- `PUT /api/agent/pages/:id` — update page from markdown
- `GET /api/agent/search?q=query` — search pages, return markdown snippets
- `GET /api/agent/graph?pageId=X&depth=N` — get page connections (nodes + edges)

All endpoints accept `Authorization: Bearer <token>` header (Supabase JWT or API key). Response format: `{ data, meta }` envelope. Rate limiting enforced. Errors return standard `{ error, meta }` format.

**Depends on:** EPIC-14 (markdown conversion utilities must exist)

---

### SKB-15.2: MCP Server Implementation — 13 points, High

**Delivers:** A Model Context Protocol server exposing SymbioKnowledgeBase to LLMs. Implements MCP spec v1.0 with:
- **Tools:** `search_pages`, `read_page`, `create_page`, `update_page`, `list_pages`, `get_graph`, `get_recent_pages`
- **Resources:** `pages://list`, `pages://{id}`, `graph://overview`
- **Transport:** stdio for local use (Claude Desktop), HTTP/SSE for remote use
- **Auth:** Reads Supabase JWT from environment variable `SYMBIO_AUTH_TOKEN`
- **Package:** `@modelcontextprotocol/sdk` for protocol implementation
- **Markdown-first:** All content in/out as markdown (uses `tiptapToMarkdown` and `markdownToTiptap`)

Server runs as standalone Node.js process (`npx mcp-server-symbio`) or via HTTP on port 3001. Configuration guide for Claude Desktop (`claude_desktop_config.json`).

**Depends on:** SKB-15.1 (REST API must exist for MCP server to call)

---

### SKB-15.3: Agent Authentication & Rate Limiting — 5 points, High

**Delivers:**
- **API Key Management UI:** Settings page to generate/revoke API keys. Each key has: name, key_prefix (for display), key_hash (bcrypt), scopes (read-only or read-write), created_at, last_used_at, revoked_at
- **Supabase JWT Validation:** Middleware to validate Supabase JWTs, extract `user_id` and `tenant_id` from claims
- **Rate Limiting:** Redis-backed sliding window rate limiter (100 req/min per API key or user_id). Returns 429 with `Retry-After` header
- **Audit Logging:** New `audit_logs` table tracking: agent actions (CREATE_PAGE, UPDATE_PAGE, DELETE_PAGE), timestamp, user_id, api_key_id, request_body (sanitized)
- **Scoped Permissions:** Read-only API keys can only call GET endpoints, read-write keys can POST/PUT/DELETE

All agent endpoints require either valid Supabase JWT or API key. Rate limit counter stored in Redis with 1-minute TTL.

**Depends on:** EPIC-19 (Supabase Auth migration must be complete)

---

### SKB-15.4: Agent API Documentation — 8 points, Medium

**Delivers:**
- **OpenAPI Spec:** `docs/api/agent-openapi.yaml` documenting all `/api/agent/*` endpoints with request/response schemas, authentication, rate limits, error codes
- **Interactive Docs:** Swagger UI page at `/api/agent/docs` serving the spec (allows "Try it out" with API keys)
- **MCP Configuration Guide:** Step-by-step instructions for integrating with Claude Desktop, including `claude_desktop_config.json` example
- **Integration Guides:**
  - **SymbioAgentMac:** How to configure voice agent to use Agent API
  - **ExpTube:** How to create pages from video transcripts
  - **Custom Agents:** Python and TypeScript SDK examples
- **SDK Examples:**
  - Python: `symbio-kb-client` package with `SymbioKB` class (methods: `search`, `read_page`, `create_page`, `update_page`)
  - TypeScript: `@symbio/kb-client` package with same interface
- **Error Codes Reference:** Exhaustive list of error codes with descriptions and solutions
- **Rate Limit Documentation:** Explain sliding window, headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After`)

Docs include curl examples for every endpoint, authentication flow diagrams, and rate limit behavior examples.

**Depends on:** SKB-15.1, SKB-15.2, SKB-15.3 (all API features must exist to document)

---

## Test Coverage Requirements

| Story | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 15.1 | Markdown conversion round-trip tests; Zod schema validation | API endpoints return correct markdown; wikilinks preserved; pagination works | Agent creates page via POST, reads via GET, verifies markdown matches |
| 15.2 | MCP tool input/output validation; resource URI parsing | MCP server responds to tool calls; stdio transport works; auth token validated | Claude Desktop integration: search pages, read page, create note |
| 15.3 | API key hashing; JWT signature validation; rate limit counter increment | Rate limiter blocks after 100 requests; audit log records action; read-only key blocked on POST | Full agent workflow with API key: create 50 pages, hit rate limit, wait 1 min, continue |
| 15.4 | OpenAPI spec validates against schema | Swagger UI renders without errors; Try it out works with API key | Follow Python SDK example, create page programmatically |

---

## Implementation Order

```
15.1 → 15.3 → 15.2 → 15.4

┌────────┐     ┌────────┐     ┌────────┐     ┌────────┐
│ 15.1   │────▶│ 15.3   │────▶│ 15.2   │────▶│ 15.4   │
│ REST   │     │ Auth + │     │ MCP    │     │ Docs   │
│ API    │     │ Rate   │     │ Server │     │        │
└────────┘     └────────┘     └────────┘     └────────┘

15.1: Core API endpoints (no auth initially, add placeholder middleware)
15.3: Add auth middleware, rate limiting, audit logging
15.2: Build MCP server on top of authenticated API
15.4: Document everything (final polish)
```

---

## Shared Constraints

- **Multi-Tenant Isolation:** All queries must filter by `tenant_id` extracted from JWT or API key
- **Markdown Fidelity:** Round-trip conversion (TipTap → Markdown → TipTap) must preserve wikilinks, formatting, and structure
- **Rate Limiting:** Enforce 100 req/min per API key or user_id — no exceptions for admin users
- **Audit Logging:** Log all mutations (POST/PUT/DELETE) with sanitized request body (redact sensitive fields)
- **API Versioning:** All agent endpoints implicitly v1 (`/api/agent/*`) — future versions will use `/api/v2/agent/*`
- **Error Responses:** Follow standard envelope `{ error: { code, message, details? }, meta: { timestamp } }`
- **Idempotency:** PUT requests should be idempotent — updating a page with identical markdown should not change `updated_at`
- **MCP Protocol Compliance:** Follow Model Context Protocol spec v1.0 strictly — validate with official MCP validator
- **Security:** API keys stored as bcrypt hashes, never plaintext; Supabase JWTs validated against public key
- **Performance:** Agent API endpoints should respond in <200ms for reads, <500ms for writes

---

## Files Created/Modified by This Epic

### New Files
- `src/app/api/agent/pages/route.ts` — GET (list pages), POST (create page)
- `src/app/api/agent/pages/[id]/route.ts` — GET (read page markdown), PUT (update page markdown)
- `src/app/api/agent/search/route.ts` — GET (search pages)
- `src/app/api/agent/graph/route.ts` — GET (graph data)
- `src/lib/agent/markdown.ts` — `tiptapToMarkdown`, `markdownToTiptap` utilities (or import from EPIC-14)
- `src/lib/agent/auth.ts` — `validateSupabaseJWT`, `validateApiKey` middleware
- `src/lib/agent/ratelimit.ts` — Redis-backed rate limiter
- `src/lib/agent/audit.ts` — Audit log creation utility
- `packages/mcp-server/index.ts` — MCP server implementation
- `packages/mcp-server/tools/` — Individual tool implementations
- `packages/mcp-server/resources/` — Resource handlers
- `packages/mcp-server/package.json` — MCP server package config
- `docs/api/agent-openapi.yaml` — Agent API OpenAPI spec
- `src/app/api/agent/docs/page.tsx` — Swagger UI for agent API
- `src/app/settings/api-keys/page.tsx` — API key management UI
- `docs/guides/agent-api.md` — Agent API integration guide
- `docs/guides/mcp-setup.md` — MCP server setup guide
- `examples/python/symbio_kb_client.py` — Python SDK example
- `examples/typescript/symbio-kb-client.ts` — TypeScript SDK example
- `src/__tests__/api/agent/pages/route.test.ts`
- `src/__tests__/lib/agent/markdown.test.ts`
- `src/__tests__/lib/agent/ratelimit.test.ts`
- `packages/mcp-server/__tests__/tools.test.ts`

### Modified Files
- `prisma/schema.prisma` — Add `audit_logs` table, update `api_keys` table with scopes
- `.env.example` — Add `SYMBIO_AUTH_TOKEN`, `REDIS_URL`
- `package.json` — Add `@modelcontextprotocol/sdk`, `bcryptjs`, `redis` dependencies
- `docker-compose.yml` — Add Redis service for rate limiting
- `src/middleware.ts` — Add agent API auth middleware

---

## Database Schema Changes

```prisma
model AuditLog {
  id        String   @id @default(uuid())
  tenantId  String   @map("tenant_id")
  userId    String?  @map("user_id")
  apiKeyId  String?  @map("api_key_id")
  action    String   // CREATE_PAGE, UPDATE_PAGE, DELETE_PAGE, etc.
  resource  String   // pages, blocks, databases
  resourceId String? @map("resource_id")
  details   Json?    // Sanitized request body
  createdAt DateTime @default(now()) @map("created_at")

  tenant Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  user   User?   @relation(fields: [userId], references: [id], onDelete: SetNull)
  apiKey ApiKey? @relation(fields: [apiKeyId], references: [id], onDelete: SetNull)

  @@index([tenantId, createdAt], map: "idx_audit_logs_tenant_created")
  @@index([userId], map: "idx_audit_logs_user")
  @@index([apiKeyId], map: "idx_audit_logs_api_key")
  @@map("audit_logs")
}

// Update existing ApiKey model
model ApiKey {
  // ... existing fields ...
  scopes     String[] @default(["read"]) // ["read"] or ["read", "write"]
  auditLogs  AuditLog[]
}
```

---

**Last Updated:** 2026-02-22
