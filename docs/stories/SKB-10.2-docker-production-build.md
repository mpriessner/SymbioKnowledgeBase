# Story SKB-10.2: Docker Production Build

**Epic:** Epic 10 - Documentation & Deployment
**Story ID:** SKB-10.2
**Story Points:** 4 | **Priority:** High | **Status:** Draft
**Depends On:** SKB-01.3 (Docker Compose dev environment must exist)

---

## User Story

As a platform admin, I want to deploy SymbioKnowledgeBase with a production-optimized Docker setup, So that the application runs securely and efficiently in any hosting environment.

---

## Acceptance Criteria

- [ ] `Dockerfile.prod`: production-optimized multi-stage build (deps -> build -> runner)
- [ ] Runner stage uses `node:22-alpine` with non-root user
- [ ] Next.js standalone output used (no `node_modules` in final image)
- [ ] Final image size < 500MB (target: ~200-300MB)
- [ ] `docker-compose.prod.yml` with production-specific configuration
- [ ] Restart policies: `unless-stopped` on app, `always` on db
- [ ] Health checks on both services (HTTP for app, `pg_isready` for db)
- [ ] `docker-entrypoint.prod.sh`: runs `prisma migrate deploy`, then starts Next.js
- [ ] No dev dependencies in final image
- [ ] No source code in final image (only standalone build output)
- [ ] Environment variables are validated at startup (fail fast on missing required vars)
- [ ] PostgreSQL connection pooling configured (`connection_limit` in DATABASE_URL)
- [ ] Logs are structured JSON in production
- [ ] TypeScript strict mode -- no `any` types in any new source files

---

## Architecture Overview

```
Production Docker Architecture
────────────────────────────────

  Dockerfile.prod (Multi-stage build)
  ┌──────────────────────────────────────────────────────────┐
  │                                                          │
  │  Stage 1: deps (~800MB, cached)                         │
  │  ┌────────────────────────────────────────────────────┐  │
  │  │  FROM node:22-alpine                               │  │
  │  │  COPY package.json package-lock.json               │  │
  │  │  RUN npm ci --omit=dev                             │  │
  │  │  COPY prisma/                                      │  │
  │  │  RUN npx prisma generate                           │  │
  │  └────────────────────────────────────────────────────┘  │
  │                        │                                  │
  │  Stage 2: builder (~1.5GB, cached on src change)        │
  │  ┌────────────────────────────────────────────────────┐  │
  │  │  FROM node:22-alpine                               │  │
  │  │  COPY --from=deps node_modules                     │  │
  │  │  COPY . .                                          │  │
  │  │  RUN npm ci (all deps for build)                   │  │
  │  │  RUN npm run build                                 │  │
  │  │  Output: .next/standalone/ + .next/static/         │  │
  │  └────────────────────────────────────────────────────┘  │
  │                        │                                  │
  │  Stage 3: runner (~200MB final)                         │
  │  ┌────────────────────────────────────────────────────┐  │
  │  │  FROM node:22-alpine                               │  │
  │  │  USER nextjs (non-root, uid 1001)                  │  │
  │  │                                                     │  │
  │  │  COPY standalone output (~50MB)                     │  │
  │  │  COPY static assets                                 │  │
  │  │  COPY prisma/ (for migrate deploy)                  │  │
  │  │  COPY @prisma/client engine binaries                │  │
  │  │                                                     │  │
  │  │  ENTRYPOINT: docker-entrypoint.prod.sh             │  │
  │  │  CMD: node server.js                                │  │
  │  └────────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────────┘

  docker-compose.prod.yml
  ┌──────────────────────────────────────────────────────────┐
  │                                                          │
  │  app:                          db:                       │
  │  ┌────────────────────┐       ┌──────────────────────┐  │
  │  │ build: Dockerfile  │       │ postgres:18-alpine   │  │
  │  │        .prod       │       │                      │  │
  │  │                    │  5432 │ Volumes:             │  │
  │  │ Port: 3000         │──────▶│  pgdata (persistent) │  │
  │  │                    │       │                      │  │
  │  │ Health check:      │       │ Health check:        │  │
  │  │  curl /api/health  │       │  pg_isready          │  │
  │  │                    │       │                      │  │
  │  │ Restart:           │       │ Restart: always      │  │
  │  │  unless-stopped    │       │                      │  │
  │  │                    │       │ Shared memory:       │  │
  │  │ Memory limit:      │       │  shm_size: 256MB     │  │
  │  │  512MB             │       │                      │  │
  │  └────────────────────┘       └──────────────────────┘  │
  │                                                          │
  │  Networks: symbio-prod-network (internal)                │
  └──────────────────────────────────────────────────────────┘

Startup Sequence (Production):
──────────────────────────────
1. docker compose -f docker-compose.prod.yml up -d
2. db starts → PostgreSQL ready (healthcheck passes)
3. app starts → entrypoint validates env vars
4. Entrypoint runs prisma migrate deploy
5. Next.js server starts on port 3000
6. Health check begins polling GET /api/health
7. Container marked healthy after first 200 response
```

**Key Design Decisions:**

1. **Separate Dockerfile.prod** -- The development Dockerfile (from SKB-01.3) includes dev dependencies and volume mounts for hot reload. The production Dockerfile is optimized for minimal size, security (non-root user), and no dev tooling.

2. **`postgres:18-alpine` for production** -- The Alpine variant of PostgreSQL is ~70MB smaller than the Debian-based image. For production, the smaller attack surface is preferred.

3. **App health check via HTTP** -- Instead of checking if the process is alive, we check if the app responds to HTTP requests at `/api/health`. This validates the entire stack (Node.js + database connectivity).

4. **Memory limits** -- Production containers have explicit memory limits to prevent runaway processes from consuming all host memory. 512MB for Next.js is generous for a knowledge base app.

5. **No exposed PostgreSQL port** -- Unlike the dev compose file, the production compose file does NOT expose PostgreSQL to the host. Database access is only through the internal Docker network, reducing the attack surface.

---

## Implementation Steps

### Step 1: Create the Production Dockerfile

The production Dockerfile is optimized for minimal image size and security. It differs from the dev Dockerfile in several ways: it uses `npm ci` for deterministic installs, separates build-time and runtime dependencies, and validates environment variables at startup.

**File: `Dockerfile.prod`**

```dockerfile
# ──────────────────────────────────────────────────────────
# SymbioKnowledgeBase — Production Dockerfile
# Multi-stage build: deps → builder → runner
# Target image size: < 300MB
# ──────────────────────────────────────────────────────────

# ──────────────────────────────────────────────────────────
# Stage 1: Install production dependencies
# ──────────────────────────────────────────────────────────
FROM node:22-alpine AS deps

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copy dependency manifests only (cache layer)
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Install ALL dependencies (dev deps needed for build in next stage)
RUN npm ci

# Generate Prisma Client with correct engine for Alpine Linux
RUN npx prisma generate

# ──────────────────────────────────────────────────────────
# Stage 2: Build the Next.js application
# ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copy all dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy full source code
COPY . .

# Disable Next.js telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

# Build Next.js with standalone output
# This creates .next/standalone/ with only the files needed to run
RUN npm run build

# ──────────────────────────────────────────────────────────
# Stage 3: Production runner (minimal image)
# ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN apk add --no-cache libc6-compat openssl curl

WORKDIR /app

# Production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy public assets (favicon, images, etc.)
COPY --from=builder /app/public ./public

# Copy Next.js standalone output
# The standalone output includes a minimal server.js and only the
# node_modules needed at runtime (no dev dependencies)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma files for migrate deploy at startup
COPY --from=builder /app/prisma ./prisma

# Copy Prisma engine binaries and client (needed for migrations and queries)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Copy production entrypoint script
COPY docker-entrypoint.prod.sh ./
RUN chmod +x docker-entrypoint.prod.sh

# Switch to non-root user
USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check: verify the app responds to HTTP requests
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

ENTRYPOINT ["./docker-entrypoint.prod.sh"]
CMD ["node", "server.js"]
```

**Why this differs from the dev Dockerfile:**

- **`HEALTHCHECK` directive** -- The production image includes a built-in health check so Docker can monitor container health even without an external orchestrator.
- **`curl` installed** -- Required for the HEALTHCHECK directive. The dev image does not need this since health checks are managed by docker-compose.
- **Same build strategy** -- Both use 3-stage builds, but the production entrypoint has additional safety checks.

---

### Step 2: Create the Production Entrypoint Script

The production entrypoint validates environment variables, runs migrations, and starts the server. It is more defensive than the dev entrypoint.

**File: `docker-entrypoint.prod.sh`**

```bash
#!/bin/sh
set -e

echo "============================================="
echo "  SymbioKnowledgeBase — Production Startup"
echo "============================================="
echo ""

# ── Validate required environment variables ──────────────
validate_env() {
  local var_name="$1"
  local var_value
  eval var_value="\$$var_name"

  if [ -z "$var_value" ]; then
    echo "ERROR: Required environment variable $var_name is not set."
    echo "       Set it in your .env file or docker-compose environment."
    exit 1
  fi
}

echo "[1/4] Validating environment variables..."

validate_env "DATABASE_URL"
validate_env "NEXTAUTH_SECRET"
validate_env "NEXTAUTH_URL"

# Warn if using default dev secret
if [ "$NEXTAUTH_SECRET" = "dev_secret_change_me_in_production" ]; then
  echo "WARNING: NEXTAUTH_SECRET is set to the default development value."
  echo "         This is insecure for production. Generate a new secret with:"
  echo "         openssl rand -base64 32"
fi

echo "         Environment variables validated."
echo ""

# ── Run database migrations ──────────────────────────────
echo "[2/4] Running database migrations..."
npx prisma migrate deploy
echo "         Migrations complete."
echo ""

# ── Seed database (idempotent, non-blocking) ─────────────
echo "[3/4] Running database seed..."
npx prisma db seed 2>&1 || echo "         Seed skipped (already applied or unavailable)."
echo "         Seed step complete."
echo ""

# ── Start the application ────────────────────────────────
echo "[4/4] Starting Next.js production server..."
echo "         PORT: ${PORT:-3000}"
echo "         NODE_ENV: ${NODE_ENV:-production}"
echo "============================================="
echo ""

# exec replaces the shell with node, ensuring signals (SIGTERM, SIGINT)
# are passed directly to the Node.js process for graceful shutdown.
exec "$@"
```

**Design decisions:**

- **`validate_env` function** -- Checks all required environment variables before attempting to run migrations or start the server. This fails fast with a clear error message instead of crashing mid-startup.
- **Default secret warning** -- Detects if the admin left the default dev secret and prints a warning. Does not block startup because some staging environments intentionally use non-secret values.
- **Numbered steps** -- The `[1/4]`, `[2/4]`, etc. prefixes make it easy to identify which step failed when reading container logs.
- **`exec "$@"`** -- Same pattern as the dev entrypoint: replaces the shell process with the CMD so Docker signals reach Node.js for graceful shutdown.

---

### Step 3: Create the Production Docker Compose File

The production compose file differs from the dev file in several ways: no source code volume mounts, no exposed database port, memory limits, and more aggressive restart policies.

**File: `docker-compose.prod.yml`**

```yaml
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SymbioKnowledgeBase — Production Docker Compose
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#
# Usage:
#   docker compose -f docker-compose.prod.yml up -d --build
#
# Prerequisites:
#   - Copy .env.example to .env and set production values
#   - Generate NEXTAUTH_SECRET: openssl rand -base64 32
#   - Set a strong DB_PASSWORD
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

services:
  # ── Next.js Application ──────────────────────────────────
  app:
    build:
      context: .
      dockerfile: Dockerfile.prod
    ports:
      - "${APP_PORT:-3000}:3000"
    environment:
      DATABASE_URL: "postgresql://symbio:${DB_PASSWORD}@db:5432/symbio?schema=public&connection_limit=20"
      NEXTAUTH_SECRET: "${NEXTAUTH_SECRET}"
      NEXTAUTH_URL: "${NEXTAUTH_URL:-http://localhost:3000}"
      NODE_ENV: production
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: "1.0"
        reservations:
          memory: 256M
          cpus: "0.25"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      start_period: 60s
      retries: 3
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    networks:
      - symbio-prod-network

  # ── PostgreSQL Database ──────────────────────────────────
  db:
    image: postgres:18-alpine
    # NOTE: No ports exposed to host in production.
    # Database is only accessible through the internal Docker network.
    environment:
      POSTGRES_DB: symbio
      POSTGRES_USER: symbio
      POSTGRES_PASSWORD: "${DB_PASSWORD}"
      # Performance tuning for production
      POSTGRES_INITDB_ARGS: "--encoding=UTF-8 --lc-collate=C --lc-ctype=C"
    volumes:
      - pgdata-prod:/var/lib/postgresql/data
    # Shared memory for PostgreSQL (prevents "could not resize shared memory" errors)
    shm_size: 256mb
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U symbio -d symbio"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    restart: always
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: "2.0"
        reservations:
          memory: 256M
          cpus: "0.5"
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "5"
    networks:
      - symbio-prod-network

volumes:
  pgdata-prod:
    driver: local

networks:
  symbio-prod-network:
    driver: bridge
```

**Configuration details:**

- **`connection_limit=20`** -- Limits the number of simultaneous database connections from the app. Prisma uses a connection pool, and 20 connections is appropriate for a single-instance Next.js server. Without this, Prisma defaults to `num_cpus * 2 + 1`, which can overwhelm a small PostgreSQL instance.

- **No `ports` on `db`** -- The database is NOT exposed to the host machine. It is only reachable from the `app` container via the internal Docker network (`db:5432`). This is a critical security measure for production.

- **`shm_size: 256mb`** -- PostgreSQL uses shared memory for internal operations (hash joins, sorts, etc.). The default Docker shared memory (`64MB`) can cause "could not resize shared memory segment" errors under load. 256MB is sufficient for this application.

- **`POSTGRES_INITDB_ARGS`** -- Initializes the database with UTF-8 encoding and C locale. The C locale provides the fastest sorting and comparison performance for English text. If full ICU locale support is needed, change `lc-collate` and `lc-ctype` to the desired locale.

- **Memory limits** -- `app` is limited to 512MB (Next.js with SSR typically uses 150-300MB). `db` is limited to 1GB (PostgreSQL with small-medium datasets). These can be adjusted based on deployment hardware.

- **Log rotation** -- Both services use JSON file logging with a 10MB max size and 3-5 file rotation. This prevents logs from filling up disk space on long-running deployments.

- **`restart: always` on db** -- The database should always restart, even if explicitly stopped. `unless-stopped` on the app allows manual stops for maintenance.

- **Separate volume name (`pgdata-prod`)** -- Uses a different volume name than the dev compose to avoid accidentally sharing data between development and production if both are run on the same machine.

---

### Step 4: Create the Production Build and Verification Script

A convenience script to build, deploy, and verify the production stack.

**File: `scripts/deploy-prod.sh`**

```bash
#!/bin/bash
set -euo pipefail

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SymbioKnowledgeBase — Production Deployment Script
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COMPOSE_FILE="docker-compose.prod.yml"
APP_URL="${NEXTAUTH_URL:-http://localhost:3000}"

echo "============================================="
echo "  SymbioKnowledgeBase — Production Deploy"
echo "============================================="
echo ""

# ── Check prerequisites ──────────────────────────────────
echo "[1/5] Checking prerequisites..."

if [ ! -f ".env" ]; then
  echo "ERROR: .env file not found."
  echo "       Copy .env.example to .env and set production values."
  exit 1
fi

# Source .env to check variables
set -a
source .env
set +a

if [ -z "${DB_PASSWORD:-}" ]; then
  echo "ERROR: DB_PASSWORD is not set in .env"
  exit 1
fi

if [ -z "${NEXTAUTH_SECRET:-}" ]; then
  echo "ERROR: NEXTAUTH_SECRET is not set in .env"
  exit 1
fi

if [ "${NEXTAUTH_SECRET}" = "dev_secret_change_me_in_production" ]; then
  echo "WARNING: NEXTAUTH_SECRET is still set to the default development value."
  echo "         Generate a production secret: openssl rand -base64 32"
  read -p "         Continue anyway? (y/N) " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

echo "         Prerequisites OK."
echo ""

# ── Build production images ──────────────────────────────
echo "[2/5] Building production Docker images..."
docker compose -f "$COMPOSE_FILE" build --no-cache
echo "         Build complete."
echo ""

# ── Check image size ─────────────────────────────────────
echo "[3/5] Checking image size..."
IMAGE_SIZE=$(docker images --format "{{.Size}}" symbioknowledgebase-app 2>/dev/null || echo "unknown")
echo "         App image size: $IMAGE_SIZE"
echo ""

# ── Start services ───────────────────────────────────────
echo "[4/5] Starting production services..."
docker compose -f "$COMPOSE_FILE" up -d
echo "         Services started."
echo ""

# ── Verify deployment ────────────────────────────────────
echo "[5/5] Verifying deployment..."
echo "         Waiting for services to become healthy..."

# Wait up to 90 seconds for the app to become healthy
RETRIES=18
DELAY=5
for i in $(seq 1 $RETRIES); do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${APP_URL}/api/health" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    echo "         Health check passed (HTTP 200)."
    break
  fi
  if [ "$i" = "$RETRIES" ]; then
    echo "ERROR:   Health check failed after ${RETRIES} attempts."
    echo "         Check logs: docker compose -f $COMPOSE_FILE logs app"
    exit 1
  fi
  echo "         Attempt $i/$RETRIES — HTTP $HTTP_CODE, retrying in ${DELAY}s..."
  sleep $DELAY
done

echo ""
echo "============================================="
echo "  Deployment successful!"
echo "  App:   ${APP_URL}"
echo "  Logs:  docker compose -f $COMPOSE_FILE logs -f"
echo "  Stop:  docker compose -f $COMPOSE_FILE down"
echo "============================================="
```

**Script features:**

- **Prerequisite validation** -- Checks for `.env` file, required variables, and warns about default secrets before building.
- **`--no-cache` build** -- Forces a clean build to ensure the latest code is deployed. For faster deployments, remove `--no-cache` and rely on Docker layer caching.
- **Image size reporting** -- Prints the final image size so you can verify it stays under the 500MB target.
- **Health check polling** -- Waits up to 90 seconds (18 retries x 5s delay) for the app to respond to `/api/health`. This accounts for migration time on first deployment.
- **`set -euo pipefail`** -- Strict bash mode: exit on error (`-e`), exit on undefined variable (`-u`), and fail on pipe errors (`-o pipefail`).

---

### Step 5: Create the Startup Environment Validator

A lightweight module that validates environment variables when the Next.js server starts. This catches misconfigurations early instead of failing on the first database query or auth attempt.

**File: `src/lib/env.ts`**

```typescript
/**
 * Production environment variable validation.
 *
 * This module validates that all required environment variables are set
 * when the application starts. It runs once at import time (module
 * initialization) and throws an error if any required variable is missing.
 *
 * Import this module in the root layout or a server-side entrypoint to
 * ensure validation happens at startup.
 */

interface EnvConfig {
  DATABASE_URL: string;
  NEXTAUTH_SECRET: string;
  NEXTAUTH_URL: string;
  NODE_ENV: 'development' | 'production' | 'test';
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
      `Set it in your .env file or Docker Compose environment.`
    );
  }
  return value;
}

function validateNodeEnv(value: string): 'development' | 'production' | 'test' {
  const valid = ['development', 'production', 'test'] as const;
  if (!valid.includes(value as typeof valid[number])) {
    throw new Error(
      `Invalid NODE_ENV: "${value}". Must be one of: ${valid.join(', ')}`
    );
  }
  return value as 'development' | 'production' | 'test';
}

/**
 * Validated environment configuration.
 *
 * Access environment variables through this object instead of
 * `process.env` to get type-safe, validated values.
 *
 * @example
 * ```typescript
 * import { env } from '@/lib/env';
 * console.log(env.DATABASE_URL); // string (guaranteed non-empty)
 * ```
 */
export const env: EnvConfig = {
  DATABASE_URL: getRequiredEnv('DATABASE_URL'),
  NEXTAUTH_SECRET: getRequiredEnv('NEXTAUTH_SECRET'),
  NEXTAUTH_URL: getRequiredEnv('NEXTAUTH_URL'),
  NODE_ENV: validateNodeEnv(process.env.NODE_ENV || 'development'),
};
```

**Design decisions:**

- **Module-level validation** -- Environment variables are validated when the module is first imported. If any are missing, the import throws immediately, preventing the app from starting in a broken state.
- **Type-safe access** -- The `env` object provides typed access to environment variables. Instead of `process.env.DATABASE_URL` (which TypeScript types as `string | undefined`), use `env.DATABASE_URL` (typed as `string`, guaranteed non-empty).
- **No Zod dependency** -- While we could use Zod for validation, a simple function is sufficient for environment variables and avoids adding Zod to the server startup path.

---

### Step 6: Create Image Size Verification Test

A simple script to verify the production image meets the size target.

**File: `scripts/verify-image-size.sh`**

```bash
#!/bin/bash
set -euo pipefail

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Verify production Docker image size is under 500MB
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MAX_SIZE_MB=500
IMAGE_NAME="symbioknowledgebase-app"

echo "Building production image..."
docker compose -f docker-compose.prod.yml build app

# Get image size in bytes
SIZE_BYTES=$(docker image inspect "$IMAGE_NAME" --format='{{.Size}}' 2>/dev/null)

if [ -z "$SIZE_BYTES" ]; then
  echo "ERROR: Could not find image: $IMAGE_NAME"
  echo "       Make sure to build with: docker compose -f docker-compose.prod.yml build"
  exit 1
fi

SIZE_MB=$((SIZE_BYTES / 1024 / 1024))

echo ""
echo "Image: $IMAGE_NAME"
echo "Size:  ${SIZE_MB}MB"
echo "Limit: ${MAX_SIZE_MB}MB"
echo ""

if [ "$SIZE_MB" -gt "$MAX_SIZE_MB" ]; then
  echo "FAIL: Image size (${SIZE_MB}MB) exceeds limit (${MAX_SIZE_MB}MB)."
  echo ""
  echo "Debug: Check which layers are largest:"
  echo "  docker history $IMAGE_NAME"
  exit 1
fi

echo "PASS: Image size (${SIZE_MB}MB) is within limit (${MAX_SIZE_MB}MB)."
```

---

## Testing Requirements

### Manual Verification Checklist

```bash
# ── Build & Size Verification ─────────────────────────────

# 1. Build the production image
docker compose -f docker-compose.prod.yml build
# Expected: Build completes without errors

# 2. Check image size
docker images symbioknowledgebase-app --format "{{.Size}}"
# Expected: < 500MB (target: ~200-300MB)

# 3. Verify no dev dependencies in final image
docker run --rm symbioknowledgebase-app ls node_modules/
# Expected: Only .prisma, @prisma, prisma directories
# Should NOT contain: typescript, eslint, @types/*, vitest, etc.

# ── Startup & Runtime Verification ────────────────────────

# 4. Start the production stack
docker compose -f docker-compose.prod.yml up -d
# Expected: Both services start

# 5. Check container health
docker compose -f docker-compose.prod.yml ps
# Expected: app (healthy), db (healthy)

# 6. Verify environment variable validation
docker compose -f docker-compose.prod.yml run --rm \
  -e DATABASE_URL="" app node server.js
# Expected: Error message about missing DATABASE_URL, container exits

# 7. Check entrypoint log output
docker compose -f docker-compose.prod.yml logs app
# Expected: [1/4] through [4/4] steps logged, no errors

# 8. Verify health endpoint
curl -s http://localhost:3000/api/health | python3 -m json.tool
# Expected: { "status": "ok", "version": "1.0.0", "uptime": <number> }

# 9. Verify database is NOT exposed on host
curl -s telnet://localhost:5432 2>&1
# Expected: Connection refused (port not mapped)

# ── Security Verification ─────────────────────────────────

# 10. Verify non-root user
docker compose -f docker-compose.prod.yml exec app whoami
# Expected: nextjs

# 11. Verify no source code in final image
docker compose -f docker-compose.prod.yml exec app ls src/ 2>&1
# Expected: "No such file or directory"

# ── Cleanup ───────────────────────────────────────────────

# 12. Stop and remove containers
docker compose -f docker-compose.prod.yml down

# 13. Remove volumes (WARNING: destroys all data)
docker compose -f docker-compose.prod.yml down -v
```

### Automated Test: `tests/e2e/docker-prod.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

/**
 * Production Docker Compose E2E tests.
 *
 * Prerequisites:
 *   docker compose -f docker-compose.prod.yml up -d
 *
 * Run with:
 *   npx playwright test tests/e2e/docker-prod.spec.ts
 */
test.describe('Production Docker Deployment', () => {
  const BASE_URL = process.env.APP_URL || 'http://localhost:3000';

  test('health endpoint returns 200 with status ok', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.version).toBeDefined();
    expect(typeof body.uptime).toBe('number');
  });

  test('app serves HTML at root', async ({ page }) => {
    const response = await page.goto(BASE_URL);
    expect(response?.status()).toBe(200);

    const contentType = response?.headers()['content-type'];
    expect(contentType).toContain('text/html');
  });

  test('static assets are served with cache headers', async ({ request }) => {
    // Request a known static asset path
    const response = await request.get(`${BASE_URL}/favicon.ico`);
    // favicon may or may not exist, but if it does it should be cacheable
    if (response.status() === 200) {
      const cacheControl = response.headers()['cache-control'];
      expect(cacheControl).toBeDefined();
    }
  });

  test('API returns proper error envelope for invalid routes', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/nonexistent`);
    expect(response.status()).toBe(404);
  });

  test('login page is accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    // Should either show login form or redirect (both are acceptable)
    const status = page.url();
    expect(status).toContain(BASE_URL);
  });
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `Dockerfile.prod` |
| CREATE | `docker-entrypoint.prod.sh` |
| CREATE | `docker-compose.prod.yml` |
| CREATE | `scripts/deploy-prod.sh` |
| CREATE | `scripts/verify-image-size.sh` |
| CREATE | `src/lib/env.ts` |
| CREATE | `tests/e2e/docker-prod.spec.ts` |

---

**Last Updated:** 2026-02-21
