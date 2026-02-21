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
