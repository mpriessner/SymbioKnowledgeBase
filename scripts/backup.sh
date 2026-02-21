#!/bin/bash
set -euo pipefail

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SymbioKnowledgeBase — Database Backup Script
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#
# Usage:
#   ./scripts/backup.sh                    # Backup to default directory
#   ./scripts/backup.sh /path/to/backups   # Backup to custom directory
#   ./scripts/backup.sh --stdout           # Output to stdout (for piping)
#
# Examples:
#   ./scripts/backup.sh --stdout | aws s3 cp - s3://bucket/symbio-$(date +%Y%m%d).dump
#   ./scripts/backup.sh --stdout | ssh user@remote "cat > /backups/symbio.dump"
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
