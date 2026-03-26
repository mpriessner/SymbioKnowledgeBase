-- AlterTable
ALTER TABLE "pages" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "deleted_by" TEXT;

-- Index for filtering active pages and finding trashed pages
CREATE INDEX "idx_pages_tenant_id_deleted_at" ON "pages"("tenant_id", "deleted_at");
