# Story SKB-10.1: OpenAPI Specification and Swagger UI

**Epic:** Epic 10 - Documentation & Deployment
**Story ID:** SKB-10.1
**Story Points:** 3 | **Priority:** High | **Status:** Draft
**Depends On:** All API epics (SKB-03.x, SKB-05.x, SKB-06.x, SKB-07.x, SKB-08.x)

---

## User Story

As an AI agent developer, I want machine-readable API documentation, So that I can discover and integrate with SymbioKnowledgeBase endpoints programmatically.

---

## Acceptance Criteria

- [ ] `docs/api/openapi.yaml`: complete OpenAPI 3.0 specification for all endpoints
- [ ] Swagger UI served at `/api/docs` route using `swagger-ui-react` or `next-swagger-doc`
- [ ] Spec includes all REST endpoints:
  - Pages: CRUD, backlinks, forward links
  - Blocks: CRUD
  - Search: full-text search
  - Graph: global and local graph data
  - Databases: CRUD, rows CRUD
  - Auth: login, register, session
  - Health: health check
- [ ] Request/response schemas fully defined (matching Zod schemas)
- [ ] Error response format documented (standard envelope)
- [ ] Authentication requirements documented (session cookie)
- [ ] Pagination parameters documented (limit, offset)
- [ ] API versioning noted (v1 implicit, no prefix for MVP)
- [ ] TypeScript strict mode — no `any` types in the Swagger page

---

## Architecture Overview

```
OpenAPI Documentation Architecture
────────────────────────────────────

  docs/api/openapi.yaml
  ┌──────────────────────────────────────────────────────┐
  │  openapi: 3.0.3                                       │
  │  info:                                                 │
  │    title: SymbioKnowledgeBase API                      │
  │    version: 1.0.0                                      │
  │                                                        │
  │  paths:                                                │
  │    /api/pages:                                         │
  │      get: ...                                          │
  │      post: ...                                         │
  │    /api/pages/{id}:                                    │
  │      get: ... put: ... delete: ...                     │
  │    /api/pages/{id}/backlinks:                          │
  │      get: ...                                          │
  │    /api/search:                                        │
  │      get: ...                                          │
  │    /api/graph:                                         │
  │      get: ...                                          │
  │    /api/databases:                                     │
  │      get: ... post: ...                                │
  │    ...                                                 │
  │                                                        │
  │  components:                                           │
  │    schemas:                                            │
  │      Page, Block, SearchResult, GraphData,             │
  │      Database, DbRow, Error                            │
  │    securitySchemes:                                    │
  │      sessionCookie: ...                                │
  └──────────────────────────────────────────────────────┘
        │
        ▼ served by
  ┌──────────────────────────────────────────────────────┐
  │  /api/docs (Next.js page)                             │
  │                                                        │
  │  ┌────────────────────────────────────────────────┐   │
  │  │  Swagger UI                                     │   │
  │  │                                                 │   │
  │  │  GET /api/pages                                 │   │
  │  │    Parameters: search, limit, offset            │   │
  │  │    Response: 200 { data: Page[], meta }         │   │
  │  │                                                 │   │
  │  │  POST /api/pages                                │   │
  │  │    Body: { title, icon? }                       │   │
  │  │    Response: 201 { data: Page }                 │   │
  │  │                                                 │   │
  │  │  [Try it out] button for each endpoint          │   │
  │  └────────────────────────────────────────────────┘   │
  └──────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Create the OpenAPI Specification

**File: `docs/api/openapi.yaml`**

```yaml
openapi: 3.0.3
info:
  title: SymbioKnowledgeBase API
  description: |
    REST API for SymbioKnowledgeBase, a self-hosted AI-agent-first knowledge management platform.

    All endpoints require authentication via session cookie (NextAuth).
    All data is scoped by tenant_id — users can only access data within their tenant.

    Standard response envelope:
    - Success: `{ data: T, meta: { timestamp, ... } }`
    - Error: `{ error: { code, message, details? }, meta: { timestamp } }`
  version: 1.0.0
  contact:
    name: SymbioKnowledgeBase
  license:
    name: MIT

servers:
  - url: http://localhost:3000
    description: Development server

security:
  - sessionCookie: []

paths:
  /api/pages:
    get:
      summary: List pages
      tags: [Pages]
      parameters:
        - name: search
          in: query
          schema: { type: string }
          description: Filter pages by title (case-insensitive contains)
        - name: limit
          in: query
          schema: { type: integer, default: 50, maximum: 100 }
        - name: offset
          in: query
          schema: { type: integer, default: 0 }
      responses:
        '200':
          description: List of pages
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items: { $ref: '#/components/schemas/Page' }
                  meta:
                    $ref: '#/components/schemas/PaginationMeta'
    post:
      summary: Create a page
      tags: [Pages]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [title]
              properties:
                title: { type: string, minLength: 1 }
                icon: { type: string, nullable: true }
                parent_id: { type: string, format: uuid, nullable: true }
      responses:
        '201':
          description: Page created
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/Page' }
                  meta: { $ref: '#/components/schemas/TimestampMeta' }

  /api/pages/{id}:
    parameters:
      - name: id
        in: path
        required: true
        schema: { type: string, format: uuid }
    get:
      summary: Get a page
      tags: [Pages]
      responses:
        '200':
          description: Page details
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { $ref: '#/components/schemas/Page' }
                  meta: { $ref: '#/components/schemas/TimestampMeta' }
        '404':
          $ref: '#/components/responses/NotFound'
    put:
      summary: Update a page
      tags: [Pages]
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                title: { type: string }
                icon: { type: string, nullable: true }
      responses:
        '200':
          description: Page updated
    delete:
      summary: Delete a page
      tags: [Pages]
      responses:
        '200':
          description: Page deleted

  /api/pages/{id}/backlinks:
    parameters:
      - name: id
        in: path
        required: true
        schema: { type: string, format: uuid }
    get:
      summary: Get backlinks for a page
      tags: [Pages, Wikilinks]
      responses:
        '200':
          description: Pages linking to this page
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items: { $ref: '#/components/schemas/BacklinkResult' }
                  meta: { $ref: '#/components/schemas/CountMeta' }

  /api/search:
    get:
      summary: Full-text search
      tags: [Search]
      parameters:
        - name: q
          in: query
          required: true
          schema: { type: string, minLength: 1, maxLength: 500 }
        - name: limit
          in: query
          schema: { type: integer, default: 20, maximum: 100 }
        - name: offset
          in: query
          schema: { type: integer, default: 0 }
      responses:
        '200':
          description: Search results with snippets
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items: { $ref: '#/components/schemas/SearchResult' }
                  meta: { $ref: '#/components/schemas/PaginationMeta' }

  /api/graph:
    get:
      summary: Get knowledge graph data
      tags: [Graph]
      parameters:
        - name: pageId
          in: query
          schema: { type: string, format: uuid }
          description: Center page for local graph mode
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

  /api/databases:
    get:
      summary: List databases
      tags: [Databases]
      responses:
        '200':
          description: List of databases
    post:
      summary: Create a database
      tags: [Databases]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [pageId, schema]
              properties:
                pageId: { type: string, format: uuid }
                schema: { $ref: '#/components/schemas/DatabaseSchema' }
      responses:
        '201':
          description: Database created

  /api/databases/{id}/rows:
    parameters:
      - name: id
        in: path
        required: true
        schema: { type: string, format: uuid }
    get:
      summary: List database rows
      tags: [Databases]
      responses:
        '200':
          description: List of rows
    post:
      summary: Create a database row
      tags: [Databases]
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [properties]
              properties:
                properties: { $ref: '#/components/schemas/RowProperties' }
      responses:
        '201':
          description: Row created (page also created)

  /api/health:
    get:
      summary: Health check
      tags: [System]
      security: []
      responses:
        '200':
          description: Service is healthy
          content:
            application/json:
              schema:
                type: object
                properties:
                  status: { type: string, example: ok }
                  version: { type: string }
                  uptime: { type: number }

components:
  schemas:
    Page:
      type: object
      properties:
        id: { type: string, format: uuid }
        title: { type: string }
        icon: { type: string, nullable: true }
        parent_id: { type: string, format: uuid, nullable: true }
        created_at: { type: string, format: date-time }
        updated_at: { type: string, format: date-time }

    BacklinkResult:
      type: object
      properties:
        pageId: { type: string, format: uuid }
        pageTitle: { type: string }
        pageIcon: { type: string, nullable: true }

    SearchResult:
      type: object
      properties:
        pageId: { type: string, format: uuid }
        pageTitle: { type: string }
        pageIcon: { type: string, nullable: true }
        snippet: { type: string }
        score: { type: number }

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
              linkCount: { type: integer }
              updatedAt: { type: string, format: date-time }
        edges:
          type: array
          items:
            type: object
            properties:
              source: { type: string }
              target: { type: string }

    GraphMeta:
      type: object
      properties:
        nodeCount: { type: integer }
        edgeCount: { type: integer }
        timestamp: { type: string, format: date-time }

    DatabaseSchema:
      type: object
      properties:
        columns:
          type: array
          items:
            type: object
            properties:
              id: { type: string }
              name: { type: string }
              type: { type: string, enum: [TITLE, TEXT, NUMBER, SELECT, MULTI_SELECT, DATE, CHECKBOX, URL] }
              options: { type: array, items: { type: string } }

    RowProperties:
      type: object
      additionalProperties:
        type: object
        properties:
          type: { type: string }
          value: {}

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

    CountMeta:
      type: object
      properties:
        total: { type: integer }
        timestamp: { type: string, format: date-time }

    ApiError:
      type: object
      properties:
        error:
          type: object
          properties:
            code: { type: string }
            message: { type: string }
            details: { type: array, items: {} }
        meta:
          $ref: '#/components/schemas/TimestampMeta'

  responses:
    NotFound:
      description: Resource not found
      content:
        application/json:
          schema: { $ref: '#/components/schemas/ApiError' }

  securitySchemes:
    sessionCookie:
      type: apiKey
      in: cookie
      name: next-auth.session-token
      description: NextAuth session cookie
```

---

### Step 2: Create the Swagger UI Page

**File: `src/app/api/docs/page.tsx`**

```typescript
'use client';

import dynamic from 'next/dynamic';
import 'swagger-ui-react/swagger-ui.css';

const SwaggerUI = dynamic(
  () => import('swagger-ui-react'),
  { ssr: false }
);

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-white">
      <SwaggerUI url="/api/openapi.yaml" />
    </div>
  );
}
```

**File: `src/app/api/openapi.yaml/route.ts`** (serve the YAML file)

```typescript
import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET() {
  const filePath = join(process.cwd(), 'docs', 'api', 'openapi.yaml');
  const content = readFileSync(filePath, 'utf-8');

  return new NextResponse(content, {
    headers: { 'Content-Type': 'text/yaml' },
  });
}
```

---

## Testing Requirements

### Manual Verification

```bash
# 1. Navigate to /api/docs — Swagger UI should render
# 2. All endpoints should be listed with descriptions
# 3. Request/response schemas should be expandable
# 4. "Try it out" should work for authenticated endpoints
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `docs/api/openapi.yaml` |
| CREATE | `src/app/api/docs/page.tsx` |
| CREATE | `src/app/api/openapi.yaml/route.ts` |

---

**Last Updated:** 2026-02-21
