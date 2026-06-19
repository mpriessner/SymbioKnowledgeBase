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

# Auth is provided by Supabase (NOT NextAuth). These gate authentication; a
# missing/placeholder value is what causes unauthenticated requests to be
# misresolved, so they are hard-required at boot.
validate_env "DATABASE_URL"
validate_env "NEXT_PUBLIC_SUPABASE_URL"
validate_env "NEXT_PUBLIC_SUPABASE_ANON_KEY"

echo "         Environment variables validated."
echo ""

# ── Run database migrations ──────────────────────────────
# Migrate failures MUST abort startup (set -e) — never boot the app against a
# half-migrated database.
echo "[2/4] Running database migrations..."
npx prisma migrate deploy
echo "         Migrations complete."
echo ""

# ── Seed database (opt-in, non-production only) ──────────
# Demo seed data must NEVER be auto-loaded into production. Seeding runs only
# when explicitly requested via RUN_SEED=true AND NODE_ENV is not production.
echo "[3/4] Database seed..."
if [ "$RUN_SEED" = "true" ] && [ "$NODE_ENV" != "production" ]; then
  echo "         RUN_SEED=true and NODE_ENV=$NODE_ENV — running seed..."
  npx prisma db seed
  echo "         Seed complete."
else
  echo "         Skipped (set RUN_SEED=true in a non-production env to seed)."
fi
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
