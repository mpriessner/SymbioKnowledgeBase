# Agent API Guide

The SymbioKnowledgeBase Agent API is a REST interface designed for AI agents, automation pipelines, and programmatic access to the knowledge base. It operates on **markdown** as the primary content format, making it straightforward for agents to read and write structured knowledge without dealing with the internal TipTap/ProseMirror document model.

All Agent API endpoints live under the `/api/agent/` prefix and share a consistent JSON envelope, authentication scheme, and error format.

---

## Quick Start

### 1. Generate an API Key

Navigate to **Settings > API Keys** in the web UI, or call the key-generation endpoint directly:

```bash
curl -X POST https://kb.example.com/api/settings/api-keys \
  -H "Cookie: next-auth.session-token=<session>" \
  -H "Content-Type: application/json" \
  -d '{"name": "my-agent", "scopes": ["read", "write"]}'
```

The response includes the full key **once** (it is stored only as a bcrypt hash):

```json
{
  "data": {
    "id": "uuid",
    "key": "skb_live_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
    "keyPrefix": "skb_live_a1b2c3",
    "name": "my-agent",
    "scopes": ["read", "write"],
    "created_at": "2026-01-15T10:00:00.000Z"
  }
}
```

> **Important:** Copy the `key` value immediately. It cannot be retrieved again.

### 2. Make Your First Request

```bash
curl https://kb.example.com/api/agent/pages \
  -H "Authorization: Bearer skb_live_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4"
```

### 3. Install a Client Library

**Python:**
```bash
cd examples/python
pip install -r requirements.txt
export SYMBIO_KB_URL=https://kb.example.com
export SYMBIO_KB_API_KEY=skb_live_...
python symbio_kb_client.py
```

**TypeScript:**
```bash
cd examples/typescript
npm install
export SYMBIO_KB_URL=https://kb.example.com
export SYMBIO_KB_API_KEY=skb_live_...
npm start
```

---

## Authentication

All Agent API requests require a `Bearer` token in the `Authorization` header:

```
Authorization: Bearer <token>
```

Two token types are supported:

| Type | Format | Description |
|------|--------|-------------|
| **API Key** | `skb_live_<32 hex chars>` | Generated in Settings. Tied to a user and tenant. |
| **Supabase JWT** | Standard JWT | Planned for EPIC-19. Pass the JWT directly as the bearer token. |

See the [Authentication Guide](./authentication.md) for full details on key management, scopes, and security best practices.

---

## Response Envelope

Every response follows a consistent JSON structure.

### Success (single item)

```json
{
  "data": { ... },
  "meta": {
    "timestamp": "2026-01-15T10:30:00.000Z"
  }
}
```

### Success (list with pagination)

```json
{
  "data": [ ... ],
  "meta": {
    "total": 142,
    "limit": 50,
    "offset": 0,
    "timestamp": "2026-01-15T10:30:00.000Z"
  }
}
```

### Error

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Page not found"
  },
  "meta": {
    "timestamp": "2026-01-15T10:30:00.000Z"
  }
}
```

---

## Endpoints

### List Pages

```
GET /api/agent/pages
```

Returns a paginated list of pages. Results are ordered by `updated_at` descending (most recently modified first).

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | 50 | Results per page (1-100) |
| `offset` | integer | 0 | Number of results to skip |
| `parent_id` | UUID | — | Filter to children of this page |
| `search` | string | — | Filter by title (case-insensitive contains) |

**Response:**

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Deployment Guide",
      "icon": "🚀",
      "parent_id": null,
      "created_at": "2026-01-10T08:00:00.000Z",
      "updated_at": "2026-01-15T10:30:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "limit": 50,
    "offset": 0,
    "timestamp": "2026-01-15T10:30:00.000Z"
  }
}
```

---

### Read Page

```
GET /api/agent/pages/:id
```

Returns a single page with its full markdown content. The server converts the internal TipTap document to markdown on the fly.

**Response:**

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Deployment Guide",
    "icon": "🚀",
    "parent_id": null,
    "markdown": "# Deployment Guide\n\nThis document covers...",
    "created_at": "2026-01-10T08:00:00.000Z",
    "updated_at": "2026-01-15T10:30:00.000Z"
  },
  "meta": {
    "timestamp": "2026-01-15T10:30:00.000Z"
  }
}
```

**Errors:**

| Status | Code | Description |
|--------|------|-------------|
| 404 | `NOT_FOUND` | Page does not exist or belongs to a different tenant |

---

### Create Page

```
POST /api/agent/pages
```

Creates a new page. If `markdown` is provided, it is converted to the internal TipTap document format and stored as a DOCUMENT block.

**Request body:**

```json
{
  "title": "New Page Title",
  "markdown": "# Heading\n\nSome content with a [[Wikilink]].",
  "parent_id": "optional-parent-uuid",
  "icon": "📄"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Page title (1-255 characters) |
| `markdown` | string | No | Initial markdown content |
| `parent_id` | UUID | No | Parent page for nesting |
| `icon` | string | No | Emoji or icon string |

**Response (201 Created):**

```json
{
  "data": {
    "id": "new-page-uuid",
    "title": "New Page Title",
    "created_at": "2026-01-15T11:00:00.000Z"
  },
  "meta": {
    "timestamp": "2026-01-15T11:00:00.000Z"
  }
}
```

**Errors:**

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_ERROR` | Missing or invalid fields |
| 404 | `NOT_FOUND` | Specified parent page does not exist |

---

### Update Page

```
PUT /api/agent/pages/:id
```

Replaces the entire markdown content of a page. The existing DOCUMENT block is overwritten (or created if none exists). The page's `updated_at` timestamp is refreshed.

**Request body:**

```json
{
  "markdown": "# Updated Heading\n\nNew content here."
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `markdown` | string | Yes | Complete replacement markdown |

**Response:**

```json
{
  "data": {
    "id": "page-uuid",
    "updated_at": "2026-01-15T11:05:00.000Z"
  },
  "meta": {
    "timestamp": "2026-01-15T11:05:00.000Z"
  }
}
```

**Errors:**

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_ERROR` | Missing markdown field |
| 404 | `NOT_FOUND` | Page does not exist |

---

### Search

```
GET /api/agent/search
```

Full-text search powered by PostgreSQL `websearch_to_tsquery`. Supports standard web-search syntax including quoted phrases and `OR` operators.

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `q` | string | — | **Required.** Search query (1-500 characters) |
| `limit` | integer | 20 | Results per page (1-100) |
| `offset` | integer | 0 | Number of results to skip |

**Response:**

```json
{
  "data": [
    {
      "page_id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Deployment Guide",
      "icon": "🚀",
      "snippet": "...configure the deployment pipeline using...",
      "score": 0.875
    }
  ],
  "meta": {
    "total": 12,
    "limit": 20,
    "offset": 0,
    "timestamp": "2026-01-15T10:30:00.000Z"
  }
}
```

The `snippet` field provides a context window around the matched text (approximately 150 characters). The `score` field is the PostgreSQL `ts_rank` relevance score.

---

### Knowledge Graph

```
GET /api/agent/graph
```

Returns the knowledge graph as nodes and edges. Supports both a global view (all pages) and a local view centered on a specific page using BFS expansion.

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `pageId` | UUID | — | Center page for local graph mode |
| `depth` | integer | 2 | BFS expansion depth from center page (1-5, only with `pageId`) |

**Response:**

```json
{
  "data": {
    "nodes": [
      {
        "id": "page-uuid-1",
        "label": "Deployment Guide",
        "icon": "🚀",
        "link_count": 5
      }
    ],
    "edges": [
      {
        "source": "page-uuid-1",
        "target": "page-uuid-2"
      }
    ]
  },
  "meta": {
    "node_count": 42,
    "edge_count": 67,
    "timestamp": "2026-01-15T10:30:00.000Z"
  }
}
```

---

## Error Handling

All errors use the standard envelope with an `error` object containing `code` and `message` fields.

### Error Codes Reference

| HTTP Status | Code | Description |
|-------------|------|-------------|
| 400 | `VALIDATION_ERROR` | Invalid request parameters or body |
| 401 | `UNAUTHORIZED` | Missing, empty, or invalid bearer token |
| 403 | `FORBIDDEN` | Token lacks the required scope for this operation |
| 404 | `NOT_FOUND` | Resource does not exist or belongs to another tenant |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests; respect `Retry-After` header |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

### Handling Errors in Code

**Python:**
```python
from symbio_kb_client import SymbioKB, NotFoundError, RateLimitError

kb = SymbioKB(base_url="...", api_key="...")

try:
    page = kb.read_page("nonexistent-uuid")
except NotFoundError:
    print("Page not found")
except RateLimitError as e:
    print(f"Rate limited. Retry after {e.retry_after}s")
```

**TypeScript:**
```typescript
import { SymbioKB, NotFoundError, RateLimitError } from "./symbio-kb-client.js";

const kb = new SymbioKB({ baseUrl: "...", apiKey: "..." });

try {
  const page = await kb.readPage("nonexistent-uuid");
} catch (err) {
  if (err instanceof NotFoundError) {
    console.log("Page not found");
  } else if (err instanceof RateLimitError) {
    console.log(`Rate limited. Retry after ${err.retryAfter}s`);
  }
}
```

---

## Rate Limiting

The Agent API enforces a sliding-window rate limit of **100 requests per minute** per API key (or per user for JWT auth).

### Rate Limit Headers

Every response includes these headers:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests allowed per window (100) |
| `X-RateLimit-Remaining` | Requests remaining in the current window |
| `X-RateLimit-Reset` | Unix timestamp (seconds) when the window resets |
| `Retry-After` | Seconds to wait before retrying (only on 429 responses) |

### Recommended Strategy

1. **Monitor** `X-RateLimit-Remaining` to proactively slow down before hitting the limit.
2. **On 429**, read the `Retry-After` header and sleep for that many seconds before retrying.
3. **Set a max retry count** (e.g. 3) to avoid infinite loops.
4. **Use exponential back-off** as a fallback if `Retry-After` is not present.

Both the Python and TypeScript client libraries implement this strategy automatically with a configurable `max_retries` / `maxRetries` parameter (default: 3).

---

## Markdown Format

The Agent API uses **standard CommonMark markdown** with one extension: **wikilinks**.

### Supported Syntax

- Headings (`#`, `##`, `###`, etc.)
- Paragraphs and line breaks
- Bold (`**text**`), italic (`*text*`), code (`` `code` ``)
- Bullet lists (`-` or `*`) and ordered lists (`1.`)
- Code blocks (triple backticks with optional language)
- Links (`[text](url)`) and images (`![alt](url)`)
- Blockquotes (`>`)
- Horizontal rules (`---`)
- Tables (GFM pipe tables)

### Wikilinks

Link between pages using double-bracket syntax:

```markdown
See the [[Deployment Guide]] for more details.
```

Wikilinks are resolved by page title and create edges in the knowledge graph. They are bidirectional: if Page A links to Page B, both the forward link and the backlink are tracked.

### Content Model

When you **create** or **update** a page, the markdown is converted server-side to the internal TipTap/ProseMirror JSON document format and stored as a `DOCUMENT` block. When you **read** a page, the reverse conversion happens and you receive clean markdown.

This means you never need to interact with the internal document format directly. The Agent API is a pure markdown interface.

---

## Pagination

All list endpoints support `limit` and `offset` query parameters. The response `meta` object includes `total`, `limit`, and `offset` so you can compute the number of pages and build pagination controls.

### Example: Iterating All Pages

**Python:**
```python
offset = 0
limit = 100
while True:
    result = kb.list_pages(limit=limit, offset=offset)
    for page in result.pages:
        process(page)
    if offset + limit >= result.total:
        break
    offset += limit
```

**TypeScript:**
```typescript
let offset = 0;
const limit = 100;
while (true) {
  const result = await kb.listPages({ limit, offset });
  for (const page of result.pages) {
    process(page);
  }
  if (offset + limit >= result.total) break;
  offset += limit;
}
```
