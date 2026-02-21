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
