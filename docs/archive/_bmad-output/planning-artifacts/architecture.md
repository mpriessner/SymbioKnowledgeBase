---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - product-brief-SymbioKnowledgeBase-2026-02-21.md
  - prd.md
workflowType: architecture
project_name: SymbioKnowledgeBase
user_name: Martin
date: '2026-02-21'
lastStep: 8
status: complete
completedAt: '2026-02-21'
---

# Architecture Decision Document — SymbioKnowledgeBase

_This document captures all architectural decisions for SymbioKnowledgeBase, a self-hosted knowledge management platform combining Notion-style block editing with Obsidian-style knowledge graphing, designed for AI-agent-first usage._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**

54 functional requirements organized into 8 capability areas:

| Category | FRs | Architectural Impact |
|----------|-----|---------------------|
| Page Management | FR1–FR7 | Hierarchical data model, tree traversal, cascade operations |
| Block Editor | FR8–FR14 | Rich client-side editor, JSONB block storage, undo/redo state |
| Wikilinks & Backlinks | FR15–FR19 | Link resolution engine, reverse index, rename propagation |
| Search & Navigation | FR20–FR24 | PostgreSQL FTS with tsvector, real-time search-as-you-type |
| Knowledge Graph | FR25–FR29 | Graph data extraction from links, force-directed rendering |
| REST API for AI Agents | FR30–FR40 | API-first architecture, OpenAPI spec, consistent JSON responses |
| Database (Table View) | FR41–FR46 | Typed property system, JSONB property storage, inline editing |
| User Management & Multi-Tenancy | FR47–FR51 | Tenant isolation at query layer, dual auth (session + API key) |
| Theming & UI | FR52–FR54 | CSS custom properties, theme persistence, Notion-inspired design |

**Non-Functional Requirements:**

22 NFRs driving architectural decisions:

- **Performance (NFR1–5):** < 1s TTI, < 200ms API response, < 2s search, 30+ FPS graph, < 50ms editor latency
- **Security (NFR6–11):** HTTPS/TLS 1.2+, bcrypt passwords, hashed API keys, tenant isolation at DB layer, input sanitization
- **Scalability (NFR12–14):** 10→50+ concurrent users, 100K+ blocks per tenant, horizontally scalable API layer
- **Reliability (NFR15–17):** 95%→99.5% uptime, transactional DB operations, Docker restart recovery
- **Accessibility (NFR18–19):** Keyboard navigation, WCAG 2.1 Level A
- **Integration (NFR20–22):** OpenAPI 3.0, ISO 8601 timestamps, extensible JSONB block schema

**Scale & Complexity:**

- Primary domain: Full-stack web application (SSR + REST API)
- Complexity level: Medium — multi-tenant with graph features, no regulatory compliance
- Estimated architectural components: 12 (auth, pages, blocks, links, search, graph, database, API, editor, sidebar, theme, deployment)

### Technical Constraints & Dependencies

- Single-developer team → must use full-stack TypeScript for maximum velocity
- Self-hosted deployment → Docker Compose on single Linux server
- AI-agent-first → every UI feature must have a corresponding API endpoint
- Open-source → no proprietary dependencies, MIT/Apache-compatible licenses only
- Scientific domain → data integrity and reproducibility over eventual consistency

### Cross-Cutting Concerns Identified

1. **Multi-tenant isolation** — affects every database query, API endpoint, and middleware
2. **Dual authentication** — session-based for web UI, API key for AI agents; both resolve to tenant ID
3. **Wikilink resolution** — impacts page creation, editing, renaming, deletion, search, and graph
4. **Block content schema** — JSONB structure shared across editor, API, search indexing, and graph extraction
5. **Error handling** — consistent patterns across API responses, editor state, and background operations

## Starter Template Evaluation

### Primary Technology Domain

Full-stack web application with REST API, identified from project requirements: Next.js for SSR frontend + API routes, PostgreSQL for data persistence, Docker Compose for deployment.

### Starter Options Considered

| Option | Pros | Cons | Fit |
|--------|------|------|-----|
| `create-next-app` (Next.js 16) | Official, minimal, latest features, Turbopack | Requires manual addition of DB, auth, API | Best — maximum control |
| T3 Stack (`create-t3-app`) | Prisma + NextAuth + tRPC bundled | tRPC not needed (REST API required), opinionated | Partial fit |
| RedwoodJS | Full-stack, GraphQL, Prisma | GraphQL not REST, different routing model | Poor fit |
| Blitz.js | Full-stack Next.js fork | Less maintained, smaller community | Poor fit |

### Selected Starter: `create-next-app` (Next.js 16)

**Rationale for Selection:**

SymbioKnowledgeBase needs a REST API (not tRPC/GraphQL) for AI agent compatibility. The project requires fine-grained control over the API layer (Fastify) and editor integration (TipTap). `create-next-app` provides the cleanest foundation without opinionated additions that would need to be removed.

**Initialization Command:**

```bash
npx create-next-app@latest symbio-knowledge-base \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --turbopack \
  --import-alias "@/*"
```

**Architectural Decisions Provided by Starter:**

- **Language & Runtime:** TypeScript 5.9, Node.js 22 LTS
- **Styling Solution:** Tailwind CSS 4.2 with PostCSS
- **Build Tooling:** Turbopack (dev), Webpack (production) via Next.js 16
- **Code Organization:** App Router with `src/` directory
- **Development Experience:** Hot reload via Turbopack, TypeScript strict mode

**Note:** Project initialization using this command should be the first implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
1. Database engine and schema design (PostgreSQL + JSONB)
2. Authentication architecture (NextAuth.js v4 + API keys)
3. API design (Next.js API Routes with Fastify-style patterns)
4. Block editor selection (TipTap 3)
5. ORM selection (Prisma 7)

**Important Decisions (Shape Architecture):**
6. Graph visualization library (react-force-graph)
7. Search implementation (PostgreSQL FTS)
8. State management approach (React Server Components + TanStack Query)
9. Deployment architecture (Docker Compose multi-container)

**Deferred Decisions (Post-MVP):**
- Semantic search engine (Meilisearch or pgvector)
- Real-time collaboration (WebSocket provider)
- Mobile strategy (PWA vs native)
- Plugin architecture

### Data Architecture

**Database: PostgreSQL 18**

- **Rationale:** Mature RDBMS with JSONB for flexible block content, full-text search via tsvector, pgvector-ready for future semantic search, strong multi-tenant isolation via row-level filtering
- **Version:** PostgreSQL 18.2 (latest stable, Feb 2026)

**ORM: Prisma 7**

- **Rationale:** Type-safe database access with auto-generated TypeScript types, migration management, query builder that supports raw SQL for FTS and complex queries
- **Version:** Prisma 7.4.1 (latest stable)
- **Key Configuration:** `jsonb` fields for block content and database properties; composite indexes on `(tenant_id, id)` for all tables

**Data Model (Core Entities):**

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   tenants    │────<│    pages      │────<│    blocks     │
│              │     │              │     │              │
│ id (UUID)    │     │ id (UUID)    │     │ id (UUID)    │
│ name         │     │ tenant_id    │     │ page_id      │
│ created_at   │     │ parent_id    │     │ tenant_id    │
└─────────────┘     │ title        │     │ type         │
       │            │ icon         │     │ content (JSONB)│
       │            │ cover_url    │     │ position     │
       ▼            │ created_at   │     │ created_at   │
┌─────────────┐     │ updated_at   │     │ updated_at   │
│    users     │     └──────────────┘     └──────────────┘
│              │            │
│ id (UUID)    │            │
│ tenant_id    │     ┌──────────────┐
│ email        │     │  page_links  │
│ password_hash│     │              │
│ role         │     │ source_page  │
│ created_at   │     │ target_page  │
└─────────────┘     │ tenant_id    │
       │            └──────────────┘
       ▼
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  api_keys    │     │  databases   │     │  db_rows     │
│              │     │              │     │              │
│ id (UUID)    │     │ id (UUID)    │     │ id (UUID)    │
│ user_id      │     │ page_id      │     │ database_id  │
│ tenant_id    │     │ tenant_id    │     │ page_id      │
│ key_hash     │     │ schema (JSONB)│    │ tenant_id    │
│ name         │     │ created_at   │     │ properties   │
│ created_at   │     └──────────────┘     │   (JSONB)    │
│ revoked_at   │                          └──────────────┘
└─────────────┘
```

**Data Modeling Approach:**

- JSONB for block content — stores the full block tree per block as `{ type, content, marks, attrs }`
- JSONB for database properties — stores typed values as `{ type: "number", value: 42 }` for type safety at application level
- `page_links` table maintained as a materialized link index, updated on block save, used for backlinks and graph queries
- All tables include `tenant_id` with composite indexes for query-layer tenant isolation

**Migration Strategy:**

- Prisma Migrate for schema versioning
- Migrations run automatically on Docker container startup via entrypoint script
- Seed script for initial admin user and welcome page content

**Caching Strategy (MVP):**

- No application-level cache in MVP — PostgreSQL handles caching via shared_buffers
- HTTP cache headers for static assets (Next.js built-in)
- Client-side caching via TanStack Query with stale-while-revalidate pattern

### Authentication & Security

**Web UI Authentication: NextAuth.js v4 (stable)**

- **Rationale:** Battle-tested, works natively with Next.js App Router, supports credential-based auth (email/password) for self-hosted deployment
- **Version:** NextAuth.js 4.24.13 (latest stable on npm)
- **Session Strategy:** JWT stored in HTTP-only cookie, 24-hour expiration on inactivity
- **Why not Auth.js v5:** Still in beta/RC, not production-stable; v4 is proven and sufficient for MVP

**AI Agent Authentication: API Key**

- **Implementation:** Cryptographically random 256-bit tokens (generated via `crypto.randomBytes(32)`)
- **Storage:** SHA-256 hash stored in `api_keys` table; raw key shown to user once on creation
- **Resolution:** API key middleware extracts key from `Authorization: Bearer <key>` header, looks up hash, resolves to `tenant_id`
- **Revocation:** Soft delete via `revoked_at` timestamp; revoked keys return 401

**Auth Flow (Unified Tenant Resolution):**

```
Web UI Request                    API Request
      │                                │
  NextAuth.js                    API Key Middleware
  JWT Cookie                     Bearer Token
      │                                │
      ▼                                ▼
  Extract user_id              Hash key, lookup api_keys
      │                                │
      ▼                                ▼
  Resolve tenant_id            Resolve tenant_id
      │                                │
      └──────────┬─────────────────────┘
                 ▼
         Attach tenant_id to request context
                 │
                 ▼
         All DB queries filter by tenant_id
```

**Authorization Pattern:**

- Simple role-based: `admin` and `user` roles
- Admin: can manage users, view system health
- User: full CRUD within own tenant
- All authorization enforced at API middleware layer before handlers

**Security Middleware Stack:**

1. Rate limiting: 100 req/min per IP for API, 200 req/min for web UI
2. CORS: Restrict to deployment origin
3. Helmet: Security headers (CSP, HSTS, X-Frame-Options)
4. Input sanitization: DOMPurify for HTML content in blocks, parameterized queries via Prisma

### API & Communication Patterns

**API Design: REST via Next.js API Routes**

- **Rationale:** Next.js API routes provide the simplest deployment model (single container for frontend + API). REST is required for AI agent compatibility (every LLM can make HTTP requests). No need for a separate Fastify server in MVP.
- **Architecture Decision:** Use Next.js Route Handlers (`app/api/`) instead of a separate Fastify backend. This simplifies deployment from 3 containers to 2 (Next.js + PostgreSQL). Fastify-style patterns (request validation, error handling) are implemented within Route Handlers.

**API Route Structure:**

```
/api/auth/[...nextauth]    — NextAuth.js authentication
/api/pages                 — GET (list), POST (create)
/api/pages/[id]            — GET, PUT, DELETE
/api/pages/[id]/backlinks  — GET backlinks for page
/api/blocks                — POST (create block)
/api/blocks/[id]           — GET, PUT, DELETE
/api/search                — GET ?q=term&limit=20&offset=0
/api/graph                 — GET graph data (nodes + edges)
/api/databases             — GET (list), POST (create)
/api/databases/[id]        — GET, PUT, DELETE
/api/databases/[id]/rows   — GET (list), POST (create)
/api/databases/[id]/rows/[rowId] — GET, PUT, DELETE
/api/users                 — Admin: GET (list), POST (create)
/api/users/[id]            — Admin: GET, PUT, DELETE
/api/keys                  — GET (list user's keys), POST (create)
/api/keys/[id]             — DELETE (revoke)
/api/docs                  — Swagger UI (OpenAPI 3.0)
```

**API Response Format (Standard Envelope):**

```json
// Success (single item)
{
  "data": { ... },
  "meta": { "timestamp": "2026-02-21T10:00:00Z" }
}

// Success (list)
{
  "data": [ ... ],
  "meta": {
    "total": 142,
    "limit": 20,
    "offset": 0,
    "timestamp": "2026-02-21T10:00:00Z"
  }
}

// Error
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Title is required",
    "details": [{ "field": "title", "message": "Must not be empty" }]
  },
  "meta": { "timestamp": "2026-02-21T10:00:00Z" }
}
```

**Error Handling Standards:**

| HTTP Status | Error Code | Usage |
|------------|------------|-------|
| 400 | VALIDATION_ERROR | Invalid request body or query params |
| 401 | UNAUTHORIZED | Missing or invalid auth credentials |
| 403 | FORBIDDEN | Valid auth but insufficient permissions |
| 404 | NOT_FOUND | Resource does not exist or belongs to different tenant |
| 409 | CONFLICT | Duplicate resource (e.g., duplicate page title) |
| 422 | UNPROCESSABLE | Valid syntax but semantic error |
| 429 | RATE_LIMITED | Too many requests |
| 500 | INTERNAL_ERROR | Unexpected server error |

**API Documentation:**

- OpenAPI 3.0 spec generated from route definitions using `next-swagger-doc`
- Swagger UI served at `/api/docs`
- API spec file committed to repo as `docs/api/openapi.yaml`

### Frontend Architecture

**Block Editor: TipTap 3**

- **Rationale:** TipTap 3 is the mature, extensible choice. It provides a headless editor framework that gives full control over rendering and behavior. BlockNote (0.46.2) is still pre-1.0 with breaking changes expected. TipTap 3's extension system maps directly to SymbioKnowledgeBase's block type requirements.
- **Version:** TipTap 3.20.0
- **Key Extensions:** StarterKit, Placeholder, CodeBlockLowlight, TaskList, Image, Link, Table (for database rows)
- **Custom Extensions:** WikilinkExtension (custom — handles `[[` trigger, autocomplete, link resolution), CalloutExtension (custom block type), BookmarkExtension (URL preview block)

**State Management: React Server Components + TanStack Query**

- **Server Components:** Used for initial page loads (page content, sidebar tree, search index)
- **Client Components:** Used for interactive features (editor, graph, search-as-you-type)
- **TanStack Query v5:** Client-side data fetching, caching, and synchronization for interactive components
- **No global state store:** Page content is managed by TipTap editor state; list/tree data managed by TanStack Query cache; theme stored in localStorage + CSS custom properties

**Routing Strategy:**

- Next.js App Router with file-based routing
- Dynamic routes: `/pages/[id]`, `/databases/[id]`, `/graph`
- Parallel routes: sidebar (persistent) + main content (changes per navigation)
- Intercepting routes: quick switcher overlay (Cmd+K)

**Graph Visualization: react-force-graph (2D)**

- **Rationale:** Lightweight wrapper around D3-force with React integration. Supports WebGL rendering for performance with 1,000+ nodes. Simpler API than raw D3.js.
- **Version:** react-force-graph 1.48.2
- **Configuration:** 2D mode for MVP, WebGL renderer for performance, click-to-navigate node interaction

**Component Architecture:**

```
src/components/
├── editor/         — TipTap editor, block renderers, slash menu
├── graph/          — Force graph, node renderers, graph controls
├── layout/         — Sidebar, breadcrumbs, top bar, theme toggle
├── pages/          — Page view, page header, backlinks panel
├── database/       — Table view, property editors, filters
├── search/         — Search dialog, quick switcher, result cards
├── ui/             — Shared primitives (button, input, modal, dropdown)
└── auth/           — Login form, register form, API key manager
```

### Infrastructure & Deployment

**Deployment: Docker Compose (2 containers)**

```yaml
services:
  app:
    build: .
    ports: ["3000:3000"]
    environment:
      DATABASE_URL: postgresql://...
      NEXTAUTH_SECRET: ...
      NEXTAUTH_URL: http://localhost:3000
    depends_on: [db]
    restart: unless-stopped

  db:
    image: postgres:18
    volumes: ["pgdata:/var/lib/postgresql/data"]
    environment:
      POSTGRES_DB: symbio
      POSTGRES_USER: symbio
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    restart: unless-stopped

volumes:
  pgdata:
```

**Why 2 containers instead of 3:**

The product brief suggested separate frontend and API containers. However, Next.js API Routes eliminate the need for a separate Fastify backend. This reduces operational complexity and simplifies the deployment model without sacrificing functionality. All API endpoints run within the Next.js process.

**Environment Configuration:**

- `.env.local` for development (gitignored)
- `.env.example` committed with placeholder values
- Docker Compose uses `${VAR}` interpolation from `.env` file
- Required env vars: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`

**CI/CD (Future — not MVP):**

- GitHub Actions for CI (lint, type-check, test)
- Docker image build and push on main branch merge
- Deployment via `docker compose pull && docker compose up -d`

**Monitoring (MVP):**

- Docker container health checks
- Next.js built-in request logging
- PostgreSQL `pg_stat_statements` for slow query detection

### Decision Impact Analysis

**Implementation Sequence:**

1. Project initialization (create-next-app + Prisma + PostgreSQL Docker)
2. Database schema and migrations (core tables)
3. Authentication (NextAuth.js + API key middleware)
4. Page CRUD API endpoints
5. Block CRUD API endpoints + JSONB schema
6. TipTap editor integration
7. Wikilink system (extension + link index + backlinks)
8. Search (PostgreSQL FTS + quick switcher)
9. Knowledge graph (react-force-graph + graph data endpoint)
10. Database feature (typed properties + table view)
11. Theming (light/dark mode)
12. Docker Compose production deployment

**Cross-Component Dependencies:**

- Auth → All API endpoints depend on tenant resolution middleware
- Pages → Blocks, Links, Search, Graph all depend on page entity
- Blocks → Editor, Search indexing, Link extraction depend on block content schema
- Links → Graph, Backlinks depend on page_links index table
- Search → Depends on tsvector index maintained on block content changes

## Implementation Patterns & Consistency Rules

### Naming Patterns

**Database Naming Conventions:**

| Element | Convention | Example |
|---------|-----------|---------|
| Tables | snake_case, plural | `pages`, `api_keys`, `page_links` |
| Columns | snake_case | `tenant_id`, `created_at`, `parent_id` |
| Primary keys | `id` (UUID) | `id UUID DEFAULT gen_random_uuid()` |
| Foreign keys | `{referenced_table_singular}_id` | `page_id`, `user_id`, `tenant_id` |
| Indexes | `idx_{table}_{columns}` | `idx_pages_tenant_id`, `idx_blocks_page_id` |
| Unique constraints | `uq_{table}_{columns}` | `uq_users_email_tenant_id` |

**API Naming Conventions:**

| Element | Convention | Example |
|---------|-----------|---------|
| Endpoints | kebab-case, plural nouns | `/api/pages`, `/api/api-keys` |
| Route params | camelCase | `/api/pages/[pageId]` |
| Query params | camelCase | `?sortBy=createdAt&limit=20` |
| Request body | camelCase | `{ "title": "...", "parentId": "..." }` |
| Response body | camelCase | `{ "createdAt": "...", "tenantId": "..." }` |
| Error codes | UPPER_SNAKE_CASE | `VALIDATION_ERROR`, `NOT_FOUND` |

**Code Naming Conventions:**

| Element | Convention | Example |
|---------|-----------|---------|
| Files (components) | PascalCase | `PageEditor.tsx`, `SearchDialog.tsx` |
| Files (utilities) | camelCase | `apiClient.ts`, `linkResolver.ts` |
| Files (API routes) | kebab-case (Next.js convention) | `route.ts` in `api/pages/[id]/` |
| React components | PascalCase | `PageEditor`, `GraphView` |
| Functions | camelCase | `createPage()`, `resolveWikilinks()` |
| Variables | camelCase | `pageTitle`, `blockContent` |
| Constants | UPPER_SNAKE_CASE | `MAX_BLOCK_DEPTH`, `API_RATE_LIMIT` |
| Types/Interfaces | PascalCase | `Page`, `Block`, `ApiResponse<T>` |
| Enums | PascalCase + UPPER_SNAKE values | `BlockType.HEADING_1` |
| CSS classes | Tailwind utilities (no custom classes) | `className="flex items-center gap-2"` |

### Structure Patterns

**Project Organization: Feature-based with shared layer**

```
src/
├── app/           — Next.js App Router (pages + API routes)
├── components/    — React components organized by feature
├── lib/           — Shared business logic and utilities
├── types/         — TypeScript type definitions
└── middleware.ts  — Auth + tenant resolution middleware
```

**Test Organization: Co-located unit tests, separate integration tests**

- Unit tests: `*.test.ts` co-located next to source files
- API integration tests: `tests/api/` directory
- E2E tests: `tests/e2e/` directory (Playwright)
- Test utilities: `tests/helpers/` directory

**Configuration Files:**

- Root level: `next.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `.eslintrc.json`
- Prisma: `prisma/schema.prisma`, `prisma/migrations/`, `prisma/seed.ts`
- Docker: `Dockerfile`, `docker-compose.yml`, `.dockerignore`
- Environment: `.env.example` (committed), `.env.local` (gitignored)

### Format Patterns

**API Response Formats:**

All API responses use the standard envelope defined in the API & Communication section:

```typescript
interface ApiResponse<T> {
  data: T;
  meta: {
    timestamp: string;  // ISO 8601
    total?: number;     // For list endpoints
    limit?: number;
    offset?: number;
  };
}

interface ApiError {
  error: {
    code: string;       // UPPER_SNAKE_CASE
    message: string;    // Human-readable
    details?: Array<{
      field: string;
      message: string;
    }>;
  };
  meta: {
    timestamp: string;
  };
}
```

**Date/Time Format:**

- All dates in API responses: ISO 8601 (`2026-02-21T10:00:00.000Z`)
- All dates in database: `TIMESTAMPTZ` (PostgreSQL timestamp with timezone)
- Client-side display: formatted via `Intl.DateTimeFormat` based on user locale

**ID Format:**

- All entity IDs: UUID v4 (`crypto.randomUUID()`)
- Exposed in API as strings: `"id": "550e8400-e29b-41d4-a716-446655440000"`

**Boolean Handling:**

- JSON: `true`/`false` (never `0`/`1`)
- Database: PostgreSQL `BOOLEAN` type
- Query params: `?archived=true` (string, parsed to boolean)

**Null Handling:**

- Missing optional fields: omitted from response (not `null`)
- Explicitly cleared fields: set to `null` in request body
- Database: nullable columns use `NULL`, non-nullable have defaults

### Communication Patterns

**Event System (Internal):**

No event bus in MVP. Direct function calls between modules. Future: consider event system for webhook integrations.

**State Management Patterns:**

| State Type | Managed By | Pattern |
|-----------|-----------|---------|
| Server data (pages, blocks) | TanStack Query | Fetch on mount, stale-while-revalidate, optimistic updates |
| Editor state | TipTap | Internal editor state, synced to server on save (debounced) |
| UI state (modals, sidebar) | React useState/useReducer | Local component state |
| Theme preference | localStorage | Read on mount, CSS custom property toggle |
| Auth session | NextAuth.js | JWT cookie, `useSession()` hook |

**Editor Save Pattern:**

- Auto-save with 1-second debounce after last edit
- Save indicator: "Saving..." → "Saved" in top bar
- Conflict detection: compare `updated_at` before save, warn if stale
- Block-level save: only changed blocks sent to API (PATCH semantics)

### Process Patterns

**Error Handling Patterns:**

```
API Layer:
  ├── Validation errors → 400 with field-level details
  ├── Auth errors → 401/403 with error code
  ├── Not found → 404 (also for wrong tenant — prevents enumeration)
  ├── Business logic errors → 422 with descriptive message
  └── Unexpected errors → 500 with generic message (details logged server-side)

Client Layer:
  ├── TanStack Query → onError callbacks per query/mutation
  ├── Global error boundary → catches unhandled React errors
  ├── Toast notifications → for user-facing errors and success messages
  └── Editor errors → inline error indicators, preserve content on failure
```

**Loading State Patterns:**

- Page navigation: full-page skeleton loader
- Block operations: inline loading indicator on affected block
- Search: skeleton result cards while loading
- Graph: "Loading graph..." with spinner
- API mutations: optimistic update with rollback on failure

**Validation Patterns:**

- API request validation: Zod schemas at route handler entry
- Database validation: Prisma schema constraints (unique, not null, foreign key)
- Client-side validation: Zod schemas shared with API (same validation logic)
- Block content validation: custom validators per block type

### Enforcement Guidelines

**All AI Agents MUST:**

1. Include `tenant_id` filter in every database query — no exceptions
2. Use the standard API response envelope for all endpoints
3. Follow the naming conventions exactly as documented
4. Place files in the correct directory per the project structure
5. Use Zod for request validation at API boundaries
6. Return proper HTTP status codes per the error handling table
7. Use UUIDs for all entity identifiers
8. Store dates as TIMESTAMPTZ in PostgreSQL, return as ISO 8601

**Pattern Examples:**

Good:
```typescript
// Correct: tenant isolation in query
const pages = await prisma.page.findMany({
  where: { tenantId: ctx.tenantId },
  orderBy: { updatedAt: 'desc' },
});
```

Anti-pattern:
```typescript
// WRONG: Missing tenant isolation — returns all tenants' data
const pages = await prisma.page.findMany({
  orderBy: { updatedAt: 'desc' },
});
```

Good:
```typescript
// Correct: Standard API response envelope
return NextResponse.json({
  data: page,
  meta: { timestamp: new Date().toISOString() },
}, { status: 201 });
```

Anti-pattern:
```typescript
// WRONG: Direct response without envelope
return NextResponse.json(page, { status: 201 });
```

## Project Structure & Boundaries

### Complete Project Directory Structure

```
symbio-knowledge-base/
├── .github/
│   └── workflows/
│       └── ci.yml                    # Future: lint, type-check, test
├── docs/
│   ├── api/
│   │   └── openapi.yaml             # OpenAPI 3.0 spec
│   └── stories/                     # BMAD epic and story files
├── prisma/
│   ├── schema.prisma                # Database schema
│   ├── migrations/                  # Auto-generated migrations
│   └── seed.ts                      # Seed data (admin user, welcome page)
├── public/
│   ├── favicon.ico
│   └── images/                      # Static images (logo, defaults)
├── src/
│   ├── app/
│   │   ├── globals.css              # Tailwind base + CSS custom properties
│   │   ├── layout.tsx               # Root layout (auth provider, theme)
│   │   ├── page.tsx                 # Landing/redirect to workspace
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx         # Login page
│   │   │   └── register/
│   │   │       └── page.tsx         # Registration page
│   │   ├── (workspace)/
│   │   │   ├── layout.tsx           # Workspace layout (sidebar + main)
│   │   │   ├── pages/
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx     # Page view with editor
│   │   │   ├── databases/
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx     # Database table view
│   │   │   ├── graph/
│   │   │   │   └── page.tsx         # Global knowledge graph
│   │   │   └── settings/
│   │   │       └── page.tsx         # User settings, API keys
│   │   └── api/
│   │       ├── auth/
│   │       │   └── [...nextauth]/
│   │       │       └── route.ts     # NextAuth.js handler
│   │       ├── pages/
│   │       │   ├── route.ts         # GET list, POST create
│   │       │   └── [id]/
│   │       │       ├── route.ts     # GET, PUT, DELETE page
│   │       │       └── backlinks/
│   │       │           └── route.ts # GET backlinks
│   │       ├── blocks/
│   │       │   ├── route.ts         # POST create block
│   │       │   └── [id]/
│   │       │       └── route.ts     # GET, PUT, DELETE block
│   │       ├── search/
│   │       │   └── route.ts         # GET search
│   │       ├── graph/
│   │       │   └── route.ts         # GET graph data
│   │       ├── databases/
│   │       │   ├── route.ts         # GET list, POST create
│   │       │   └── [id]/
│   │       │       ├── route.ts     # GET, PUT, DELETE database
│   │       │       └── rows/
│   │       │           ├── route.ts # GET list, POST create row
│   │       │           └── [rowId]/
│   │       │               └── route.ts # GET, PUT, DELETE row
│   │       ├── users/
│   │       │   ├── route.ts         # Admin: GET list, POST create
│   │       │   └── [id]/
│   │       │       └── route.ts     # Admin: GET, PUT, DELETE
│   │       ├── keys/
│   │       │   ├── route.ts         # GET list, POST create API key
│   │       │   └── [id]/
│   │       │       └── route.ts     # DELETE (revoke)
│   │       └── docs/
│   │           └── route.ts         # Swagger UI endpoint
│   ├── components/
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── RegisterForm.tsx
│   │   │   └── ApiKeyManager.tsx
│   │   ├── editor/
│   │   │   ├── BlockEditor.tsx      # Main TipTap editor wrapper
│   │   │   ├── SlashMenu.tsx        # Slash command menu
│   │   │   ├── WikilinkSuggestion.tsx # [[wikilink autocomplete
│   │   │   ├── extensions/
│   │   │   │   ├── wikilink.ts      # Custom wikilink extension
│   │   │   │   ├── callout.ts       # Custom callout block
│   │   │   │   └── bookmark.ts      # URL bookmark block
│   │   │   └── renderers/
│   │   │       ├── CodeBlock.tsx     # Code block with syntax highlighting
│   │   │       ├── Callout.tsx       # Callout block renderer
│   │   │       ├── Bookmark.tsx      # Bookmark card renderer
│   │   │       └── ImageBlock.tsx    # Image block renderer
│   │   ├── graph/
│   │   │   ├── KnowledgeGraph.tsx   # Force graph wrapper
│   │   │   ├── GraphControls.tsx    # Zoom, filter, view toggle
│   │   │   └── GraphNode.tsx        # Custom node renderer
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx          # Page tree sidebar
│   │   │   ├── SidebarTree.tsx      # Recursive tree component
│   │   │   ├── Breadcrumbs.tsx      # Navigation breadcrumbs
│   │   │   ├── TopBar.tsx           # Top bar with save status
│   │   │   └── ThemeToggle.tsx      # Light/dark mode toggle
│   │   ├── pages/
│   │   │   ├── PageView.tsx         # Full page view (header + editor)
│   │   │   ├── PageHeader.tsx       # Title, icon, cover
│   │   │   └── BacklinksPanel.tsx   # Backlinks listing
│   │   ├── database/
│   │   │   ├── TableView.tsx        # Database table component
│   │   │   ├── PropertyEditor.tsx   # Inline property editing
│   │   │   ├── FilterBar.tsx        # Column filtering
│   │   │   └── SortControls.tsx     # Column sorting
│   │   ├── search/
│   │   │   ├── SearchDialog.tsx     # Quick switcher (Cmd+K)
│   │   │   ├── SearchResults.tsx    # Search result cards
│   │   │   └── SearchInput.tsx      # Search input with live results
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Modal.tsx
│   │       ├── Dropdown.tsx
│   │       ├── Toast.tsx
│   │       ├── Skeleton.tsx
│   │       └── Tooltip.tsx
│   ├── lib/
│   │   ├── auth.ts                  # NextAuth.js configuration
│   │   ├── db.ts                    # Prisma client singleton
│   │   ├── apiResponse.ts           # Standard response envelope helpers
│   │   ├── apiAuth.ts              # API key validation middleware
│   │   ├── tenantContext.ts         # Tenant resolution from auth
│   │   ├── validation/
│   │   │   ├── pages.ts             # Zod schemas for page operations
│   │   │   ├── blocks.ts            # Zod schemas for block operations
│   │   │   ├── databases.ts         # Zod schemas for database operations
│   │   │   └── search.ts            # Zod schemas for search params
│   │   ├── wikilinks/
│   │   │   ├── parser.ts            # Extract [[wikilinks]] from content
│   │   │   ├── resolver.ts          # Resolve wikilinks to page IDs
│   │   │   └── indexer.ts           # Maintain page_links table
│   │   ├── search/
│   │   │   ├── indexer.ts           # Update tsvector on block changes
│   │   │   └── query.ts            # FTS query builder
│   │   └── graph/
│   │       └── builder.ts           # Build graph data from page_links
│   ├── types/
│   │   ├── page.ts                  # Page, PageWithBlocks types
│   │   ├── block.ts                 # Block, BlockContent types
│   │   ├── database.ts              # Database, Property, Row types
│   │   ├── graph.ts                 # GraphNode, GraphEdge types
│   │   ├── api.ts                   # ApiResponse<T>, ApiError types
│   │   └── auth.ts                  # User, Session, ApiKey types
│   └── middleware.ts                # Next.js middleware (auth, redirects)
├── tests/
│   ├── api/
│   │   ├── pages.test.ts           # Page API integration tests
│   │   ├── blocks.test.ts          # Block API integration tests
│   │   ├── search.test.ts          # Search API tests
│   │   ├── graph.test.ts           # Graph API tests
│   │   ├── databases.test.ts       # Database API tests
│   │   ├── auth.test.ts            # Auth flow tests
│   │   └── tenantIsolation.test.ts # Multi-tenant security tests
│   ├── e2e/
│   │   ├── editor.spec.ts          # Block editor E2E
│   │   ├── navigation.spec.ts      # Page navigation E2E
│   │   ├── search.spec.ts          # Search E2E
│   │   └── graph.spec.ts           # Graph interaction E2E
│   └── helpers/
│       ├── fixtures.ts              # Test data factories
│       ├── setup.ts                 # Test database setup/teardown
│       └── apiClient.ts            # Test API client helper
├── .env.example                     # Environment variable template
├── .eslintrc.json                   # ESLint configuration
├── .gitignore                       # Git ignore rules
├── .dockerignore                    # Docker ignore rules
├── Dockerfile                       # Production Docker image
├── docker-compose.yml               # Development + production compose
├── next.config.ts                   # Next.js configuration
├── package.json                     # Dependencies and scripts
├── tailwind.config.ts               # Tailwind CSS configuration
├── tsconfig.json                    # TypeScript configuration
└── README.md                        # Project documentation
```

### Architectural Boundaries

**API Boundaries:**

- External API: All `/api/*` routes — consumed by AI agents and the web UI
- Auth boundary: `middleware.ts` + `lib/apiAuth.ts` — all requests pass through auth before reaching handlers
- Tenant boundary: `lib/tenantContext.ts` — every DB query scoped by tenant_id

**Component Boundaries:**

- Editor boundary: `components/editor/` owns all TipTap state; communicates with API via `lib/` functions
- Graph boundary: `components/graph/` receives data as props from page component; no direct API calls
- Layout boundary: `components/layout/` manages sidebar state and navigation; does not access page/block content

**Data Boundaries:**

- Prisma is the only database access layer — no raw SQL except for FTS queries (via `prisma.$queryRaw`)
- All database mutations go through `lib/` service functions that handle validation, tenant isolation, and link indexing
- Block content JSONB is opaque to the database — structure is enforced at the application layer via Zod

### Requirements to Structure Mapping

**Feature Mapping:**

| Feature Area | Components | API Routes | Lib Modules | Tests |
|-------------|-----------|-----------|-------------|-------|
| Page Management (FR1-7) | `pages/`, `layout/Sidebar` | `api/pages/` | `validation/pages` | `api/pages.test` |
| Block Editor (FR8-14) | `editor/` | `api/blocks/` | `validation/blocks` | `api/blocks.test`, `e2e/editor` |
| Wikilinks (FR15-19) | `editor/extensions/wikilink` | `api/pages/[id]/backlinks` | `wikilinks/` | `api/pages.test` |
| Search (FR20-24) | `search/` | `api/search/` | `search/`, `validation/search` | `api/search.test`, `e2e/search` |
| Knowledge Graph (FR25-29) | `graph/` | `api/graph/` | `graph/` | `api/graph.test`, `e2e/graph` |
| REST API (FR30-40) | — | All `api/` routes | `apiResponse`, `apiAuth` | `api/*.test` |
| Database (FR41-46) | `database/` | `api/databases/` | `validation/databases` | `api/databases.test` |
| User Management (FR47-51) | `auth/` | `api/auth/`, `api/users/`, `api/keys/` | `auth`, `tenantContext` | `api/auth.test`, `api/tenantIsolation.test` |
| Theming (FR52-54) | `layout/ThemeToggle` | — | — | — |

**Cross-Cutting Concerns:**

| Concern | Files |
|---------|-------|
| Tenant isolation | `middleware.ts`, `lib/tenantContext.ts`, `lib/apiAuth.ts`, every API route |
| Wikilink management | `lib/wikilinks/`, `editor/extensions/wikilink.ts`, page API routes |
| Error handling | `lib/apiResponse.ts`, every API route, `components/ui/Toast.tsx` |
| Validation | `lib/validation/*.ts`, API route handlers |

### Integration Points

**Internal Communication:**

- Web UI → API: React Server Components (RSC) for initial loads; `fetch()` from Client Components for mutations
- Editor → API: Debounced auto-save via TanStack Query mutations
- Search → API: Debounced search-as-you-type via TanStack Query
- Graph → API: Fetch graph data on mount, re-fetch on navigation

**External Integrations:**

- AI Agents → REST API: Standard HTTP with `Authorization: Bearer <api-key>` header
- Future: ChemELN → REST API (bidirectional sync via dedicated endpoints)
- Future: exPTube → REST API (video metadata import)

**Data Flow:**

```
AI Agent                           Web Browser
    │                                   │
    │  POST /api/pages                  │  Navigate to /pages/[id]
    │  Authorization: Bearer <key>      │  Cookie: session
    ▼                                   ▼
┌─────────────────────────────────────────┐
│            Next.js Server               │
│                                         │
│  middleware.ts (auth + tenant)          │
│       │                                 │
│       ▼                                 │
│  API Route Handler / Server Component   │
│       │                                 │
│       ▼                                 │
│  lib/ (validation, business logic)      │
│       │                                 │
│       ▼                                 │
│  Prisma (tenant-scoped queries)         │
│       │                                 │
│       ▼                                 │
└───────┼─────────────────────────────────┘
        │
        ▼
┌─────────────┐
│ PostgreSQL   │
│ (tenant     │
│  isolated)  │
└─────────────┘
```

## Architecture Validation Results

### Coherence Validation

**Decision Compatibility:**

- Next.js 16 + React 19 + TipTap 3 + Tailwind 4: All compatible, all TypeScript-native
- Prisma 7 + PostgreSQL 18: Fully compatible, Prisma supports JSONB and raw SQL for FTS
- NextAuth.js v4 + Next.js 16 App Router: Compatible (v4 supports App Router via middleware pattern)
- react-force-graph + React 19: Compatible (uses React reconciliation, no class component dependencies)
- Docker Compose v5 + PostgreSQL 18: Standard containerized deployment, no conflicts

**Pattern Consistency:**

- Naming conventions (snake_case DB, camelCase JS/API) are standard for this stack and consistently applied
- All API responses use the same envelope format — no exceptions
- Tenant isolation pattern is uniform: middleware resolves tenant, all queries filter by it

**Structure Alignment:**

- Project structure follows Next.js App Router conventions with feature-based component organization
- API routes mirror the REST resource structure exactly
- Test organization mirrors source structure for easy navigation

### Requirements Coverage Validation

**Functional Requirements Coverage:**

All 54 FRs are architecturally supported:

- FR1-7 (Page Management): Hierarchical `pages` table with `parent_id`, sidebar tree component, breadcrumb from ancestry
- FR8-14 (Block Editor): TipTap 3 with custom extensions, JSONB block storage, undo/redo via TipTap history
- FR15-19 (Wikilinks): Custom TipTap extension, `page_links` index table, backlinks query endpoint
- FR20-24 (Search): PostgreSQL tsvector FTS, SearchDialog component with debounced query
- FR25-29 (Knowledge Graph): react-force-graph with data from `page_links`, local graph via N-hop query
- FR30-40 (REST API): Complete route structure defined, OpenAPI spec, standard response format
- FR41-46 (Database): `databases` + `db_rows` tables with JSONB properties, TableView component
- FR47-51 (User Management): NextAuth.js auth, api_keys table, tenant isolation at query layer
- FR52-54 (Theming): CSS custom properties, localStorage persistence, Tailwind dark mode

**Non-Functional Requirements Coverage:**

- NFR1-5 (Performance): SSR for fast TTI, Prisma query optimization, debounced editor saves, WebGL graph renderer
- NFR6-11 (Security): HTTPS, bcrypt, hashed API keys, tenant isolation at DB layer, Zod + DOMPurify
- NFR12-14 (Scalability): Stateless API (horizontally scalable), PostgreSQL indexing strategy
- NFR15-17 (Reliability): Docker restart policies, Prisma transactions, PostgreSQL ACID guarantees
- NFR18-19 (Accessibility): Keyboard navigation via TipTap + React focus management, Tailwind contrast utilities
- NFR20-22 (Integration): OpenAPI 3.0, ISO 8601, extensible JSONB schema

### Implementation Readiness Validation

**Decision Completeness:** All critical and important decisions documented with specific versions.

**Structure Completeness:** Every source file and directory is defined in the project tree with clear purpose.

**Pattern Completeness:** Naming, structure, format, communication, and process patterns all specified with examples and anti-patterns.

### Gap Analysis Results

**No critical gaps identified.**

**Minor areas for future enhancement:**

- Logging framework not specified — use `console.log` for MVP, evaluate Pino/Winston for production
- Image upload storage not specified — use local filesystem in MVP, evaluate S3-compatible storage for production
- Backup strategy not specified — rely on PostgreSQL `pg_dump` for MVP

### Architecture Completeness Checklist

**Requirements Analysis**

- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**Architectural Decisions**

- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**Implementation Patterns**

- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**Project Structure**

- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High — all technology choices are proven, stable, and well-documented. The architecture follows established patterns for Next.js full-stack applications.

**Key Strengths:**

1. Simplified deployment (2 containers instead of 3) by using Next.js API Routes
2. Strong tenant isolation pattern enforced at every layer
3. Extensible block content schema via JSONB — new block types need no migrations
4. API-first design with complete route mapping for all 54 FRs
5. Proven technology choices with latest stable versions

**Areas for Future Enhancement:**

- Add WebSocket layer for real-time collaboration (post-MVP)
- Add Meilisearch or pgvector for semantic search (post-MVP)
- Add S3-compatible object storage for file attachments (post-MVP)
- Add comprehensive logging and monitoring stack (post-MVP)

### Implementation Handoff

**AI Agent Guidelines:**

- Follow all architectural decisions exactly as documented
- Use implementation patterns consistently across all components
- Respect project structure and boundaries
- Refer to this document for all architectural questions
- Include `tenant_id` in every database query without exception

**First Implementation Priority:**

```bash
npx create-next-app@latest symbio-knowledge-base \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --turbopack \
  --import-alias "@/*"
```

Then add core dependencies:

```bash
npm install prisma @prisma/client next-auth@4 \
  @tiptap/react @tiptap/starter-kit @tiptap/pm \
  @tanstack/react-query react-force-graph \
  zod dompurify bcryptjs
npm install -D @types/bcryptjs @types/dompurify \
  playwright @playwright/test
```

---

*Architecture Decision Document created: 2026-02-21*
*Author: Martin (Product Owner) + Winston (Architecture Agent)*
*BMAD Workflow: create-architecture (steps 1-8 complete)*
