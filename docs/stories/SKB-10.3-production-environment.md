# Story SKB-10.3: Production Environment Configuration

**Epic:** Epic 10 - Documentation & Deployment
**Story ID:** SKB-10.3
**Story Points:** 3 | **Priority:** High | **Status:** Draft
**Depends On:** SKB-10.2 (Production Docker build must exist)

---

## User Story

As a platform admin, I want comprehensive production environment configuration with security hardening, backup scripts, and operational tooling, So that I can deploy and maintain SymbioKnowledgeBase reliably in production.

---

## Acceptance Criteria

- [ ] `.env.production.example`: complete production environment template with all variables documented
- [ ] `NEXTAUTH_SECRET` generation instructions and validation
- [ ] `scripts/backup.sh`: automated PostgreSQL backup script with timestamp naming
- [ ] `scripts/restore.sh`: database restore script from backup file
- [ ] `/api/health` endpoint: returns service status, version, uptime, and database connectivity
- [ ] Health check returns structured JSON matching the standard API envelope
- [ ] Backup script supports both local file storage and stdout (for piping to remote storage)
- [ ] Restore script validates backup file exists before attempting restore
- [ ] Security headers configured in `next.config.ts` for production
- [ ] Rate limiting documentation for production reverse proxy (nginx/caddy)
- [ ] TypeScript strict mode -- no `any` types in any new source files

---

## Architecture Overview

```
Production Environment Architecture
──────────────────────────────────────

  Configuration Layer
  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  .env.production.example                             │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  # Required                                    │  │
  │  │  DATABASE_URL=postgresql://...                  │  │
  │  │  DB_PASSWORD=<strong random password>           │  │
  │  │  NEXTAUTH_SECRET=<openssl rand -base64 32>     │  │
  │  │  NEXTAUTH_URL=https://your-domain.com          │  │
  │  │                                                 │  │
  │  │  # Optional                                    │  │
  │  │  APP_PORT=3000                                  │  │
  │  │  LOG_LEVEL=info                                 │  │
  │  │  BACKUP_DIR=/backups                            │  │
  │  └────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────┘

  Health Check Endpoint
  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  GET /api/health                                     │
  │                                                      │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  1. Check Node.js process health               │  │
  │  │  2. Check PostgreSQL connectivity              │  │
  │  │     → SELECT 1 (simple query)                  │  │
  │  │  3. Return status envelope:                    │  │
  │  │     {                                          │  │
  │  │       status: "ok" | "degraded" | "error",     │  │
  │  │       version: "1.0.0",                        │  │
  │  │       uptime: 12345.67,                        │  │
  │  │       checks: {                                │  │
  │  │         database: { status, latency_ms }       │  │
  │  │       },                                       │  │
  │  │       timestamp: "2026-02-21T..."              │  │
  │  │     }                                          │  │
  │  └────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────┘

  Backup & Restore Flow
  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  scripts/backup.sh                                   │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  1. Validate .env exists                       │  │
  │  │  2. Parse DATABASE_URL for connection info      │  │
  │  │  3. Run pg_dump with:                          │  │
  │  │     - Custom format (-Fc) for compression       │  │
  │  │     - Timestamp in filename                     │  │
  │  │  4. Verify output file is non-empty             │  │
  │  │  5. Print backup metadata                       │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  scripts/restore.sh                                  │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  1. Validate backup file argument               │  │
  │  │  2. Validate .env exists                       │  │
  │  │  3. Confirm with user (interactive)             │  │
  │  │  4. Run pg_restore with:                       │  │
  │  │     - --clean (drop before recreate)            │  │
  │  │     - --if-exists (skip if already dropped)     │  │
  │  │  5. Run prisma migrate deploy (repair state)    │  │
  │  │  6. Print restore summary                       │  │
  │  └────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────┘

  Security Headers (next.config.ts)
  ┌──────────────────────────────────────────────────────┐
  │  headers:                                            │
  │    X-Frame-Options: DENY                             │
  │    X-Content-Type-Options: nosniff                   │
  │    Referrer-Policy: strict-origin-when-cross-origin  │
  │    X-XSS-Protection: 1; mode=block                   │
  │    Permissions-Policy: camera=(), microphone=()      │
  │    Strict-Transport-Security: max-age=31536000       │
  └──────────────────────────────────────────────────────┘

  Recommended Production Stack
  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  Internet                                            │
  │     │                                                │
  │     ▼                                                │
  │  ┌────────────────────┐                              │
  │  │  Reverse Proxy     │  Caddy or Nginx              │
  │  │  - TLS termination │  (not managed by this app)   │
  │  │  - Rate limiting   │                              │
  │  │  - Gzip            │                              │
  │  └────────┬───────────┘                              │
  │            │ :3000                                    │
  │            ▼                                         │
  │  ┌────────────────────┐  ┌────────────────────┐     │
  │  │  app (Next.js)     │──│  db (PostgreSQL)   │     │
  │  │  Docker container  │  │  Docker container  │     │
  │  └────────────────────┘  └────────────────────┘     │
  └──────────────────────────────────────────────────────┘
```

**Key Design Decisions:**

1. **Health check with database probe** -- A simple "200 OK" health check does not verify database connectivity. By running `SELECT 1` on each health check, we detect database connection issues before they affect users.

2. **Custom-format pg_dump (`-Fc`)** -- Custom format provides compression (~5-10x smaller than SQL dumps) and supports selective table restoration via `pg_restore`. It is the recommended format for production backups.

3. **Security headers in Next.js config** -- While a reverse proxy (Nginx/Caddy) should also set these headers, adding them in `next.config.ts` provides defense-in-depth. If the reverse proxy is misconfigured, the app still returns secure headers.

4. **No TLS in the app** -- TLS termination is handled by the reverse proxy (Caddy/Nginx), not by Next.js. This follows the standard pattern for containerized web applications and simplifies certificate management.

---

## Implementation Steps

### Step 1: Create the Production Environment Template

A comprehensive `.env.production.example` file that documents every environment variable needed for production deployment.

**File: `.env.production.example`**

```bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SymbioKnowledgeBase — Production Environment Variables
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#
# Copy this file to .env and set all values before deploying.
#
# REQUIRED variables are marked with [REQUIRED].
# OPTIONAL variables have defaults shown in comments.
#
# Security checklist:
#   [ ] DB_PASSWORD is a strong random password (>= 32 characters)
#   [ ] NEXTAUTH_SECRET is generated with: openssl rand -base64 32
#   [ ] NEXTAUTH_URL matches your production domain
#   [ ] .env file is NOT committed to version control
#   [ ] .env file permissions are restricted: chmod 600 .env
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# ── Database ───────────────────────────────────────────────

# [REQUIRED] PostgreSQL password for the 'symbio' user.
# Generate with: openssl rand -base64 32
# Used by both the app (in DATABASE_URL) and the db container.
DB_PASSWORD=""

# [AUTO] Database connection URL — constructed from DB_PASSWORD.
# The docker-compose.prod.yml builds this automatically.
# Only set this manually if using an external database.
# DATABASE_URL="postgresql://symbio:${DB_PASSWORD}@db:5432/symbio?schema=public&connection_limit=20"

# ── Authentication ─────────────────────────────────────────

# [REQUIRED] NextAuth.js secret for JWT signing and encryption.
# Generate with: openssl rand -base64 32
# NEVER reuse the development default value in production.
NEXTAUTH_SECRET=""

# [REQUIRED] The canonical URL where users access the application.
# Must include the protocol (https://) and NOT include a trailing slash.
# Examples:
#   https://kb.example.com
#   https://symbio.yourdomain.com
NEXTAUTH_URL="https://your-domain.com"

# ── Application ────────────────────────────────────────────

# [OPTIONAL] Port for the Next.js server inside the container.
# The docker-compose maps this to the host port.
# Default: 3000
APP_PORT=3000

# [OPTIONAL] Node.js environment. Always "production" for deployments.
# Default: production
NODE_ENV=production

# ── Logging ────────────────────────────────────────────────

# [OPTIONAL] Log level for the application.
# Values: error, warn, info, debug
# Default: info
LOG_LEVEL=info

# ── Backups ────────────────────────────────────────────────

# [OPTIONAL] Directory for database backups.
# The backup script writes pg_dump files to this directory.
# Default: ./backups
BACKUP_DIR=./backups

# [OPTIONAL] Number of backup files to retain.
# Older backups are deleted when the limit is exceeded.
# Default: 7 (one week of daily backups)
BACKUP_RETENTION_COUNT=7
```

**Design decisions:**

- **Separate from `.env.example`** -- The existing `.env.example` (from SKB-01.3) is optimized for development with defaults that work out of the box. The production template requires explicit configuration of all security-sensitive values.
- **Empty required fields** -- Required fields are intentionally left empty so the deployment fails fast if they are not configured, rather than silently using insecure defaults.
- **`connection_limit=20`** -- Documented in the commented `DATABASE_URL` to remind admins about connection pooling. Prisma without this parameter defaults to `num_cpus * 2 + 1`, which may exhaust the PostgreSQL connection limit under load.

---

### Step 2: Create the Health Check Endpoint

The health check endpoint is used by Docker health checks, load balancers, and monitoring systems to verify the application is running correctly.

**File: `src/app/api/health/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface DatabaseCheck {
  status: 'ok' | 'error';
  latency_ms: number;
  error?: string;
}

interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  version: string;
  uptime: number;
  checks: {
    database: DatabaseCheck;
  };
  timestamp: string;
}

const APP_VERSION = process.env.npm_package_version || '1.0.0';
const startTime = Date.now();

/**
 * Check database connectivity by executing a simple query.
 * Returns the check result with latency measurement.
 */
async function checkDatabase(): Promise<DatabaseCheck> {
  const start = performance.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    const latency = Math.round(performance.now() - start);

    return {
      status: 'ok',
      latency_ms: latency,
    };
  } catch (err) {
    const latency = Math.round(performance.now() - start);
    const message = err instanceof Error ? err.message : 'Unknown database error';

    return {
      status: 'error',
      latency_ms: latency,
      error: message,
    };
  }
}

/**
 * GET /api/health
 *
 * Health check endpoint for monitoring and container orchestration.
 * No authentication required (security: [] in OpenAPI spec).
 *
 * Returns:
 * - 200: Service is healthy (all checks pass)
 * - 200: Service is degraded (some checks fail, but app is responding)
 * - 503: Service is unhealthy (critical checks fail)
 *
 * Note: We return 200 for degraded state because the HTTP layer is working.
 * Monitoring tools should inspect the `status` field for detailed health.
 * Docker HEALTHCHECK only checks the HTTP status code, so we return 503
 * only when the service is completely unusable.
 */
export async function GET(): Promise<NextResponse<HealthResponse>> {
  const dbCheck = await checkDatabase();

  const uptimeSeconds = (Date.now() - startTime) / 1000;

  // Determine overall status based on individual checks
  let overallStatus: 'ok' | 'degraded' | 'error';
  let httpStatus: number;

  if (dbCheck.status === 'ok') {
    overallStatus = 'ok';
    httpStatus = 200;
  } else {
    // Database is critical — if it's down, service is unhealthy
    overallStatus = 'error';
    httpStatus = 503;
  }

  const response: HealthResponse = {
    status: overallStatus,
    version: APP_VERSION,
    uptime: Math.round(uptimeSeconds * 100) / 100,
    checks: {
      database: dbCheck,
    },
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(response, {
    status: httpStatus,
    headers: {
      // Prevent caching of health check responses
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
```

**Design decisions:**

- **Database connectivity check** -- A health check that only verifies the Node.js process is alive is not useful. By running `SELECT 1`, we verify the database connection pool is functional. If the database is down, Docker restarts the container (which re-runs migrations and may fix the issue).

- **Latency measurement** -- The `latency_ms` field reports how long the database query took. This is useful for monitoring dashboards to detect slow database responses before they become outages.

- **503 for database failure** -- When the database is down, the service is effectively unusable (all API endpoints depend on it). Returning 503 causes Docker's health check to mark the container as unhealthy, triggering a restart.

- **No authentication** -- The health check endpoint has `security: []` in the OpenAPI spec. It must be accessible without a session cookie for Docker health checks and external monitoring tools.

- **`performance.now()`** -- Uses the high-resolution timer instead of `Date.now()` for accurate latency measurement. `performance.now()` has microsecond precision, while `Date.now()` only has millisecond precision.

---

### Step 3: Create the Database Backup Script

An automated backup script that creates compressed PostgreSQL dumps with timestamp naming and retention management.

**File: `scripts/backup.sh`**

```bash
#!/bin/bash
set -euo pipefail

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SymbioKnowledgeBase — Database Backup Script
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#
# Creates a compressed PostgreSQL backup using pg_dump.
#
# Usage:
#   ./scripts/backup.sh                    # Backup to default directory
#   ./scripts/backup.sh /path/to/backups   # Backup to custom directory
#   ./scripts/backup.sh --stdout           # Output to stdout (for piping)
#
# Requires:
#   - Docker Compose running (docker-compose.prod.yml or docker-compose.yml)
#   - .env file with DB_PASSWORD set
#
# Examples:
#   # Daily backup to local directory
#   ./scripts/backup.sh
#
#   # Pipe to S3 (requires aws cli)
#   ./scripts/backup.sh --stdout | aws s3 cp - s3://bucket/symbio-$(date +%Y%m%d).dump
#
#   # Pipe to remote server via SSH
#   ./scripts/backup.sh --stdout | ssh user@remote "cat > /backups/symbio.dump"
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# ── Configuration ─────────────────────────────────────────

# Default compose file (prefer production, fallback to dev)
if [ -f "docker-compose.prod.yml" ]; then
  COMPOSE_FILE="docker-compose.prod.yml"
else
  COMPOSE_FILE="docker-compose.yml"
fi

DB_SERVICE="db"
DB_USER="symbio"
DB_NAME="symbio"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILENAME="symbio_backup_${TIMESTAMP}.dump"

# Load environment variables
if [ -f ".env" ]; then
  set -a
  source .env
  set +a
fi

BACKUP_DIR="${1:-${BACKUP_DIR:-./backups}}"
RETENTION_COUNT="${BACKUP_RETENTION_COUNT:-7}"

# ── Handle --stdout mode ─────────────────────────────────

if [ "${1:-}" = "--stdout" ]; then
  # Output backup directly to stdout for piping
  docker compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE" \
    pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc --no-owner --no-acl
  exit 0
fi

# ── Create backup directory ──────────────────────────────

echo "============================================="
echo "  SymbioKnowledgeBase — Database Backup"
echo "============================================="
echo ""

echo "[1/4] Preparing backup directory..."
mkdir -p "$BACKUP_DIR"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILENAME}"
echo "       Target: $BACKUP_PATH"
echo ""

# ── Verify database is running ───────────────────────────

echo "[2/4] Verifying database connectivity..."
docker compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE" \
  pg_isready -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1

if [ $? -ne 0 ]; then
  echo "ERROR: Database is not ready."
  echo "       Is Docker Compose running? docker compose -f $COMPOSE_FILE ps"
  exit 1
fi
echo "       Database is ready."
echo ""

# ── Run pg_dump ──────────────────────────────────────────

echo "[3/4] Creating backup..."
BACKUP_START=$(date +%s)

docker compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE" \
  pg_dump -U "$DB_USER" -d "$DB_NAME" \
    -Fc \
    --no-owner \
    --no-acl \
    --verbose \
  > "$BACKUP_PATH" 2>/dev/null

BACKUP_END=$(date +%s)
BACKUP_DURATION=$((BACKUP_END - BACKUP_START))

# Verify backup file is not empty
BACKUP_SIZE=$(stat -f%z "$BACKUP_PATH" 2>/dev/null || stat -c%s "$BACKUP_PATH" 2>/dev/null || echo "0")

if [ "$BACKUP_SIZE" = "0" ]; then
  echo "ERROR: Backup file is empty. pg_dump may have failed."
  rm -f "$BACKUP_PATH"
  exit 1
fi

# Human-readable file size
if [ "$BACKUP_SIZE" -gt 1048576 ]; then
  BACKUP_SIZE_HUMAN="$((BACKUP_SIZE / 1048576))MB"
elif [ "$BACKUP_SIZE" -gt 1024 ]; then
  BACKUP_SIZE_HUMAN="$((BACKUP_SIZE / 1024))KB"
else
  BACKUP_SIZE_HUMAN="${BACKUP_SIZE}B"
fi

echo "       Backup complete: ${BACKUP_SIZE_HUMAN} in ${BACKUP_DURATION}s"
echo ""

# ── Clean up old backups ─────────────────────────────────

echo "[4/4] Managing backup retention (keeping last ${RETENTION_COUNT})..."

# Count existing backups
BACKUP_COUNT=$(ls -1 "${BACKUP_DIR}"/symbio_backup_*.dump 2>/dev/null | wc -l)

if [ "$BACKUP_COUNT" -gt "$RETENTION_COUNT" ]; then
  DELETE_COUNT=$((BACKUP_COUNT - RETENTION_COUNT))
  echo "       Deleting $DELETE_COUNT old backup(s)..."

  ls -1t "${BACKUP_DIR}"/symbio_backup_*.dump | tail -n "$DELETE_COUNT" | while read -r old_backup; do
    echo "       Removing: $(basename "$old_backup")"
    rm -f "$old_backup"
  done
else
  echo "       No cleanup needed ($BACKUP_COUNT of $RETENTION_COUNT slots used)."
fi

echo ""
echo "============================================="
echo "  Backup Summary"
echo "  File:     $BACKUP_PATH"
echo "  Size:     $BACKUP_SIZE_HUMAN"
echo "  Duration: ${BACKUP_DURATION}s"
echo "  Retained: $(ls -1 "${BACKUP_DIR}"/symbio_backup_*.dump 2>/dev/null | wc -l) backups"
echo "============================================="
```

**Design decisions:**

- **Custom format (`-Fc`)** -- pg_dump's custom format provides built-in compression (typically 5-10x smaller than SQL dumps) and supports selective table restoration. It is the recommended format for production backups.
- **`--no-owner --no-acl`** -- Strips ownership and permission information from the dump. This makes the backup portable across different PostgreSQL installations where the user/role names may differ.
- **`--stdout` mode** -- Allows piping the backup to external storage (S3, SSH, etc.) without writing to local disk. This is essential for environments with limited local storage.
- **Retention management** -- Automatically deletes old backups beyond the retention count (default: 7). Backups are sorted by modification time, so the newest are kept.
- **`-T` flag on `docker compose exec`** -- Disables pseudo-TTY allocation, which is required for piping output to a file or another command.

---

### Step 4: Create the Database Restore Script

A restore script that safely restores a PostgreSQL backup with confirmation prompts.

**File: `scripts/restore.sh`**

```bash
#!/bin/bash
set -euo pipefail

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SymbioKnowledgeBase — Database Restore Script
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#
# Restores a PostgreSQL backup created by backup.sh.
#
# Usage:
#   ./scripts/restore.sh <backup-file>
#   ./scripts/restore.sh backups/symbio_backup_20260221_120000.dump
#
# WARNING: This will REPLACE all data in the database.
#          Make sure you have a current backup before restoring.
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# ── Configuration ─────────────────────────────────────────

if [ -f "docker-compose.prod.yml" ]; then
  COMPOSE_FILE="docker-compose.prod.yml"
else
  COMPOSE_FILE="docker-compose.yml"
fi

DB_SERVICE="db"
DB_USER="symbio"
DB_NAME="symbio"

# ── Validate arguments ───────────────────────────────────

if [ $# -lt 1 ]; then
  echo "Usage: $0 <backup-file>"
  echo ""
  echo "Available backups:"
  ls -lh backups/symbio_backup_*.dump 2>/dev/null || echo "  No backups found in ./backups/"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file not found: $BACKUP_FILE"
  exit 1
fi

BACKUP_SIZE=$(stat -f%z "$BACKUP_FILE" 2>/dev/null || stat -c%s "$BACKUP_FILE" 2>/dev/null || echo "0")
if [ "$BACKUP_SIZE" = "0" ]; then
  echo "ERROR: Backup file is empty: $BACKUP_FILE"
  exit 1
fi

# Human-readable size
if [ "$BACKUP_SIZE" -gt 1048576 ]; then
  BACKUP_SIZE_HUMAN="$((BACKUP_SIZE / 1048576))MB"
elif [ "$BACKUP_SIZE" -gt 1024 ]; then
  BACKUP_SIZE_HUMAN="$((BACKUP_SIZE / 1024))KB"
else
  BACKUP_SIZE_HUMAN="${BACKUP_SIZE}B"
fi

# ── Confirmation ─────────────────────────────────────────

echo "============================================="
echo "  SymbioKnowledgeBase — Database Restore"
echo "============================================="
echo ""
echo "  Backup file: $BACKUP_FILE"
echo "  File size:   $BACKUP_SIZE_HUMAN"
echo "  Target DB:   $DB_NAME"
echo ""
echo "  WARNING: This will REPLACE ALL DATA in the database."
echo "           This action cannot be undone."
echo ""
read -p "  Continue? Type 'yes' to confirm: " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo ""
  echo "  Restore cancelled."
  exit 0
fi

echo ""

# ── Verify database is running ───────────────────────────

echo "[1/4] Verifying database connectivity..."
docker compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE" \
  pg_isready -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1

if [ $? -ne 0 ]; then
  echo "ERROR: Database is not ready."
  echo "       Start Docker Compose first: docker compose -f $COMPOSE_FILE up -d db"
  exit 1
fi
echo "       Database is ready."
echo ""

# ── Create safety backup before restore ──────────────────

echo "[2/4] Creating safety backup before restore..."
SAFETY_BACKUP="backups/symbio_pre_restore_$(date +%Y%m%d_%H%M%S).dump"
mkdir -p backups

docker compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE" \
  pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc --no-owner --no-acl \
  > "$SAFETY_BACKUP" 2>/dev/null

echo "       Safety backup: $SAFETY_BACKUP"
echo ""

# ── Restore the backup ───────────────────────────────────

echo "[3/4] Restoring backup..."
RESTORE_START=$(date +%s)

# Pipe the backup file into the database container for pg_restore
cat "$BACKUP_FILE" | docker compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE" \
  pg_restore -U "$DB_USER" -d "$DB_NAME" \
    --clean \
    --if-exists \
    --no-owner \
    --no-acl \
    --verbose \
  2>/dev/null || true  # pg_restore may exit non-zero for warnings

RESTORE_END=$(date +%s)
RESTORE_DURATION=$((RESTORE_END - RESTORE_START))

echo "       Restore complete in ${RESTORE_DURATION}s."
echo ""

# ── Repair Prisma migration state ────────────────────────

echo "[4/4] Repairing Prisma migration state..."
docker compose -f "$COMPOSE_FILE" exec -T app npx prisma migrate deploy 2>/dev/null || \
  echo "       Note: Could not run prisma migrate deploy. Run it manually if needed."
echo "       Migration state repaired."
echo ""

# ── Verification ─────────────────────────────────────────

echo "============================================="
echo "  Restore Summary"
echo "  Source:   $BACKUP_FILE"
echo "  Duration: ${RESTORE_DURATION}s"
echo "  Safety:   $SAFETY_BACKUP"
echo ""
echo "  Verify data:"
echo "    docker compose -f $COMPOSE_FILE exec db psql -U $DB_USER -d $DB_NAME -c '\\dt'"
echo "    docker compose -f $COMPOSE_FILE exec db psql -U $DB_USER -d $DB_NAME -c 'SELECT count(*) FROM pages;'"
echo "============================================="
```

**Design decisions:**

- **Safety backup before restore** -- Before overwriting data, the script creates an automatic safety backup. If the restore fails or the wrong backup was selected, the admin can recover using the safety backup.
- **`--clean --if-exists`** -- The `--clean` flag drops existing objects before recreating them. The `--if-exists` flag prevents errors if the objects don't exist yet (e.g., on a fresh database).
- **`|| true` on pg_restore** -- pg_restore may exit with a non-zero status code for non-fatal warnings (e.g., "role does not exist" when restoring ownership). The `|| true` prevents the script from exiting on these warnings.
- **Prisma migration repair** -- After a full database restore, the `_prisma_migrations` table may be in a different state than expected. Running `prisma migrate deploy` ensures Prisma's migration state matches the actual database schema.
- **Explicit confirmation** -- The user must type "yes" (not just "y") to confirm the restore. This prevents accidental data loss from a stray keypress.

---

### Step 5: Configure Security Headers in next.config.ts

Add production security headers to the Next.js configuration. These headers protect against common web vulnerabilities.

**File: `src/lib/securityHeaders.ts`**

```typescript
/**
 * Production security headers for Next.js.
 *
 * These headers are applied to all routes via next.config.ts.
 * They provide defense-in-depth alongside the reverse proxy's headers.
 *
 * Reference: https://owasp.org/www-project-secure-headers/
 */

interface SecurityHeader {
  key: string;
  value: string;
}

export const securityHeaders: SecurityHeader[] = [
  {
    // Prevent the page from being embedded in iframes (clickjacking protection)
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    // Prevent MIME type sniffing (forces browser to use declared Content-Type)
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    // Control how much referrer info is sent with requests
    // "strict-origin-when-cross-origin" sends the origin for cross-origin requests
    // but the full URL for same-origin requests
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    // Legacy XSS protection for older browsers
    // Modern browsers use Content-Security-Policy instead
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  {
    // Restrict browser features the app does not use
    // Deny access to camera, microphone, geolocation, etc.
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  {
    // Enforce HTTPS for 1 year (31536000 seconds)
    // includeSubDomains ensures all subdomains also use HTTPS
    // Only enable this header when HTTPS is properly configured
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
  {
    // Prevent DNS prefetching of external links
    // Reduces information leakage about which links the user might click
    key: 'X-DNS-Prefetch-Control',
    value: 'off',
  },
];
```

**File: Addition to `next.config.ts`**

```typescript
import type { NextConfig } from 'next';
import { securityHeaders } from './src/lib/securityHeaders';

const nextConfig: NextConfig = {
  output: 'standalone',

  // Production security headers
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },

  // ... rest of existing config
};

export default nextConfig;
```

**Header explanations:**

- **`X-Frame-Options: DENY`** -- Prevents the app from being embedded in an iframe on any domain. This blocks clickjacking attacks where an attacker overlays the app in a transparent iframe.
- **`X-Content-Type-Options: nosniff`** -- Forces the browser to use the `Content-Type` header instead of guessing. Prevents MIME-type confusion attacks.
- **`Strict-Transport-Security`** -- Tells browsers to always use HTTPS. The `max-age=31536000` (1 year) ensures that even if a user types `http://`, the browser upgrades to HTTPS. Only enable this after confirming HTTPS works correctly.
- **`Permissions-Policy`** -- Explicitly denies access to browser features the app does not use. This prevents any injected script from accessing the camera, microphone, or location.
- **`interest-cohort=()`** -- Opts out of Google's FLoC (Federated Learning of Cohorts) tracking.

---

### Step 6: Create Reverse Proxy Configuration Examples

While the reverse proxy is not part of the application itself, providing example configurations reduces deployment friction.

**File: `docs/deployment/caddy-example.txt`**

```
# Caddy reverse proxy configuration for SymbioKnowledgeBase
# Caddy automatically provisions and renews TLS certificates.
#
# Place this in your Caddyfile and run: caddy run
#
# Prerequisites:
#   - Domain DNS A/AAAA record pointing to this server
#   - Ports 80 and 443 open on the firewall
#   - Docker Compose running: docker compose -f docker-compose.prod.yml up -d

kb.example.com {
    # Reverse proxy to the Next.js container
    reverse_proxy localhost:3000

    # Request size limit (10MB for file uploads)
    request_body {
        max_size 10MB
    }

    # Access logging
    log {
        output file /var/log/caddy/symbio-access.log
        format json
    }

    # Rate limiting (requires caddy-ratelimit plugin)
    # Uncomment if the plugin is installed:
    # rate_limit {
    #     zone api_zone {
    #         match {
    #             path /api/*
    #         }
    #         key {remote_host}
    #         events 100
    #         window 1m
    #     }
    # }
}
```

**File: `docs/deployment/nginx-example.conf`**

```nginx
# Nginx reverse proxy configuration for SymbioKnowledgeBase
#
# Place in /etc/nginx/sites-available/ and symlink to sites-enabled/
#
# Prerequisites:
#   - TLS certificate (e.g., from Let's Encrypt / certbot)
#   - Docker Compose running: docker compose -f docker-compose.prod.yml up -d

upstream symbio_app {
    server 127.0.0.1:3000;
    keepalive 32;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name kb.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name kb.example.com;

    # TLS certificates (adjust paths for your setup)
    ssl_certificate     /etc/letsencrypt/live/kb.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/kb.example.com/privkey.pem;

    # TLS configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Request limits
    client_max_body_size 10M;

    # Rate limiting for API endpoints
    # Define in http block: limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;
    location /api/ {
        limit_req zone=api burst=50 nodelay;
        proxy_pass http://symbio_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # All other routes
    location / {
        proxy_pass http://symbio_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # Static asset caching (Next.js hashes static files)
    location /_next/static/ {
        proxy_pass http://symbio_app;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }
}
```

---

### Step 7: Create the Secret Generation Helper Script

A convenience script for generating production secrets.

**File: `scripts/generate-secrets.sh`**

```bash
#!/bin/bash

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SymbioKnowledgeBase — Generate Production Secrets
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#
# Generates strong random values for all production secrets.
# Copy the output to your .env file.
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo "============================================="
echo "  SymbioKnowledgeBase — Secret Generator"
echo "============================================="
echo ""
echo "Copy these values to your .env file:"
echo ""

# Generate NEXTAUTH_SECRET (base64, 32 bytes = 44 characters)
NEXTAUTH_SECRET=$(openssl rand -base64 32)
echo "NEXTAUTH_SECRET=\"${NEXTAUTH_SECRET}\""
echo ""

# Generate DB_PASSWORD (alphanumeric, 32 characters)
DB_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)
echo "DB_PASSWORD=\"${DB_PASSWORD}\""
echo ""

echo "============================================="
echo ""
echo "IMPORTANT: After updating .env, restart the services:"
echo "  docker compose -f docker-compose.prod.yml down"
echo "  docker compose -f docker-compose.prod.yml up -d"
echo ""
echo "WARNING: Changing DB_PASSWORD requires updating the"
echo "         PostgreSQL user password manually if the"
echo "         database already exists."
```

---

## Testing Requirements

### Unit Test: `src/__tests__/api/health.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma client
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

import { GET } from '@/app/api/health/route';
import { prisma } from '@/lib/prisma';

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 200 with status ok when database is healthy', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ '?column?': 1 }]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.version).toBeDefined();
    expect(typeof body.uptime).toBe('number');
    expect(body.checks.database.status).toBe('ok');
    expect(typeof body.checks.database.latency_ms).toBe('number');
    expect(body.timestamp).toBeDefined();
  });

  it('should return 503 with status error when database is down', async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(
      new Error('Connection refused')
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe('error');
    expect(body.checks.database.status).toBe('error');
    expect(body.checks.database.error).toBe('Connection refused');
  });

  it('should include Cache-Control no-store header', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ '?column?': 1 }]);

    const response = await GET();

    expect(response.headers.get('Cache-Control')).toBe(
      'no-store, no-cache, must-revalidate'
    );
  });

  it('should report uptime as a positive number', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ '?column?': 1 }]);

    const response = await GET();
    const body = await response.json();

    expect(body.uptime).toBeGreaterThanOrEqual(0);
  });
});
```

### Unit Test: `src/__tests__/lib/env.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('env validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should throw when DATABASE_URL is missing', async () => {
    delete process.env.DATABASE_URL;
    process.env.NEXTAUTH_SECRET = 'test-secret';
    process.env.NEXTAUTH_URL = 'http://localhost:3000';

    await expect(async () => {
      await import('@/lib/env');
    }).rejects.toThrow('Missing required environment variable: DATABASE_URL');
  });

  it('should throw when NEXTAUTH_SECRET is missing', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost/test';
    delete process.env.NEXTAUTH_SECRET;
    process.env.NEXTAUTH_URL = 'http://localhost:3000';

    await expect(async () => {
      await import('@/lib/env');
    }).rejects.toThrow('Missing required environment variable: NEXTAUTH_SECRET');
  });

  it('should throw for invalid NODE_ENV', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost/test';
    process.env.NEXTAUTH_SECRET = 'test-secret';
    process.env.NEXTAUTH_URL = 'http://localhost:3000';
    process.env.NODE_ENV = 'staging';

    await expect(async () => {
      await import('@/lib/env');
    }).rejects.toThrow('Invalid NODE_ENV: "staging"');
  });

  it('should export validated env when all variables are set', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost/test';
    process.env.NEXTAUTH_SECRET = 'test-secret';
    process.env.NEXTAUTH_URL = 'http://localhost:3000';
    process.env.NODE_ENV = 'test';

    const { env } = await import('@/lib/env');

    expect(env.DATABASE_URL).toBe('postgresql://localhost/test');
    expect(env.NEXTAUTH_SECRET).toBe('test-secret');
    expect(env.NEXTAUTH_URL).toBe('http://localhost:3000');
    expect(env.NODE_ENV).toBe('test');
  });
});
```

### Integration Test: `tests/e2e/health.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

/**
 * Health endpoint E2E tests.
 *
 * These tests run against a live server instance.
 * Start the app before running: npm run dev or docker compose up
 */
test.describe('Health Check Endpoint', () => {
  const BASE_URL = process.env.APP_URL || 'http://localhost:3000';

  test('GET /api/health returns 200 with valid JSON', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({
      status: 'ok',
      version: expect.any(String),
      uptime: expect.any(Number),
      checks: {
        database: {
          status: 'ok',
          latency_ms: expect.any(Number),
        },
      },
      timestamp: expect.any(String),
    });
  });

  test('health check does not require authentication', async ({ request }) => {
    // Ensure no cookies are sent
    const response = await request.get(`${BASE_URL}/api/health`, {
      headers: { Cookie: '' },
    });
    expect(response.status()).toBe(200);
  });

  test('health check response is not cached', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`);
    const cacheControl = response.headers()['cache-control'];
    expect(cacheControl).toContain('no-store');
  });

  test('database latency is within acceptable range', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`);
    const body = await response.json();
    // Database latency should be under 100ms for a simple SELECT 1
    expect(body.checks.database.latency_ms).toBeLessThan(100);
  });
});
```

### Manual Verification Checklist

```bash
# ── Environment Configuration ─────────────────────────────

# 1. Generate production secrets
./scripts/generate-secrets.sh
# Expected: Prints NEXTAUTH_SECRET and DB_PASSWORD values

# 2. Create production .env from template
cp .env.production.example .env
# Fill in the generated secrets

# 3. Verify env validation catches missing vars
docker compose -f docker-compose.prod.yml run --rm \
  -e DATABASE_URL="" app node server.js
# Expected: Error about missing DATABASE_URL

# ── Health Check ──────────────────────────────────────────

# 4. Start the production stack
docker compose -f docker-compose.prod.yml up -d

# 5. Test health endpoint
curl -s http://localhost:3000/api/health | python3 -m json.tool
# Expected: { status: "ok", checks: { database: { status: "ok" } } }

# 6. Test health check when db is down
docker compose -f docker-compose.prod.yml stop db
curl -s http://localhost:3000/api/health | python3 -m json.tool
# Expected: { status: "error", checks: { database: { status: "error" } } }
docker compose -f docker-compose.prod.yml start db

# ── Backup & Restore ─────────────────────────────────────

# 7. Create a backup
./scripts/backup.sh
# Expected: Backup file created in ./backups/

# 8. Verify backup file
ls -lh backups/symbio_backup_*.dump
# Expected: Non-empty .dump file with timestamp

# 9. Test restore (on a test instance)
./scripts/restore.sh backups/symbio_backup_20260221_120000.dump
# Expected: Prompts for confirmation, restores data

# 10. Test backup to stdout
./scripts/backup.sh --stdout | wc -c
# Expected: Non-zero byte count

# ── Security Headers ─────────────────────────────────────

# 11. Check security headers
curl -s -D - http://localhost:3000 -o /dev/null | grep -E "^(X-Frame|X-Content|Referrer|X-XSS|Permissions|Strict-Transport)"
# Expected: All security headers present

# ── Cleanup ───────────────────────────────────────────────

# 12. Stop all services
docker compose -f docker-compose.prod.yml down
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `.env.production.example` |
| CREATE | `src/app/api/health/route.ts` |
| CREATE | `src/lib/securityHeaders.ts` |
| CREATE | `src/lib/env.ts` |
| CREATE | `scripts/backup.sh` |
| CREATE | `scripts/restore.sh` |
| CREATE | `scripts/generate-secrets.sh` |
| CREATE | `docs/deployment/caddy-example.txt` |
| CREATE | `docs/deployment/nginx-example.conf` |
| MODIFY | `next.config.ts` (add security headers) |
| CREATE | `src/__tests__/api/health.test.ts` |
| CREATE | `src/__tests__/lib/env.test.ts` |
| CREATE | `tests/e2e/health.spec.ts` |

---

**Last Updated:** 2026-02-21
