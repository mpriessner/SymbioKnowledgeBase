# Epic 10: API Documentation & Production Deployment

**Epic ID:** EPIC-10
**Created:** 2026-02-21
**Total Story Points:** 10
**Priority:** High
**Status:** Draft

---

## Epic Overview

Epic 10 completes the MVP by delivering OpenAPI/Swagger documentation for the REST API and production-ready Docker deployment. The OpenAPI spec covers every API endpoint from EPIC-03 through EPIC-08, served as an interactive Swagger UI at `/api/docs`. The production deployment story delivers a multi-stage Dockerfile optimized for Next.js standalone output, a production `docker-compose.yml` with health checks and restart policies, and environment configuration with documented variables, backup scripts, and deployment instructions.

This epic covers FR40 (API documentation), NFR15-17 (deployment and operations), and NFR20 (documentation).

---

## Business Value

- OpenAPI documentation enables AI agents and third-party integrations to consume the API without reading source code — this is critical for the AI-agent-first design philosophy
- Swagger UI at `/api/docs` provides an interactive API explorer for developers, reducing onboarding time
- Production Docker builds with multi-stage compilation reduce image size by excluding dev dependencies and build artifacts
- Health checks and restart policies enable self-healing in production — containers restart automatically on failure
- Documented environment variables and backup scripts reduce operational risk and enable anyone to deploy

---

## Architecture Summary

```
┌──────────────────────────────────────────────────────────────┐
│  Production Deployment                                        │
│                                                               │
│  docker-compose.prod.yml                                      │
│  ┌──────────────────────────────────────────────────────────┐│
│  │                                                           ││
│  │  ┌─────────────────────────┐  ┌────────────────────────┐││
│  │  │  app (Next.js 16)       │  │  db (PostgreSQL 18)    │││
│  │  │                         │  │                         │││
│  │  │  Multi-stage Dockerfile │  │  postgres:18-alpine     │││
│  │  │  ┌───────────────────┐  │  │                         │││
│  │  │  │ Stage 1: deps     │  │  │  Volume: pgdata        │││
│  │  │  │ - npm ci           │  │  │  Health: pg_isready    │││
│  │  │  ├───────────────────┤  │  │  Restart: unless-stopped│││
│  │  │  │ Stage 2: build    │  │  │                         │││
│  │  │  │ - next build      │  │  │  Backup: pg_dump cron   │││
│  │  │  │ - standalone out  │  │  │                         │││
│  │  │  ├───────────────────┤  │  └────────────────────────┘││
│  │  │  │ Stage 3: runtime  │  │                             ││
│  │  │  │ - node:22-alpine  │  │                             ││
│  │  │  │ - standalone/     │  │                             ││
│  │  │  │ - prisma migrate  │  │                             ││
│  │  │  └───────────────────┘  │                             ││
│  │  │                         │                             ││
│  │  │  Port: 3000             │                             ││
│  │  │  Health: /api/health    │                             ││
│  │  │  Restart: unless-stopped│                             ││
│  │  └─────────────────────────┘                             ││
│  │                                                           ││
│  └──────────────────────────────────────────────────────────┘│
│                                                               │
│  ┌──────────────────────────────────────────────────────────┐│
│  │  /api/docs (Swagger UI)                                   ││
│  │                                                           ││
│  │  ┌─────────────────────────────────────────────────┐     ││
│  │  │  OpenAPI 3.0 Spec (docs/api/openapi.yaml)      │     ││
│  │  │                                                  │     ││
│  │  │  Paths:                                          │     ││
│  │  │    /api/auth/*        (EPIC-02)                  │     ││
│  │  │    /api/pages/*       (EPIC-03)                  │     ││
│  │  │    /api/pages/*/blocks/* (EPIC-04)               │     ││
│  │  │    /api/search        (EPIC-06)                  │     ││
│  │  │    /api/graph         (EPIC-07)                  │     ││
│  │  │    /api/databases/*   (EPIC-08)                  │     ││
│  │  │                                                  │     ││
│  │  │  Components:                                     │     ││
│  │  │    schemas, securitySchemes, responses           │     ││
│  │  └─────────────────────────────────────────────────┘     ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

---

## Stories Breakdown

### SKB-10.1: OpenAPI Specification and Swagger UI — 3 points, High

**Delivers:** A complete OpenAPI 3.0 specification file at `docs/api/openapi.yaml` documenting every REST API endpoint across the application. Each endpoint includes: HTTP method, path, summary, description, request body schema (where applicable), query parameters, response schemas for success and error cases, and authentication requirements. Reusable `components/schemas` for all data models (Page, Block, Database, DbRow, SearchResult, GraphData, User). Reusable `components/responses` for standard error responses (401, 403, 404, 422). Security scheme defined for session-based auth (cookie) and API key auth (header). Swagger UI served at `/api/docs` using `swagger-ui-react` or a static HTML page loading the spec from `/api/docs/openapi.json`. The spec file is manually maintained (not auto-generated) to ensure quality and accuracy.

**Depends on:** All API epics (EPIC-02 through EPIC-08 must have their endpoints defined so the spec can document them)

---

### SKB-10.2: Docker Production Build — 4 points, High

**Delivers:** Multi-stage `Dockerfile.production` with three stages:
1. **deps** — `node:22-alpine`, copies `package.json` and `package-lock.json`, runs `npm ci --omit=dev` for production dependencies, and `npm ci` in a separate layer for build dependencies
2. **build** — copies source code, runs `npx prisma generate` and `next build` with `output: "standalone"` in `next.config.ts`
3. **runtime** — `node:22-alpine`, copies standalone output, public assets, and Prisma client; entrypoint runs `npx prisma migrate deploy` then `node server.js`

Production `docker-compose.prod.yml` with:
- `app` service: builds from `Dockerfile.production`, port 3000, depends on `db`, restart policy `unless-stopped`, health check hitting `GET /api/health` every 30s
- `db` service: `postgres:18-alpine`, named volume `pgdata`, restart policy `unless-stopped`, health check using `pg_isready` every 10s
- Environment variables passed via `env_file: .env`

`/api/health` endpoint (`src/app/api/health/route.ts`) returning `{ status: "ok", timestamp, version }` after verifying database connectivity via a simple Prisma query.

**Depends on:** SKB-01.3 (development Docker setup must exist as the baseline)

---

### SKB-10.3: Production Environment Configuration — 3 points, High

**Delivers:** Complete `.env.example` with every production environment variable documented with comments explaining purpose, format, and example values:
- `DATABASE_URL` — PostgreSQL connection string
- `NEXTAUTH_URL` — canonical app URL
- `NEXTAUTH_SECRET` — session encryption key (with generation command: `openssl rand -base64 32`)
- `NODE_ENV` — must be "production"
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` — database credentials
- All other variables used across the application

Database backup script (`scripts/backup.sh`) using `pg_dump` with timestamped output files, configurable retention (default: keep last 7 days), and compression via `gzip`. Script reads database credentials from environment variables.

Docker health check endpoint documentation in the README. Deployment instructions covering: cloning the repo, configuring `.env`, running `docker compose -f docker-compose.prod.yml up -d`, verifying health, and checking logs. Instructions for HTTPS setup recommendations (reverse proxy with nginx/Caddy).

**Depends on:** SKB-10.2 (production Docker build must exist)

---

## Test Coverage Requirements

| Story | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 10.1 | OpenAPI spec validates against OpenAPI 3.0 schema (using swagger-cli validate) | Swagger UI loads at /api/docs and renders without errors | Navigate to /api/docs, expand an endpoint, see request/response schemas |
| 10.2 | - | Docker build completes without errors; container starts and responds on port 3000; migrations run on startup | docker compose up, wait for health check, curl /api/health returns 200 |
| 10.3 | backup.sh creates timestamped dump file; old backups pruned | - | Full deployment from clean machine following README instructions |

---

## Implementation Order

```
10.2 → 10.3 (sequential — production config depends on Docker build)
10.1 (independent — can run in parallel after API epics complete)

┌────────┐     ┌────────┐
│ 10.2   │────▶│ 10.3   │
│ Docker │     │ Env +  │
│ Build  │     │ Config │
└────────┘     └────────┘

┌────────┐
│ 10.1   │  (independent track)
│ OpenAPI│
│ + Docs │
└────────┘
```

---

## Shared Constraints

- All database queries must include `tenant_id` for multi-tenant isolation
- API responses follow the standard envelope: `{ data, meta }` for success, `{ error, meta }` for failure
- TypeScript strict mode — no `any` types allowed
- The OpenAPI spec must be kept in sync with actual API implementations — any API change requires a corresponding spec update
- Production Docker image must not contain dev dependencies, source maps, or test files
- Secrets (NEXTAUTH_SECRET, POSTGRES_PASSWORD) must never be committed to version control — `.env` is in `.gitignore`
- The health endpoint must not expose sensitive information (no database credentials, no internal IPs)
- Backup script must be idempotent and safe to run via cron

---

## Files Created/Modified by This Epic

### New Files
- `docs/api/openapi.yaml` — OpenAPI 3.0 specification
- `src/app/api/docs/route.ts` — Swagger UI page serving the OpenAPI spec
- `src/app/api/health/route.ts` — health check endpoint
- `Dockerfile.production` — multi-stage production Dockerfile
- `docker-compose.prod.yml` — production Docker Compose configuration
- `scripts/backup.sh` — database backup script with pg_dump
- `src/__tests__/api/health/route.test.ts`

### Modified Files
- `.env.example` — expanded with all production variables and documentation comments
- `next.config.ts` — add `output: "standalone"` for production builds
- `.gitignore` — ensure `.env`, `pgdata/`, and backup files are excluded
- `.dockerignore` — ensure node_modules, .git, and test files are excluded from Docker context
- `README.md` — add deployment instructions section (only if README already exists)

---

**Last Updated:** 2026-02-21