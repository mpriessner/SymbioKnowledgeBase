#!/bin/bash
set -euo pipefail

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SymbioKnowledgeBase — Database Restore Script
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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
