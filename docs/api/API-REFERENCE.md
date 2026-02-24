# API Reference

SymbioKnowledgeBase REST API documentation.

## Base URL
```
http://localhost:3000/api
```

## Authentication
All API requests require authentication via session cookie or API key.

```http
Authorization: Bearer <api_key>
```

---

## Pages

### List Pages
```http
GET /api/pages
```

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `parentId` | string | Filter by parent page |
| `limit` | number | Max results (default: 50) |
| `offset` | number | Pagination offset |

**Response:**
```json
{
  "data": [
    {
      "id": "abc123",
      "title": "Meeting Notes",
      "parentId": null,
      "createdAt": "2026-02-24T10:00:00Z",
      "updatedAt": "2026-02-24T15:30:00Z"
    }
  ],
  "total": 42
}
```

### Get Page
```http
GET /api/pages/:id
```

**Response:**
```json
{
  "id": "abc123",
  "title": "Meeting Notes",
  "content": { "type": "doc", "content": [...] },
  "parentId": null,
  "createdAt": "2026-02-24T10:00:00Z",
  "updatedAt": "2026-02-24T15:30:00Z"
}
```

### Create Page
```http
POST /api/pages
```

**Request Body:**
```json
{
  "title": "New Page",
  "parentId": "parent-id-or-null",
  "content": { "type": "doc", "content": [] }
}
```

**Response:** Created page object

### Update Page
```http
PATCH /api/pages/:id
```

**Request Body:**
```json
{
  "title": "Updated Title",
  "content": { "type": "doc", "content": [...] }
}
```

### Delete Page
```http
DELETE /api/pages/:id
```

**Response:**
```json
{
  "success": true
}
```

### Reorder/Move Page
```http
PUT /api/pages/:id/reorder
```

**Request Body:**
```json
{
  "parentId": "new-parent-id",
  "position": 2
}
```

---

## Search

### Global Search
```http
GET /api/search
```

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Search query (required) |
| `limit` | number | Max results (default: 20) |

**Response:**
```json
{
  "data": [
    {
      "id": "abc123",
      "title": "Meeting Notes",
      "snippet": "...discussed the **project** timeline...",
      "path": ["Workspace", "Meetings"],
      "updatedAt": "2026-02-24T15:30:00Z"
    }
  ]
}
```

---

## Graph

### Get Full Graph
```http
GET /api/graph
```

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `pageId` | string | Center on specific page |
| `depth` | number | Link depth (default: all) |

**Response:**
```json
{
  "data": {
    "nodes": [
      {
        "id": "abc123",
        "label": "Meeting Notes",
        "x": 100,
        "y": 200
      }
    ],
    "edges": [
      {
        "source": "abc123",
        "target": "def456",
        "label": "links to"
      }
    ]
  }
}
```

### Get Local Graph
```http
GET /api/graph?pageId=abc123&depth=1
```

Returns nodes and edges connected to the specified page.

---

## AI Chat

### Send Message (Streaming)
```http
POST /api/ai/chat
```

**Request Body:**
```json
{
  "messages": [
    { "role": "user", "content": "Explain this page" }
  ],
  "context": "Currently viewing: Meeting Notes",
  "model": "gpt-4o-mini"
}
```

**Response:** Server-Sent Events stream
```
data: {"content":"This"}
data: {"content":" page"}
data: {"content":" contains"}
data: [DONE]
```

**Supported Models:**
- `gpt-4o` (default)
- `gpt-4o-mini`
- `gpt-4-turbo`
- `gpt-3.5-turbo`

---

## Settings

### Get Profile
```http
GET /api/settings/profile
```

**Response:**
```json
{
  "id": "user123",
  "name": "Martin",
  "email": "martin@example.com",
  "avatarUrl": null
}
```

### Update Profile
```http
PATCH /api/settings/profile
```

**Request Body:**
```json
{
  "name": "Martin P.",
  "avatarUrl": "data:image/png;base64,..."
}
```

### Change Password
```http
POST /api/settings/password
```

**Request Body:**
```json
{
  "currentPassword": "old-password",
  "newPassword": "new-password"
}
```

---

## API Keys

### List API Keys
```http
GET /api/api-keys
```

**Response:**
```json
{
  "data": [
    {
      "id": "key123",
      "name": "Integration Key",
      "prefix": "sk-...abc",
      "createdAt": "2026-02-24T10:00:00Z",
      "lastUsedAt": "2026-02-24T15:30:00Z"
    }
  ]
}
```

### Create API Key
```http
POST /api/api-keys
```

**Request Body:**
```json
{
  "name": "My Integration"
}
```

**Response:**
```json
{
  "id": "key123",
  "name": "My Integration",
  "key": "sk-full-key-only-shown-once"
}
```

### Delete API Key
```http
DELETE /api/api-keys/:id
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Page not found"
  }
}
```

**Common Error Codes:**
| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid auth |
| `FORBIDDEN` | 403 | No permission |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| General API | 100 req/min |
| AI Chat | 30 req/min |
| Search | 60 req/min |

Rate limit headers:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1708808400
```

---

## Webhooks (Coming Soon)

Future webhook events:
- `page.created`
- `page.updated`
- `page.deleted`
- `comment.created`
