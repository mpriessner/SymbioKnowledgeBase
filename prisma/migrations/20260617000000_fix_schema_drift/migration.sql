-- Reconcile schema/migration drift: several models were added to schema.prisma
-- over time WITHOUT a corresponding migration, so a fresh `prisma migrate deploy`
-- produced a database that did NOT match the Prisma client. Teamspace inserts
-- (incl. the chemistry-KB seed) failed at runtime with "column ... does not exist",
-- and the SweepSession table was absent entirely.
--
-- All statements are additive + idempotent (IF NOT EXISTS / guarded ADD CONSTRAINT)
-- so this is safe on a fresh DB AND on a DB previously synced via `prisma db push`.

-- ── teamspaces: missing slug (+ unique index) and description columns ──────────
ALTER TABLE "teamspaces" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "teamspaces" ADD COLUMN IF NOT EXISTS "description" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "uq_teamspaces_tenant_slug" ON "teamspaces"("tenant_id", "slug");

-- ── sweep_sessions: table was declared in the schema but never created ─────────
CREATE TABLE IF NOT EXISTS "sweep_sessions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "budget" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "results" JSONB NOT NULL DEFAULT '{}',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    CONSTRAINT "sweep_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_sweep_sessions_tenant_started" ON "sweep_sessions"("tenant_id", "started_at");

-- ADD CONSTRAINT has no IF NOT EXISTS in PostgreSQL — guard it so re-runs are safe.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sweep_sessions_tenant_id_fkey'
  ) THEN
    ALTER TABLE "sweep_sessions"
      ADD CONSTRAINT "sweep_sessions_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
