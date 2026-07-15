-- a71-02: content sync — fill the scaffolds with real experiment content.
--
-- Additive only:
--   `page_sync_section_state` — tracks the last-applied `content_update` per
--   (page, section_key) so the sync receiver's staleness guard can reject an
--   out-of-order/duplicate retry (e.g. from the a71-01 notebook DLQ) without
--   mutating the page. The existing `pages.properties` JSON column is reused
--   for the `contentSync` structure flag; no column change is needed on pages.

-- CreateTable
CREATE TABLE "page_sync_section_state" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "section_key" TEXT NOT NULL,
    "last_applied_at" TIMESTAMP(3) NOT NULL,
    "last_correlation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "page_sync_section_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_page_sync_section_state_page_section" ON "page_sync_section_state"("page_id", "section_key");

-- CreateIndex
CREATE INDEX "idx_page_sync_section_state_tenant_id" ON "page_sync_section_state"("tenant_id");

-- CreateIndex
CREATE INDEX "idx_page_sync_section_state_tenant_id_page_id" ON "page_sync_section_state"("tenant_id", "page_id");

-- AddForeignKey
ALTER TABLE "page_sync_section_state" ADD CONSTRAINT "page_sync_section_state_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_sync_section_state" ADD CONSTRAINT "page_sync_section_state_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
