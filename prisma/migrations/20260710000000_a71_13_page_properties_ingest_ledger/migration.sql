-- a71-13: OKF enrichment engine schema additions.
--
-- Both changes are strictly ADDITIVE and safe to land on the live `pages` table:
--   1. `pages.properties` is a new NULLABLE jsonb column (existing rows -> NULL,
--      no backfill required).
--   2. `ingest_ledger_entries` is a brand-new table.
-- No existing column is altered or dropped.

-- AlterTable: additive nullable JSON metadata bag on pages.
ALTER TABLE "pages" ADD COLUMN "properties" JSONB;

-- CreateTable: per-tenant idempotency ledger for the enrichment engine.
CREATE TABLE "ingest_ledger_entries" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "source_name" TEXT NOT NULL,
    "plan_summary" TEXT,
    "action_count" INTEGER NOT NULL DEFAULT 0,
    "ingested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingest_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- Composite unique: the same content hash may exist for different tenants, but a
-- same-tenant re-submit collapses (idempotent no-op).
CREATE UNIQUE INDEX "uq_ingest_ledger_tenant_content_hash" ON "ingest_ledger_entries"("tenant_id", "content_hash");

-- Tenant-scoped lookup index.
CREATE INDEX "idx_ingest_ledger_tenant_id" ON "ingest_ledger_entries"("tenant_id");

-- FK to tenants with cascade delete, matching every other tenant-scoped table.
ALTER TABLE "ingest_ledger_entries" ADD CONSTRAINT "ingest_ledger_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
