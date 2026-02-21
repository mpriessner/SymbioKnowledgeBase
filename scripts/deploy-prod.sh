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
  echo "       Copy .env.production.example to .env and set production values."
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
