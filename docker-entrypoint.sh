#!/bin/sh
set -e

echo "SymbioKnowledgeBase — Starting..."

# Use local prisma binary from node_modules
PRISMA="./node_modules/.bin/prisma"
if [ ! -f "$PRISMA" ]; then
  PRISMA="node ./node_modules/prisma/build/index.js"
fi

# ── Run Prisma migrations ──
echo "Running database migrations..."
$PRISMA migrate deploy
echo "Migrations complete."

# ── Seed database (idempotent) ──
echo "Running database seed..."
$PRISMA db seed || echo "Seed already applied or failed (non-blocking)."
echo "Seed complete."

# ── Start the application ──
echo "Starting Next.js server..."
exec "$@"
