-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('UPLOADING', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "SpaceType" AS ENUM ('PRIVATE', 'TEAM', 'AGENT');

-- CreateEnum
CREATE TYPE "ChangeType" AS ENUM ('MANUAL', 'AUTO_SYNC', 'PROPAGATED', 'MACHINE_UPDATE', 'AI_SUGGESTED');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('URL', 'PAGE', 'MACHINE_PROTOCOL');

-- CreateEnum
CREATE TYPE "SubscriptionBehavior" AS ENUM ('MIRROR', 'NOTIFY', 'SUGGEST');

-- AlterEnum
ALTER TYPE "BlockType" ADD VALUE 'FILE';

-- AlterTable
ALTER TABLE "api_keys" ADD COLUMN     "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "pages" ADD COLUMN     "space_type" "SpaceType" NOT NULL DEFAULT 'PRIVATE';

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "storage_quota" BIGINT NOT NULL DEFAULT 5368709120,
ADD COLUMN     "storage_used" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatar_url" TEXT;

-- CreateTable
CREATE TABLE "document_versions" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "plain_text" TEXT NOT NULL,
    "change_type" "ChangeType" NOT NULL,
    "change_source" TEXT,
    "change_notes" TEXT,
    "diff_from_prev" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_subscriptions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "subscriber_page_id" TEXT NOT NULL,
    "source_type" "SourceType" NOT NULL,
    "source_page_id" TEXT,
    "source_url" TEXT,
    "behavior" "SubscriptionBehavior" NOT NULL DEFAULT 'NOTIFY',
    "last_synced_at" TIMESTAMP(3),
    "last_sync_version" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_attachments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "page_id" TEXT,
    "file_name" TEXT NOT NULL,
    "file_size" BIGINT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "storage_url" TEXT,
    "status" "FileStatus" NOT NULL DEFAULT 'UPLOADING',
    "checksum" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "api_key_id" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resource_id" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_versions_page_id_idx" ON "document_versions"("page_id");

-- CreateIndex
CREATE INDEX "document_versions_tenant_id_page_id_idx" ON "document_versions"("tenant_id", "page_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_page_id_version_key" ON "document_versions"("page_id", "version");

-- CreateIndex
CREATE INDEX "document_subscriptions_tenant_id_subscriber_page_id_idx" ON "document_subscriptions"("tenant_id", "subscriber_page_id");

-- CreateIndex
CREATE INDEX "document_subscriptions_source_page_id_idx" ON "document_subscriptions"("source_page_id");

-- CreateIndex
CREATE INDEX "file_attachments_tenant_id_page_id_idx" ON "file_attachments"("tenant_id", "page_id");

-- CreateIndex
CREATE INDEX "file_attachments_tenant_id_user_id_idx" ON "file_attachments"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "idx_audit_logs_tenant_created" ON "audit_logs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_audit_logs_user_id" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "idx_audit_logs_resource" ON "audit_logs"("resource", "resource_id");

-- CreateIndex
CREATE INDEX "idx_pages_tenant_id_space_type" ON "pages"("tenant_id", "space_type");

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_subscriptions" ADD CONSTRAINT "document_subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_subscriptions" ADD CONSTRAINT "document_subscriptions_subscriber_page_id_fkey" FOREIGN KEY ("subscriber_page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_attachments" ADD CONSTRAINT "file_attachments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_attachments" ADD CONSTRAINT "file_attachments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_attachments" ADD CONSTRAINT "file_attachments_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE SET NULL ON UPDATE CASCADE;
