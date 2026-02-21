# Epic 1: Project Foundation & Infrastructure

**Epic ID:** EPIC-01
**Created:** 2026-02-21
**Total Story Points:** 18
**Priority:** Critical
**Status:** Draft

---

## Epic Overview

Epic 1 establishes the foundational infrastructure for SymbioKnowledgeBase. This includes initializing the Next.js 16 project with all core dependencies, setting up the PostgreSQL database schema via Prisma 7, configuring the Docker Compose development environment, and creating the application shell (root layout, sidebar placeholder, and routing structure).

No user-facing features are delivered in this epic — it creates the scaffolding that all subsequent epics build upon. Every architectural decision from the architecture document is encoded here: TypeScript strict mode, Tailwind 4, App Router with `src/` directory, Prisma schema with tenant isolation, and Docker Compose with PostgreSQL 18.

---

## Business Value

- Establishes the entire project from zero to a running development environment
- Encodes all architectural decisions (tech stack, project structure, naming conventions) so all subsequent stories build on a consistent foundation
- Docker Compose setup enables any developer to start contributing with a single command
- Database schema defines the core data model that all features depend on

---

## Architecture Summary

```
Developer Machine
    │
    │  docker compose up -d
    ▼
┌────────────────────────────────────────┐
│  Docker Compose                        │
│                                        │
│  ┌──────────────────┐  ┌────────────┐ │
│  │  app (Next.js 16) │  │ db (PG 18) │ │
│  │  Port 3000        │──│ Port 5432  │ │
│  │                    │  │            │ │
│  │  - App Router      │  │ - symbio   │ │
│  │  - Tailwind 4      │  │   database │ │
│  │  - Prisma Client   │  │ - pgdata   │ │
│  │  - TipTap 3        │  │   volume   │ │
│  └──────────────────┘  └────────────┘ │
└────────────────────────────────────────┘
```

---

## Stories Breakdown

### SKB-01.1: Initialize Next.js Project with Core Dependencies — 5 points, Critical

**Delivers:** Complete Next.js 16 project created via `create-next-app` with TypeScript, Tailwind 4, ESLint, App Router, and `src/` directory. All core npm dependencies installed (Prisma, TipTap, TanStack Query, react-force-graph, Zod, bcryptjs, DOMPurify). Project compiles and runs at `localhost:3000`.

**Depends on:** Nothing (first story)

---

### SKB-01.2: PostgreSQL Database Schema and Prisma Setup — 5 points, Critical

**Delivers:** Prisma 7 schema with all core tables (`tenants`, `users`, `pages`, `blocks`, `page_links`, `api_keys`, `databases`, `db_rows`), all with `tenant_id` columns and composite indexes. Prisma Client generated. Seed script creates initial admin tenant and user. Database migrations run successfully against PostgreSQL 18.

**Depends on:** SKB-01.1 (project must exist)

---

### SKB-01.3: Docker Compose Development Environment — 3 points, Critical

**Delivers:** `docker-compose.yml` with `app` (Next.js) and `db` (PostgreSQL 18) services. `.env.example` with all required variables. `Dockerfile` for production builds. `docker compose up` starts both services and runs migrations automatically.

**Depends on:** SKB-01.2 (Prisma schema must exist)

---

### SKB-01.4: Application Shell and Routing Structure — 5 points, High

**Delivers:** Root layout with theme support, workspace layout with collapsible sidebar placeholder and main content area, all route files created (empty pages) matching the architecture: `(auth)/login`, `(auth)/register`, `(workspace)/pages/[id]`, `(workspace)/databases/[id]`, `(workspace)/graph`, `(workspace)/settings`. Global CSS with Tailwind base and CSS custom properties for theming. Standard API response helpers (`lib/apiResponse.ts`).

**Depends on:** SKB-01.1 (Next.js project must exist)

---

## Test Coverage Requirements

| Story | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 01.1 | TypeScript compilation, ESLint pass | - | `localhost:3000` returns 200 |
| 01.2 | Prisma schema validation | Migration runs against test DB | Seed script creates admin user |
| 01.3 | - | `docker compose up` starts both services | Health check endpoints respond |
| 01.4 | Component render tests | - | Navigation between routes works |

---

## Implementation Order

```
01.1 → 01.2 → 01.3 (sequential, each depends on previous)
01.1 → 01.4 (can run in parallel with 01.2/01.3)
```

---

## Shared Constraints

- All code must follow naming conventions from architecture document (PascalCase components, camelCase functions, snake_case DB)
- All database tables must include `tenant_id` column with composite indexes
- TypeScript strict mode enabled — no `any` types allowed
- All environment variables documented in `.env.example`

---

## Files Created/Modified by This Epic

### New Files
- All project files from `create-next-app` scaffold
- `prisma/schema.prisma`
- `prisma/seed.ts`
- `docker-compose.yml`
- `Dockerfile`
- `.dockerignore`
- `.env.example`
- `src/app/layout.tsx`, `src/app/page.tsx`
- `src/app/(auth)/login/page.tsx`, `src/app/(auth)/register/page.tsx`
- `src/app/(workspace)/layout.tsx`
- `src/app/(workspace)/pages/[id]/page.tsx`
- `src/app/(workspace)/databases/[id]/page.tsx`
- `src/app/(workspace)/graph/page.tsx`
- `src/app/(workspace)/settings/page.tsx`
- `src/lib/apiResponse.ts`
- `src/lib/db.ts`
- `src/types/api.ts`

---

**Last Updated:** 2026-02-21
