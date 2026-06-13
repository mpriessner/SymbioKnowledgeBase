-- Audit hardening (additive, low-risk). Hand-authored: no live DB to diff against.
-- Soft-delete columns (pages.deleted_at / pages.deleted_by + idx_pages_tenant_id_deleted_at)
-- already exist via 20260325170000_add_page_soft_delete; this migration is schema-model
-- reconciliation for those and intentionally does NOT re-add them here.

-- Step 1: Page.externalId — idempotency key for experiment sync.
-- Nullable so existing NULL rows do not collide (Postgres treats NULLs as distinct).
-- AlterTable
ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "external_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "uq_pages_tenant_id_external_id" ON "pages"("tenant_id", "external_id");

-- Step 2: Block.version — optimistic-concurrency counter for the DOCUMENT save path.
-- AlterTable
ALTER TABLE "blocks" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 0;

-- Step 3: ApiKey.scopes default — column already exists (added in 20260224142828 as
-- TEXT[] DEFAULT ARRAY[]::TEXT[]); only the default changes to grant read+write by default.
-- AlterTable
ALTER TABLE "api_keys" ALTER COLUMN "scopes" SET DEFAULT ARRAY['read', 'write'];
