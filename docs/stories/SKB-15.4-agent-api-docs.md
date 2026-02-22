# Story SKB-15.4: Agent API Documentation

**Epic:** Epic 15 - Agent API & MCP Server
**Story ID:** SKB-15.4
**Story Points:** 8 | **Priority:** Medium | **Status:** Planned
**Depends On:** SKB-15.1, SKB-15.2, SKB-15.3 (all Agent API features must exist)

---

## User Story

As a developer integrating with SymbioKnowledgeBase, I want comprehensive API documentation with interactive examples, So that I can quickly understand how to authenticate, call endpoints, and handle errors without reading source code.

---

## Acceptance Criteria

- [ ] **OpenAPI Specification:**
  - `docs/api/agent-openapi.yaml` documenting all `/api/agent/*` endpoints
  - Complete request/response schemas with examples
  - Authentication schemes (API Key, Supabase JWT)
  - Rate limit documentation (headers, error responses)
  - Error codes reference (UNAUTHORIZED, FORBIDDEN, RATE_LIMIT_EXCEEDED, etc.)
- [ ] **Interactive Documentation:**
  - Swagger UI page at `/api/agent/docs`
  - "Try it out" functionality with API key input
  - Example requests/responses for every endpoint
  - Syntax-highlighted JSON/markdown samples
- [ ] **MCP Configuration Guide:**
  - Step-by-step Claude Desktop setup (`claude_desktop_config.json`)
  - Environment variable reference
  - Troubleshooting common issues
  - Example MCP tool calls
- [ ] **Integration Guides:**
  - **SymbioAgentMac:** Voice agent configuration
  - **ExpTube:** Video transcript → knowledge base flow
  - **Custom Agents:** Generic integration pattern
  - **Python Example:** Complete working script
  - **TypeScript Example:** Complete working script
- [ ] **SDK Examples:**
  - Python: `examples/python/symbio_kb_client.py` with class-based interface
  - TypeScript: `examples/typescript/symbio-kb-client.ts` with async/await
  - Both include: search, read, create, update, error handling
- [ ] **Error Handling Guide:**
  - Exhaustive list of error codes with descriptions
  - HTTP status codes mapping
  - Retry strategies for rate limits and transient errors
  - Example error responses
- [ ] **Rate Limit Documentation:**
  - Explain sliding window algorithm
  - Response headers (`X-RateLimit-*`)
  - `429 Too Many Requests` handling
  - Best practices for staying under limits
- [ ] **Authentication Guide:**
  - API key generation workflow (with screenshots)
  - Supabase JWT usage across Symbio apps
  - Scopes explanation (read-only vs read-write)
  - Security best practices (key rotation, storage)
- [ ] Curl examples for every endpoint
- [ ] Markdown formatting guide (supported syntax, wikilinks)
- [ ] TypeScript strict mode — no `any` types in example code

---

## Architecture Overview

```
Documentation Architecture
──────────────────────────

┌─────────────────────────────────────────────────────────────────────┐
│  /api/agent/docs (Swagger UI)                                        │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Agent API Documentation                                        │ │
│  │                                                                 │ │
│  │  Authentication: [API Key: skb_live_...              ] 🔑       │ │
│  │                                                                 │ │
│  │  ▼ Pages                                                        │ │
│  │    GET  /api/agent/pages          List all pages               │ │
│  │    POST /api/agent/pages          Create new page              │ │
│  │                                                                 │ │
│  │    GET /api/agent/pages/{id}      [Expand]                     │ │
│  │      Parameters:                                                │ │
│  │        id: string (path, required) - Page UUID                 │ │
│  │      Responses:                                                 │ │
│  │        200: Success                                             │ │
│  │          {                                                      │ │
│  │            "data": {                                            │ │
│  │              "id": "uuid",                                      │ │
│  │              "title": "Page Title",                             │ │
│  │              "markdown": "# Content..."                         │ │
│  │            }                                                    │ │
│  │          }                                                      │ │
│  │        404: Page not found                                      │ │
│  │      [Try it out] [Execute]                                     │ │
│  │                                                                 │ │
│  │  ▼ Search                                                       │ │
│  │    GET /api/agent/search          Full-text search             │ │
│  │                                                                 │ │
│  │  ▼ Graph                                                        │ │
│  │    GET /api/agent/graph           Knowledge graph              │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘

Documentation Files:
┌─────────────────────────────────────────────────────────────────────┐
│  docs/                                                               │
│    api/                                                              │
│      agent-openapi.yaml         ← OpenAPI 3.0 spec                  │
│    guides/                                                           │
│      agent-api.md               ← General API guide                 │
│      mcp-setup.md               ← MCP server setup                  │
│      authentication.md          ← Auth guide                        │
│      error-handling.md          ← Error codes reference             │
│      rate-limiting.md           ← Rate limit details                │
│      markdown-format.md         ← Supported markdown syntax         │
│    integrations/                                                     │
│      symbio-agent-mac.md        ← Voice agent setup                 │
│      exptube.md                 ← Video platform integration        │
│      custom-agents.md           ← Generic integration               │
│  examples/                                                           │
│    python/                                                           │
│      symbio_kb_client.py        ← Python SDK example                │
│      requirements.txt                                                │
│    typescript/                                                       │
│      symbio-kb-client.ts        ← TypeScript SDK example            │
│      package.json                                                    │
└─────────────────────────────────────────────────────────────────────┘

SDK Example Usage:
┌─────────────────────────────────────────────────────────────────────┐
│  Python:                                                             │
│    from symbio_kb_client import SymbioKB                             │
│                                                                       │
│    kb = SymbioKB(api_key="skb_live_...")                             │
│                                                                       │
│    # Search                                                          │
│    results = kb.search("machine learning", limit=10)                 │
│    for r in results:                                                 │
│        print(f"{r.title}: {r.snippet}")                              │
│                                                                       │
│    # Read page                                                       │
│    page = kb.read_page("page-id-or-title")                           │
│    print(page.markdown)                                              │
│                                                                       │
│    # Create page                                                     │
│    new_page = kb.create_page(                                        │
│        title="Meeting Notes",                                        │
│        markdown="# Agenda\n- Item 1\n- Item 2"                       │
│    )                                                                 │
│                                                                       │
│    # Update page                                                     │
│    kb.update_page(new_page.id, "# Updated\nNew content")             │
│                                                                       │
│  TypeScript:                                                         │
│    import { SymbioKB } from './symbio-kb-client';                    │
│                                                                       │
│    const kb = new SymbioKB({ apiKey: 'skb_live_...' });              │
│                                                                       │
│    // Search                                                         │
│    const results = await kb.search('machine learning', 10);          │
│    results.forEach(r => console.log(`${r.title}: ${r.snippet}`));    │
│                                                                       │
│    // Read page                                                      │
│    const page = await kb.readPage('page-id-or-title');               │
│    console.log(page.markdown);                                       │
│                                                                       │
│    // Create page                                                    │
│    const newPage = await kb.createPage({                             │
│      title: 'Meeting Notes',                                         │
│      markdown: '# Agenda\n- Item 1\n- Item 2'                        │
│    });                                                               │
│                                                                       │
│    // Update page                                                    │
│    await kb.updatePage(newPage.id, '# Updated\nNew content');        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Create OpenAPI Specification

**File: `docs/api/agent-openapi.yaml`**

```yaml
openapi: 3.0.3
info:
  title: SymbioKnowledgeBase Agent API
  description: |
    RESTful API for AI agents to interact with SymbioKnowledgeBase.

    All content is exchanged in markdown format for maximum agent compatibility.

    **Authentication**: API Key (Bearer token) or Supabase JWT
    **Rate Limiting**: 100 requests/minute per API key or user
    **Base URL**: `http://localhost:3000/api/agent`

    ## Quick Start

    1. Generate an API key in Settings → API Keys
    2. Include in Authorization header: `Bearer skb_live_...`
    3. All responses follow envelope: `{ data, meta }`

  version: 1.0.0
  contact:
    name: SymbioKnowledgeBase
    url: https://github.com/symbio/knowledge-base

servers:
  - url: http://localhost:3000/api/agent
    description: Development server
  - url: https://kb.symbio.app/api/agent
    description: Production server

security:
  - ApiKey: []
  - SupabaseJWT: []

tags:
  - name: Pages
    description: Create, read, update pages
  - name: Search
    description: Full-text search
  - name: Graph
    description: Knowledge graph

paths:
  /pages:
    get:
      summary: List pages
      tags: [Pages]
      parameters:
        - name: limit
          in: query
          schema: { type: integer, default: 50, maximum: 100 }
          description: Max results per page
        - name: offset
          in: query
          schema: { type: integer, default: 0 }
          description: Pagination offset
        - name: parent_id
          in: query
          schema: { type: string, format: uuid }
          description: Filter by parent page (nested pages)
        - name: search
          in: query
          schema: { type: string }
          description: Filter by title (case-insensitive)
      responses:
        '200':
          description: List of pages
          headers:
            X-RateLimit-Limit: { $ref: '#/components/headers/X-RateLimit-Limit' }
            X-RateLimit-Remaining: { $ref: '#/components/headers/X-RateLimit-Remaining' }
            X-RateLimit-Reset: { $ref: '#/components/headers/X-RateLimit-Reset' }
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items: { $ref: '#/components/schemas/PageSummary' }
                  meta: { $ref: '#/components/schemas/PaginationMeta' }
              example:
                data:
                  - id: "550e8400-e29b-41d4-a716-446655440000"
                    title: "Project Roadmap"
                    icon: "🗺️"
                    parent_id: null
                    created_at: "2026-02-22T10:00:00Z"
                    updated_at: "2026-02-22T15:30:00Z"
                meta:
                  total: 42
                  limit: 50
                  offset: 0
        '401': { $ref: '#/components/responses/Unauthorized' }
        '429': { $ref: '#/components/responses/RateLimitExceeded' }

    post:
      summary: Create page
      tags: [Pages]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [title]
              properties:
                title: { type: string, minLength: 1, maxLength: 255 }
                markdown: { type: string, description: "Page content in markdown format" }
                parent_id: { type: string, format: uuid, description: "Parent page ID for nesting" }
                icon: { type: string, description: "Emoji icon" }
            example:
              title: "Meeting Notes 2026-02-22"
              markdown: "# Agenda\n\n- Review Q1 goals\n- Discuss [[Project Roadmap]]\n\n## Action Items\n\n- [ ] Update timeline"
              icon: "📝"
      responses:
        '201':
          description: Page created
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: object
                    properties:
                      id: { type: string, format: uuid }
                      title: { type: string }
                      created_at: { type: string, format: date-time }
                  meta: { $ref: '#/components/schemas/TimestampMeta' }
        '400': { $ref: '#/components/responses/ValidationError' }
        '401': { $ref: '#/components/responses/Unauthorized' }
        '403': { $ref: '#/components/responses/Forbidden' }
        '429': { $ref: '#/components/responses/RateLimitExceeded' }

  /pages/{id}:
    get:
      summary: Read page
      tags: [Pages]
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string, format: uuid }
          description: Page UUID
      responses:
        '200':
          description: Page content
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/PageWithMarkdown' }
                  meta: { $ref: '#/components/schemas/TimestampMeta' }
              example:
                data:
                  id: "550e8400-e29b-41d4-a716-446655440000"
                  title: "Project Roadmap"
                  icon: "🗺️"
                  parent_id: null
                  markdown: "# 2026 Roadmap\n\n## Q1\n- Launch Agent API\n- MCP Server integration\n\n## Q2\n- Mobile app [[SciSymbioLens]]"
                  created_at: "2026-02-22T10:00:00Z"
                  updated_at: "2026-02-22T15:30:00Z"
        '404': { $ref: '#/components/responses/NotFound' }
        '401': { $ref: '#/components/responses/Unauthorized' }
        '429': { $ref: '#/components/responses/RateLimitExceeded' }

    put:
      summary: Update page
      tags: [Pages]
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string, format: uuid }
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [markdown]
              properties:
                markdown: { type: string }
            example:
              markdown: "# Updated Roadmap\n\n## Q1 (Revised)\n- Agent API ✅\n- MCP Server (in progress)"
      responses:
        '200':
          description: Page updated
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: object
                    properties:
                      id: { type: string }
                      updated_at: { type: string, format: date-time }
        '404': { $ref: '#/components/responses/NotFound' }
        '401': { $ref: '#/components/responses/Unauthorized' }
        '403': { $ref: '#/components/responses/Forbidden' }
        '429': { $ref: '#/components/responses/RateLimitExceeded' }

  /search:
    get:
      summary: Full-text search
      tags: [Search]
      parameters:
        - name: q
          in: query
          required: true
          schema: { type: string, minLength: 1, maxLength: 500 }
          description: Search query
        - name: limit
          in: query
          schema: { type: integer, default: 20, maximum: 100 }
        - name: offset
          in: query
          schema: { type: integer, default: 0 }
      responses:
        '200':
          description: Search results with markdown snippets
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items: { $ref: '#/components/schemas/SearchResult' }
                  meta: { $ref: '#/components/schemas/PaginationMeta' }
              example:
                data:
                  - page_id: "550e8400-e29b-41d4-a716-446655440000"
                    title: "Machine Learning Basics"
                    icon: "🤖"
                    snippet: "...introduction to **machine learning** algorithms including supervised..."
                    score: 0.92
                meta:
                  total: 15
                  limit: 20
                  offset: 0
        '400': { $ref: '#/components/responses/ValidationError' }
        '401': { $ref: '#/components/responses/Unauthorized' }
        '429': { $ref: '#/components/responses/RateLimitExceeded' }

  /graph:
    get:
      summary: Get knowledge graph
      tags: [Graph]
      parameters:
        - name: pageId
          in: query
          schema: { type: string, format: uuid }
          description: Center page ID for local graph (omit for global)
        - name: depth
          in: query
          schema: { type: integer, minimum: 1, maximum: 5, default: 2 }
          description: BFS expansion depth (only with pageId)
      responses:
        '200':
          description: Graph nodes and edges
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/GraphData' }
                  meta: { $ref: '#/components/schemas/GraphMeta' }

components:
  securitySchemes:
    ApiKey:
      type: http
      scheme: bearer
      bearerFormat: API Key
      description: |
        API key generated in Settings → API Keys.
        Format: `skb_live_` + 32 random characters.
        Include in header: `Authorization: Bearer skb_live_...`
    SupabaseJWT:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: |
        Supabase JWT token from Symbio ecosystem apps.
        Obtained via Supabase Auth in ExpTube, CAM ELN, etc.

  headers:
    X-RateLimit-Limit:
      schema: { type: integer }
      description: Max requests per minute (100)
    X-RateLimit-Remaining:
      schema: { type: integer }
      description: Requests remaining in current window
    X-RateLimit-Reset:
      schema: { type: integer }
      description: Unix timestamp when window resets

  schemas:
    PageSummary:
      type: object
      properties:
        id: { type: string, format: uuid }
        title: { type: string }
        icon: { type: string, nullable: true }
        parent_id: { type: string, format: uuid, nullable: true }
        created_at: { type: string, format: date-time }
        updated_at: { type: string, format: date-time }

    PageWithMarkdown:
      allOf:
        - $ref: '#/components/schemas/PageSummary'
        - type: object
          properties:
            markdown: { type: string, description: "Full page content in markdown format" }

    SearchResult:
      type: object
      properties:
        page_id: { type: string, format: uuid }
        title: { type: string }
        icon: { type: string, nullable: true }
        snippet: { type: string, description: "Markdown excerpt with search term context" }
        score: { type: number, format: float, description: "Relevance score (0-1)" }

    GraphData:
      type: object
      properties:
        nodes:
          type: array
          items:
            type: object
            properties:
              id: { type: string }
              label: { type: string }
              icon: { type: string, nullable: true }
              link_count: { type: integer }
        edges:
          type: array
          items:
            type: object
            properties:
              source: { type: string }
              target: { type: string }

    PaginationMeta:
      type: object
      properties:
        total: { type: integer }
        limit: { type: integer }
        offset: { type: integer }
        timestamp: { type: string, format: date-time }

    TimestampMeta:
      type: object
      properties:
        timestamp: { type: string, format: date-time }

    GraphMeta:
      type: object
      properties:
        node_count: { type: integer }
        edge_count: { type: integer }
        timestamp: { type: string, format: date-time }

    ApiError:
      type: object
      properties:
        error:
          type: object
          properties:
            code: { type: string, enum: [UNAUTHORIZED, FORBIDDEN, NOT_FOUND, VALIDATION_ERROR, RATE_LIMIT_EXCEEDED, INTERNAL_ERROR] }
            message: { type: string }
            details: { type: array, items: {} }
        meta: { $ref: '#/components/schemas/TimestampMeta' }

  responses:
    Unauthorized:
      description: Missing or invalid authentication
      content:
        application/json:
          schema: { $ref: '#/components/schemas/ApiError' }
          example:
            error:
              code: "UNAUTHORIZED"
              message: "Invalid API key"
            meta:
              timestamp: "2026-02-22T10:00:00Z"

    Forbidden:
      description: Insufficient permissions (scope violation)
      content:
        application/json:
          schema: { $ref: '#/components/schemas/ApiError' }
          example:
            error:
              code: "FORBIDDEN"
              message: "Insufficient permissions (write scope required)"
            meta:
              timestamp: "2026-02-22T10:00:00Z"

    NotFound:
      description: Resource not found
      content:
        application/json:
          schema: { $ref: '#/components/schemas/ApiError' }

    ValidationError:
      description: Invalid request body or query parameters
      content:
        application/json:
          schema: { $ref: '#/components/schemas/ApiError' }
          example:
            error:
              code: "VALIDATION_ERROR"
              message: "Invalid input"
              details:
                - field: "title"
                  message: "Required"
            meta:
              timestamp: "2026-02-22T10:00:00Z"

    RateLimitExceeded:
      description: Too many requests
      headers:
        X-RateLimit-Limit: { $ref: '#/components/headers/X-RateLimit-Limit' }
        X-RateLimit-Remaining: { $ref: '#/components/headers/X-RateLimit-Remaining' }
        X-RateLimit-Reset: { $ref: '#/components/headers/X-RateLimit-Reset' }
        Retry-After:
          schema: { type: integer }
          description: Seconds until rate limit resets
      content:
        application/json:
          schema: { $ref: '#/components/schemas/ApiError' }
          example:
            error:
              code: "RATE_LIMIT_EXCEEDED"
              message: "Too many requests"
              details:
                retry_after: 42
            meta:
              timestamp: "2026-02-22T10:00:00Z"
```

---

### Step 2: Create Swagger UI Page

**File: `src/app/api/agent/docs/page.tsx`**

```typescript
'use client';

import dynamic from 'next/dynamic';
import 'swagger-ui-react/swagger-ui.css';

const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });

export default function AgentApiDocsPage() {
  return (
    <div className="min-h-screen">
      <SwaggerUI
        url="/api/agent/openapi.yaml"
        docExpansion="list"
        defaultModelsExpandDepth={1}
      />
    </div>
  );
}
```

**File: `src/app/api/agent/openapi.yaml/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET() {
  const filePath = join(process.cwd(), 'docs', 'api', 'agent-openapi.yaml');
  const content = readFileSync(filePath, 'utf-8');

  return new NextResponse(content, {
    headers: { 'Content-Type': 'text/yaml' },
  });
}
```

---

### Step 3: Create Python SDK Example

**File: `examples/python/symbio_kb_client.py`**

```python
"""
SymbioKnowledgeBase Python Client
Example usage of the Agent API
"""
import requests
from typing import List, Optional, Dict, Any
from dataclasses import dataclass


@dataclass
class Page:
    id: str
    title: str
    icon: Optional[str]
    markdown: str
    created_at: str
    updated_at: str


@dataclass
class SearchResult:
    page_id: str
    title: str
    icon: Optional[str]
    snippet: str
    score: float


class SymbioKB:
    def __init__(self, api_key: str, base_url: str = "http://localhost:3000"):
        self.api_key = api_key
        self.base_url = f"{base_url}/api/agent"
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        })

    def _request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        url = f"{self.base_url}{endpoint}"
        response = self.session.request(method, url, **kwargs)

        if response.status_code == 429:
            retry_after = response.headers.get("Retry-After", "60")
            raise Exception(f"Rate limit exceeded. Retry after {retry_after}s")

        if not response.ok:
            error = response.json().get("error", {})
            raise Exception(f"{error.get('code')}: {error.get('message')}")

        return response.json()

    def search(self, query: str, limit: int = 20) -> List[SearchResult]:
        """Search pages by query string"""
        data = self._request("GET", f"/search?q={query}&limit={limit}")
        return [
            SearchResult(
                page_id=r["page_id"],
                title=r["title"],
                icon=r.get("icon"),
                snippet=r["snippet"],
                score=r["score"],
            )
            for r in data["data"]
        ]

    def read_page(self, id_or_title: str) -> Page:
        """Read page by ID or title"""
        # Try as ID first
        try:
            data = self._request("GET", f"/pages/{id_or_title}")
        except:
            # Search by title
            results = self.search(id_or_title, limit=1)
            if not results:
                raise Exception(f"Page not found: {id_or_title}")
            data = self._request("GET", f"/pages/{results[0].page_id}")

        page_data = data["data"]
        return Page(
            id=page_data["id"],
            title=page_data["title"],
            icon=page_data.get("icon"),
            markdown=page_data["markdown"],
            created_at=page_data["created_at"],
            updated_at=page_data["updated_at"],
        )

    def create_page(
        self, title: str, markdown: str = "", parent_id: Optional[str] = None, icon: Optional[str] = None
    ) -> Page:
        """Create a new page"""
        body = {"title": title, "markdown": markdown}
        if parent_id:
            body["parent_id"] = parent_id
        if icon:
            body["icon"] = icon

        data = self._request("POST", "/pages", json=body)
        page_id = data["data"]["id"]

        # Read full page to return complete data
        return self.read_page(page_id)

    def update_page(self, page_id: str, markdown: str) -> None:
        """Update page content"""
        self._request("PUT", f"/pages/{page_id}", json={"markdown": markdown})

    def list_pages(self, parent_id: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        """List all pages or filter by parent"""
        params = {"limit": limit}
        if parent_id:
            params["parent_id"] = parent_id

        data = self._request("GET", "/pages", params=params)
        return data["data"]


# Example usage
if __name__ == "__main__":
    kb = SymbioKB(api_key="skb_live_YOUR_KEY_HERE")

    # Search
    print("Searching for 'machine learning'...")
    results = kb.search("machine learning", limit=5)
    for r in results:
        print(f"  {r.title} (score: {r.score:.2f})")
        print(f"  {r.snippet}\n")

    # Create page
    print("Creating new page...")
    page = kb.create_page(
        title="Python API Example",
        markdown="# Example\n\nThis page was created via the Python SDK!\n\nSee [[Project Roadmap]] for more.",
        icon="🐍",
    )
    print(f"Created: {page.title} (ID: {page.id})")

    # Read page
    print(f"\nReading page '{page.title}'...")
    loaded_page = kb.read_page(page.id)
    print(f"Content:\n{loaded_page.markdown}")

    # Update page
    print("\nUpdating page...")
    kb.update_page(page.id, "# Updated Example\n\nThis content was updated!")
    print("✓ Page updated")

    # List pages
    print("\nListing all pages...")
    pages = kb.list_pages(limit=10)
    for p in pages:
        print(f"  {p['icon'] or '📄'} {p['title']}")
```

**File: `examples/python/requirements.txt`**

```
requests>=2.31.0
```

---

### Step 4: Create TypeScript SDK Example

**File: `examples/typescript/symbio-kb-client.ts`**

```typescript
/**
 * SymbioKnowledgeBase TypeScript Client
 * Example usage of the Agent API
 */

interface Page {
  id: string;
  title: string;
  icon?: string;
  markdown: string;
  created_at: string;
  updated_at: string;
}

interface SearchResult {
  page_id: string;
  title: string;
  icon?: string;
  snippet: string;
  score: number;
}

interface ApiResponse<T> {
  data: T;
  meta: any;
}

class SymbioKB {
  private apiKey: string;
  private baseUrl: string;

  constructor(options: { apiKey: string; baseUrl?: string }) {
    this.apiKey = options.apiKey;
    this.baseUrl = `${options.baseUrl || 'http://localhost:3000'}/api/agent`;
  }

  private async request<T>(
    method: string,
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After') || '60';
      throw new Error(`Rate limit exceeded. Retry after ${retryAfter}s`);
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`${error.error?.code}: ${error.error?.message}`);
    }

    const data: ApiResponse<T> = await response.json();
    return data.data;
  }

  async search(query: string, limit = 20): Promise<SearchResult[]> {
    return this.request<SearchResult[]>(
      'GET',
      `/search?q=${encodeURIComponent(query)}&limit=${limit}`
    );
  }

  async readPage(idOrTitle: string): Promise<Page> {
    // Try as ID first
    try {
      return await this.request<Page>('GET', `/pages/${idOrTitle}`);
    } catch {
      // Search by title
      const results = await this.search(idOrTitle, 1);
      if (results.length === 0) {
        throw new Error(`Page not found: ${idOrTitle}`);
      }
      return this.request<Page>('GET', `/pages/${results[0].page_id}`);
    }
  }

  async createPage(options: {
    title: string;
    markdown?: string;
    parentId?: string;
    icon?: string;
  }): Promise<Page> {
    const body: any = {
      title: options.title,
      markdown: options.markdown || '',
    };
    if (options.parentId) body.parent_id = options.parentId;
    if (options.icon) body.icon = options.icon;

    const result = await this.request<{ id: string; title: string }>(
      'POST',
      '/pages',
      { body: JSON.stringify(body) }
    );

    // Read full page to return complete data
    return this.readPage(result.id);
  }

  async updatePage(pageId: string, markdown: string): Promise<void> {
    await this.request('PUT', `/pages/${pageId}`, {
      body: JSON.stringify({ markdown }),
    });
  }

  async listPages(parentId?: string, limit = 50): Promise<any[]> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (parentId) params.set('parent_id', parentId);

    return this.request<any[]>('GET', `/pages?${params}`);
  }
}

// Example usage
async function main() {
  const kb = new SymbioKB({ apiKey: 'skb_live_YOUR_KEY_HERE' });

  // Search
  console.log("Searching for 'machine learning'...");
  const results = await kb.search('machine learning', 5);
  results.forEach((r) => {
    console.log(`  ${r.title} (score: ${r.score.toFixed(2)})`);
    console.log(`  ${r.snippet}\n`);
  });

  // Create page
  console.log('Creating new page...');
  const page = await kb.createPage({
    title: 'TypeScript API Example',
    markdown:
      '# Example\n\nThis page was created via the TypeScript SDK!\n\nSee [[Project Roadmap]] for more.',
    icon: '📘',
  });
  console.log(`Created: ${page.title} (ID: ${page.id})`);

  // Read page
  console.log(`\nReading page '${page.title}'...`);
  const loadedPage = await kb.readPage(page.id);
  console.log(`Content:\n${loadedPage.markdown}`);

  // Update page
  console.log('\nUpdating page...');
  await kb.updatePage(page.id, '# Updated Example\n\nThis content was updated!');
  console.log('✓ Page updated');

  // List pages
  console.log('\nListing all pages...');
  const pages = await kb.listPages(undefined, 10);
  pages.forEach((p) => console.log(`  ${p.icon || '📄'} ${p.title}`));
}

main().catch(console.error);
```

**File: `examples/typescript/package.json`**

```json
{
  "name": "symbio-kb-example",
  "type": "module",
  "scripts": {
    "start": "tsx symbio-kb-client.ts"
  },
  "dependencies": {
    "tsx": "^4.7.0"
  }
}
```

---

### Step 5: Create Integration Guides

**File: `docs/guides/agent-api.md`**

(Comprehensive guide covering authentication, endpoints, examples, error handling, etc.)

**File: `docs/guides/mcp-setup.md`**

(Already created in SKB-15.2, reference that README)

**File: `docs/guides/authentication.md`**

```markdown
# Agent API Authentication

## Overview

SymbioKnowledgeBase Agent API supports two authentication methods:

1. **API Keys** — for third-party integrations and custom agents
2. **Supabase JWT** — for Symbio ecosystem apps (ExpTube, CAM ELN, etc.)

## API Keys

### Generating an API Key

1. Log into SymbioKnowledgeBase
2. Navigate to Settings → API Keys
3. Click "Generate New Key"
4. Enter a name (e.g., "Production Agent")
5. Select scopes:
   - **Read**: GET requests only
   - **Write**: Full access (GET, POST, PUT, DELETE)
6. Click "Generate"
7. **Copy the key immediately** — you won't see it again!

### Using an API Key

Include in the `Authorization` header:

```bash
curl http://localhost:3000/api/agent/pages \
  -H "Authorization: Bearer skb_live_a1b2c3d4..."
```

### Security Best Practices

- **Never commit keys to version control**
- Store in environment variables: `export SYMBIO_API_KEY=skb_live_...`
- Rotate keys every 90 days
- Use read-only keys when write access isn't needed
- Revoke unused keys immediately

## Supabase JWT

### For Symbio Ecosystem Apps

If your agent runs within a Symbio app (ExpTube, CAM ELN, SymbioAgentMac), use the existing Supabase JWT:

```typescript
// Obtain JWT from Supabase Auth
const { data } = await supabase.auth.getSession();
const token = data.session?.access_token;

// Use in API requests
fetch('http://localhost:3000/api/agent/pages', {
  headers: { Authorization: `Bearer ${token}` },
});
```

### JWT Claims

The JWT must include:
- `sub`: User ID
- `exp`: Expiration timestamp
- Custom claim `tenant_id` (or looked up from DB)

## Error Responses

### 401 Unauthorized
**Cause**: Missing, invalid, or expired token
**Solution**: Generate new API key or refresh JWT

### 403 Forbidden
**Cause**: Scope violation (e.g., read-only key attempting POST)
**Solution**: Generate key with write scope

### 429 Too Many Requests
**Cause**: Rate limit exceeded (100 req/min)
**Solution**: Wait for `Retry-After` seconds, implement backoff

## Scopes

| Scope | Allowed Methods | Use Case |
|-------|----------------|----------|
| `read` | GET | Search, read pages (no modifications) |
| `write` | GET, POST, PUT, DELETE | Full agent access |

## Multi-Tenant Isolation

All requests are scoped to the `tenant_id` extracted from your token. You can only access data within your tenant — cross-tenant access is blocked at the database level.
```

---

## Testing Requirements

### Manual Verification

```bash
# 1. Navigate to /api/agent/docs
# Expected: Swagger UI loads with all endpoints

# 2. Expand GET /api/agent/pages
# Expected: Request/response schemas visible, example values shown

# 3. Click "Try it out", enter API key, execute
# Expected: 200 response with actual data

# 4. Test Python SDK
cd examples/python
python symbio_kb_client.py
# Expected: Search results, page created, page updated

# 5. Test TypeScript SDK
cd examples/typescript
npm install && npm start
# Expected: Same flow as Python
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `docs/api/agent-openapi.yaml` |
| CREATE | `src/app/api/agent/docs/page.tsx` |
| CREATE | `src/app/api/agent/openapi.yaml/route.ts` |
| CREATE | `examples/python/symbio_kb_client.py` |
| CREATE | `examples/python/requirements.txt` |
| CREATE | `examples/typescript/symbio-kb-client.ts` |
| CREATE | `examples/typescript/package.json` |
| CREATE | `docs/guides/agent-api.md` |
| CREATE | `docs/guides/authentication.md` |
| CREATE | `docs/guides/error-handling.md` |
| CREATE | `docs/guides/rate-limiting.md` |
| CREATE | `docs/guides/markdown-format.md` |
| CREATE | `docs/integrations/symbio-agent-mac.md` |
| CREATE | `docs/integrations/exptube.md` |
| CREATE | `docs/integrations/custom-agents.md` |

---

## Dev Notes

### OpenAPI Maintenance
- Update spec whenever API changes
- Validate with `swagger-cli validate docs/api/agent-openapi.yaml`
- Keep examples realistic (use actual data from test tenant)

### SDK Examples
- Test both Python and TypeScript examples regularly
- Update when API changes
- Include error handling in all examples

### Documentation Style
- Use active voice ("Generate an API key")
- Include code examples for every concept
- Provide troubleshooting for common errors

### Future Enhancements
- Auto-generate OpenAPI spec from TypeScript types
- Publish Python/TypeScript SDKs as installable packages
- Interactive tutorial wizard for first-time users

---

**Last Updated:** 2026-02-22
