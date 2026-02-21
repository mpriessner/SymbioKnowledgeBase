# Story SKB-01.3: Docker Compose Development Environment

**Epic:** Epic 1 - Project Foundation & Infrastructure
**Story ID:** SKB-01.3
**Story Points:** 3 | **Priority:** Critical | **Status:** Draft
**Depends On:** SKB-01.2 (Prisma schema must exist for migration on startup)

---

## User Story

As a developer, I want to start the entire development environment with a single command, So that I can develop without manually configuring PostgreSQL or other services.

---

## Acceptance Criteria

- [ ] `docker-compose.yml` with `app` (Next.js) and `db` (PostgreSQL 18) services
- [ ] PostgreSQL persists data via named volume (`pgdata`)
- [ ] `.env.example` documents all required environment variables
- [ ] `Dockerfile` uses multi-stage build: deps -> builder -> runner
- [ ] Next.js standalone output for minimal Docker image
- [ ] Prisma migrations run on container startup
- [ ] `docker compose up` starts both services
- [ ] App accessible at `localhost:3000` connecting to PostgreSQL
- [ ] `.dockerignore` excludes `node_modules`, `.next`, `.git`, etc.

---

## Architecture Overview

```
Developer Machine
    │
    │  docker compose up -d
    ▼
┌──────────────────────────────────────────────────────────┐
│  Docker Compose Network: symbio-network                  │
│                                                          │
│  ┌─────────────────────┐    ┌──────────────────────┐    │
│  │  app (Next.js 16)   │    │  db (PostgreSQL 18)  │    │
│  │                     │    │                      │    │
│  │  Port: 3000:3000    │───▶│  Port: 5432:5432     │    │
│  │                     │    │                      │    │
│  │  Dockerfile:        │    │  Image:              │    │
│  │  - Stage 1: deps    │    │  postgres:18         │    │
│  │  - Stage 2: builder │    │                      │    │
│  │  - Stage 3: runner  │    │  Volume:             │    │
│  │                     │    │  pgdata → /var/lib/  │    │
│  │  Entrypoint:        │    │  postgresql/data     │    │
│  │  1. prisma migrate  │    │                      │    │
│  │  2. prisma db seed  │    │  Env:                │    │
│  │  3. node server.js  │    │  POSTGRES_DB=symbio  │    │
│  └─────────────────────┘    │  POSTGRES_USER=symbio│    │
│                              └──────────────────────┘    │
│                                                          │
│  Volumes:                                                │
│  - pgdata (persistent PostgreSQL data)                   │
└──────────────────────────────────────────────────────────┘

Startup Sequence:
─────────────────
1. docker compose up
2. db starts → PostgreSQL ready on port 5432
3. app starts → waits for db (depends_on + healthcheck)
4. app entrypoint runs prisma migrate deploy
5. app entrypoint runs prisma db seed (idempotent)
6. app starts Next.js server on port 3000
7. Developer accesses http://localhost:3000
```

**Key Design Decisions:**

1. **Multi-stage Dockerfile** — Three stages (deps, builder, runner) minimize the final image size. The runner stage uses `node:22-alpine` (~130MB) instead of the full `node:22` (~1GB) image. Only the standalone Next.js output and Prisma engine binaries are copied to the final stage.

2. **Named volume for PostgreSQL** — Using a Docker named volume (`pgdata`) ensures database data persists across `docker compose down` and `docker compose up` cycles. Data is only lost with `docker compose down -v` (explicit volume deletion).

3. **Entrypoint script instead of CMD** — Running migrations in an entrypoint script ensures the database schema is always up-to-date when the container starts, even after pulling new code with schema changes.

4. **Health check on PostgreSQL** — The `app` service uses `depends_on` with a `condition: service_healthy` to wait for PostgreSQL to be fully ready before attempting to run migrations. Without this, the migration would fail with a "connection refused" error.

---

## Implementation Steps

### Step 1: Create the Dockerfile

The Dockerfile uses a 3-stage multi-stage build to produce a minimal production image.

**File: `Dockerfile`**

```dockerfile
# ──────────────────────────────────────────────────────────
# Stage 1: Install dependencies
# ──────────────────────────────────────────────────────────
FROM node:22-alpine AS deps

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# ──────────────────────────────────────────────────────────
# Stage 2: Build the application
# ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copy dependencies from stage 1
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js (standalone output)
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ──────────────────────────────────────────────────────────
# Stage 3: Production runner
# ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy static assets
COPY --from=builder /app/public ./public

# Copy standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma schema and migrations (needed for migrate deploy)
COPY --from=builder /app/prisma ./prisma

# Copy seed script dependencies
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/bcryptjs ./node_modules/bcryptjs

# Copy entrypoint script
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
```

**Stage explanations:**

- **Stage 1 (deps):** Installs all npm dependencies and generates the Prisma Client. This stage is cached as long as `package.json` and `package-lock.json` don't change.
- **Stage 2 (builder):** Copies the full source code and runs `npm run build`. The standalone output is created in `.next/standalone/`.
- **Stage 3 (runner):** Copies only the files needed to run the application: the standalone server, static assets, public directory, and Prisma files for migrations. Runs as a non-root user (`nextjs`) for security.

---

### Step 2: Create the Entrypoint Script

The entrypoint script runs Prisma migrations and seeds before starting the Next.js server.

**File: `docker-entrypoint.sh`**

```bash
#!/bin/sh
set -e

echo "SymbioKnowledgeBase — Starting..."

# ── Run Prisma migrations ──
echo "Running database migrations..."
npx prisma migrate deploy
echo "Migrations complete."

# ── Seed database (idempotent) ──
echo "Running database seed..."
npx prisma db seed || echo "Seed already applied or failed (non-blocking)."
echo "Seed complete."

# ── Start the application ──
echo "Starting Next.js server..."
exec "$@"
```

**Design decisions:**

- **`prisma migrate deploy`** (not `prisma migrate dev`) — `deploy` is the production-safe migration command. It applies pending migrations without creating new ones or prompting for confirmation.
- **Seed is non-blocking** — The seed script uses `upsert`, making it idempotent. If it fails (e.g., due to a missing dependency), the server still starts. The `|| echo` ensures a seed failure does not prevent the container from running.
- **`exec "$@"`** — Replaces the shell process with the CMD argument (`node server.js`), ensuring Docker signals (SIGTERM, SIGINT) are passed directly to the Node.js process for graceful shutdown.

---

### Step 3: Create docker-compose.yml

Define the 2-service Docker Compose configuration.

**File: `docker-compose.yml`**

```yaml
services:
  # ── Next.js Application ────────────────────────────────
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://symbio:${DB_PASSWORD:-symbio_dev_password}@db:5432/symbio?schema=public
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET:-dev_secret_change_me_in_production}
      NEXTAUTH_URL: ${NEXTAUTH_URL:-http://localhost:3000}
      NODE_ENV: ${NODE_ENV:-production}
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - symbio-network

  # ── PostgreSQL Database ─────────────────────────────────
  db:
    image: postgres:18
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: symbio
      POSTGRES_USER: symbio
      POSTGRES_PASSWORD: ${DB_PASSWORD:-symbio_dev_password}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U symbio -d symbio"]
      interval: 5s
      timeout: 5s
      retries: 10
      start_period: 10s
    restart: unless-stopped
    networks:
      - symbio-network

volumes:
  pgdata:
    driver: local

networks:
  symbio-network:
    driver: bridge
```

**Configuration explanations:**

- **`${DB_PASSWORD:-symbio_dev_password}`** — Uses the `DB_PASSWORD` environment variable if set, otherwise defaults to `symbio_dev_password` for development convenience. In production, this MUST be overridden.
- **`depends_on.db.condition: service_healthy`** — The `app` service does not start until PostgreSQL passes its health check (`pg_isready`), preventing migration failures due to database unavailability.
- **Health check timing:** Checks every 5 seconds, allows 10 retries with a 10-second start period. PostgreSQL typically starts in 2-5 seconds, so this provides ample time.
- **`restart: unless-stopped`** — Both services automatically restart on crash. They only stay stopped if explicitly stopped with `docker compose stop`.
- **Named network (`symbio-network`)** — Provides DNS resolution between containers. The `app` container can reach PostgreSQL at hostname `db` on port `5432`.
- **Port mapping `5432:5432`** — Exposes PostgreSQL on the host for direct access via `prisma studio`, `psql`, or other database tools during development.

---

### Step 4: Create .dockerignore

Exclude unnecessary files from the Docker build context to speed up builds and reduce image size.

**File: `.dockerignore`**

```
# Dependencies (reinstalled in Docker)
node_modules
npm-debug.log*

# Build output (rebuilt in Docker)
.next
out

# Version control
.git
.gitignore

# IDE and editor files
.vscode
.idea
*.swp
*.swo
*~

# OS files
.DS_Store
Thumbs.db

# Environment files (secrets)
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Documentation (not needed at runtime)
docs
*.md
!README.md

# Tests (not needed in production image)
tests
playwright-report
test-results

# Docker files (prevent recursive copy)
Dockerfile
docker-compose.yml
.dockerignore

# BMAD project management files
_bmad
_bmad-output
```

---

### Step 5: Create .env.example

Document all required environment variables with descriptions and safe default values.

**File: `.env.example`**

```bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SymbioKnowledgeBase — Environment Variables
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Copy this file to .env and fill in the values.
# Never commit .env to version control.
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# ── Database ──────────────────────────────────────────────
# PostgreSQL connection string.
# Format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public
# For Docker Compose: use "db" as HOST (Docker service name).
# For local development: use "localhost" as HOST.
DATABASE_URL="postgresql://symbio:symbio_dev_password@localhost:5432/symbio?schema=public"

# Database password (used by Docker Compose for PostgreSQL container).
# IMPORTANT: Change this in production!
DB_PASSWORD="symbio_dev_password"

# ── Authentication ────────────────────────────────────────
# NextAuth.js secret for JWT signing.
# Generate with: openssl rand -base64 32
# IMPORTANT: Change this in production!
NEXTAUTH_SECRET="dev_secret_change_me_in_production"

# NextAuth.js URL — the canonical URL of your application.
# Must match the URL users use to access the application.
NEXTAUTH_URL="http://localhost:3000"

# ── Application ───────────────────────────────────────────
# Node environment: "development" or "production"
NODE_ENV="development"
```

---

### Step 6: Verify Docker Compose

Run the verification commands to confirm the entire stack works.

```bash
# Build and start all services
docker compose up -d --build

# Verify both containers are running
docker compose ps
# Expected: app (Up), db (Up, healthy)

# Check app logs for successful migration and startup
docker compose logs app
# Expected: "Migrations complete", "Seed complete", "Starting Next.js server"

# Verify app is accessible
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
# Expected: 200

# Verify database is accessible
docker compose exec db psql -U symbio -d symbio -c "SELECT count(*) FROM tenants;"
# Expected: count = 1

# Stop and clean up
docker compose down
```

---

## Testing Requirements

### Test File: `tests/e2e/docker.spec.ts`

End-to-end tests for the Docker Compose environment. These tests assume `docker compose up` has been run.

```typescript
import { test, expect } from "@playwright/test";

test.describe("Docker Compose Environment", () => {
  test("app is accessible at localhost:3000", async ({ page }) => {
    const response = await page.goto("http://localhost:3000");
    expect(response?.status()).toBe(200);
  });

  test("app displays SymbioKnowledgeBase heading", async ({ page }) => {
    await page.goto("http://localhost:3000");
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveText("SymbioKnowledgeBase");
  });
});
```

### Manual Verification Checklist

```bash
# 1. Build Docker images
docker compose build
# Expected: Multi-stage build completes, final image < 300MB

# 2. Start services
docker compose up -d
# Expected: Both containers start

# 3. Wait for health checks
docker compose ps
# Expected: db shows "healthy"

# 4. Check migration ran
docker compose logs app | grep "Migrations complete"
# Expected: Log line present

# 5. Check seed ran
docker compose logs app | grep "Seed complete"
# Expected: Log line present

# 6. Verify web access
curl http://localhost:3000
# Expected: HTML response with "SymbioKnowledgeBase"

# 7. Verify database connectivity
docker compose exec db psql -U symbio -d symbio -c "\dt"
# Expected: Lists all 8 tables (tenants, users, pages, blocks, etc.)

# 8. Verify data persistence across restart
docker compose down
docker compose up -d
docker compose exec db psql -U symbio -d symbio -c "SELECT count(*) FROM users;"
# Expected: count = 1 (admin user persisted)

# 9. Verify volume deletion clears data
docker compose down -v
docker compose up -d
docker compose exec db psql -U symbio -d symbio -c "SELECT count(*) FROM users;"
# Expected: count = 1 (re-seeded from scratch)

# 10. Clean up
docker compose down
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `Dockerfile` |
| CREATE | `docker-entrypoint.sh` |
| CREATE | `docker-compose.yml` |
| CREATE | `.dockerignore` |
| CREATE | `.env.example` |
| CREATE | `tests/e2e/docker.spec.ts` |

---

**Last Updated:** 2026-02-21
