#!/bin/sh
set -e

echo "SymbioKnowledgeBase — Starting..."

# Use local prisma binary from node_modules
PRISMA="./node_modules/.bin/prisma"
if [ ! -f "$PRISMA" ]; then
  PRISMA="node ./node_modules/prisma/build/index.js"
fi

# ── Run Prisma migrations ──
# Migrate failures MUST abort startup (set -e) — never boot against a
# half-migrated database.
echo "Running database migrations..."
$PRISMA migrate deploy
echo "Migrations complete."

# ── Seed database (opt-in, non-production only) ──
# Seeding runs only when explicitly requested via RUN_SEED=true AND NODE_ENV is
# not production. Demo seed data must never be auto-loaded into production.
if [ "$RUN_SEED" = "true" ] && [ "$NODE_ENV" != "production" ]; then
  echo "Running database seed (RUN_SEED=true, NODE_ENV=$NODE_ENV)..."
  $PRISMA db seed
  echo "Seed complete."
else
  echo "Seed skipped (set RUN_SEED=true in a non-production env to seed)."
fi

# ── Start the application ──
echo "Starting Next.js server..."
exec "$@"
