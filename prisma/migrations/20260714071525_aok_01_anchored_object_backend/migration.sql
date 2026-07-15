-- CreateTable
CREATE TABLE "aok_sites" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_key" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'other',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aok_sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aok_spaces" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'other',
    "name" TEXT NOT NULL,
    "name_key" TEXT NOT NULL,
    "directions_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aok_spaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aok_assets" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "space_id" TEXT,
    "class" TEXT NOT NULL DEFAULT 'facility_asset',
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "criticality" TEXT NOT NULL DEFAULT 'low',
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'active',
    "replaced_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aok_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aok_anchors" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "asset_id" TEXT,
    "type" TEXT NOT NULL DEFAULT 'qr',
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aok_anchors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aok_knowledge" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'gotcha',
    "text" TEXT NOT NULL,
    "review_status" TEXT NOT NULL DEFAULT 'approved',
    "source" TEXT NOT NULL DEFAULT 'voice_capture',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aok_knowledge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aok_visits" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "notes" TEXT,
    "worker_label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aok_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aok_count_lines" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "counted_qty" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "expected_qty" DOUBLE PRECISION,
    "delta" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aok_count_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_aok_sites_tenant_id" ON "aok_sites"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_aok_sites_tenant_name_key" ON "aok_sites"("tenant_id", "name_key");

-- CreateIndex
CREATE INDEX "idx_aok_spaces_tenant_id" ON "aok_spaces"("tenant_id");

-- CreateIndex
CREATE INDEX "idx_aok_spaces_tenant_site" ON "aok_spaces"("tenant_id", "site_id");

-- CreateIndex
CREATE INDEX "idx_aok_spaces_tenant_parent" ON "aok_spaces"("tenant_id", "parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_aok_spaces_tenant_site_name_key" ON "aok_spaces"("tenant_id", "site_id", "name_key");

-- CreateIndex
CREATE INDEX "idx_aok_assets_tenant_id" ON "aok_assets"("tenant_id");

-- CreateIndex
CREATE INDEX "idx_aok_assets_tenant_site" ON "aok_assets"("tenant_id", "site_id");

-- CreateIndex
CREATE INDEX "idx_aok_assets_tenant_space" ON "aok_assets"("tenant_id", "space_id");

-- CreateIndex
CREATE INDEX "idx_aok_assets_tenant_status" ON "aok_assets"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "aok_anchors_payload_key" ON "aok_anchors"("payload");

-- CreateIndex
CREATE INDEX "idx_aok_anchors_tenant_id" ON "aok_anchors"("tenant_id");

-- CreateIndex
CREATE INDEX "idx_aok_anchors_tenant_asset" ON "aok_anchors"("tenant_id", "asset_id");

-- CreateIndex
CREATE INDEX "idx_aok_knowledge_tenant_id" ON "aok_knowledge"("tenant_id");

-- CreateIndex
CREATE INDEX "idx_aok_knowledge_tenant_asset" ON "aok_knowledge"("tenant_id", "asset_id");

-- CreateIndex
CREATE INDEX "idx_aok_visits_tenant_id" ON "aok_visits"("tenant_id");

-- CreateIndex
CREATE INDEX "idx_aok_visits_tenant_asset" ON "aok_visits"("tenant_id", "asset_id");

-- CreateIndex
CREATE INDEX "idx_aok_count_lines_tenant_id" ON "aok_count_lines"("tenant_id");

-- CreateIndex
CREATE INDEX "idx_aok_count_lines_tenant_asset" ON "aok_count_lines"("tenant_id", "asset_id");

-- AddForeignKey
ALTER TABLE "aok_sites" ADD CONSTRAINT "aok_sites_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aok_spaces" ADD CONSTRAINT "aok_spaces_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aok_spaces" ADD CONSTRAINT "aok_spaces_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "aok_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aok_spaces" ADD CONSTRAINT "aok_spaces_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "aok_spaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aok_assets" ADD CONSTRAINT "aok_assets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aok_assets" ADD CONSTRAINT "aok_assets_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "aok_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aok_assets" ADD CONSTRAINT "aok_assets_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "aok_spaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aok_assets" ADD CONSTRAINT "aok_assets_replaced_by_id_fkey" FOREIGN KEY ("replaced_by_id") REFERENCES "aok_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aok_anchors" ADD CONSTRAINT "aok_anchors_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aok_anchors" ADD CONSTRAINT "aok_anchors_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "aok_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aok_knowledge" ADD CONSTRAINT "aok_knowledge_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aok_knowledge" ADD CONSTRAINT "aok_knowledge_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "aok_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aok_visits" ADD CONSTRAINT "aok_visits_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aok_visits" ADD CONSTRAINT "aok_visits_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "aok_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aok_count_lines" ADD CONSTRAINT "aok_count_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aok_count_lines" ADD CONSTRAINT "aok_count_lines_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "aok_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
