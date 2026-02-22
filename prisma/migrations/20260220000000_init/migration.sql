-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "BlockType" AS ENUM ('DOCUMENT', 'PARAGRAPH', 'HEADING_1', 'HEADING_2', 'HEADING_3', 'BULLETED_LIST', 'NUMBERED_LIST', 'TODO', 'TOGGLE', 'CODE', 'QUOTE', 'CALLOUT', 'DIVIDER', 'IMAGE', 'BOOKMARK', 'TABLE');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deactivated_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pages" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "title" TEXT NOT NULL DEFAULT 'Untitled',
    "icon" TEXT,
    "cover_url" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocks" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "type" "BlockType" NOT NULL DEFAULT 'PARAGRAPH',
    "content" JSONB NOT NULL DEFAULT '{}',
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_links" (
    "id" TEXT NOT NULL,
    "source_page_id" TEXT NOT NULL,
    "target_page_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "databases" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "schema" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "databases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "db_rows" (
    "id" TEXT NOT NULL,
    "database_id" TEXT NOT NULL,
    "page_id" TEXT,
    "tenant_id" TEXT NOT NULL,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "db_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_users_tenant_id_id" ON "users"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "idx_users_tenant_id" ON "users"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_users_email_tenant_id" ON "users"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "idx_pages_tenant_id_id" ON "pages"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "idx_pages_tenant_id" ON "pages"("tenant_id");

-- CreateIndex
CREATE INDEX "idx_pages_tenant_id_parent_id" ON "pages"("tenant_id", "parent_id");

-- CreateIndex
CREATE INDEX "idx_blocks_tenant_id_id" ON "blocks"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "idx_blocks_tenant_id" ON "blocks"("tenant_id");

-- CreateIndex
CREATE INDEX "idx_blocks_page_id" ON "blocks"("page_id");

-- CreateIndex
CREATE INDEX "idx_blocks_tenant_id_page_id" ON "blocks"("tenant_id", "page_id");

-- CreateIndex
CREATE INDEX "idx_page_links_tenant_id_id" ON "page_links"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "idx_page_links_tenant_id" ON "page_links"("tenant_id");

-- CreateIndex
CREATE INDEX "idx_page_links_tenant_id_source" ON "page_links"("tenant_id", "source_page_id");

-- CreateIndex
CREATE INDEX "idx_page_links_tenant_id_target" ON "page_links"("tenant_id", "target_page_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_page_links_source_target" ON "page_links"("source_page_id", "target_page_id");

-- CreateIndex
CREATE INDEX "idx_api_keys_tenant_id_id" ON "api_keys"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "idx_api_keys_tenant_id" ON "api_keys"("tenant_id");

-- CreateIndex
CREATE INDEX "idx_api_keys_key_hash" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "idx_databases_tenant_id_id" ON "databases"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "idx_databases_tenant_id" ON "databases"("tenant_id");

-- CreateIndex
CREATE INDEX "idx_databases_page_id" ON "databases"("page_id");

-- CreateIndex
CREATE INDEX "idx_db_rows_tenant_id_id" ON "db_rows"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "idx_db_rows_tenant_id" ON "db_rows"("tenant_id");

-- CreateIndex
CREATE INDEX "idx_db_rows_database_id" ON "db_rows"("database_id");

-- CreateIndex
CREATE INDEX "idx_db_rows_tenant_id_database_id" ON "db_rows"("tenant_id", "database_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_links" ADD CONSTRAINT "page_links_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_links" ADD CONSTRAINT "page_links_source_page_id_fkey" FOREIGN KEY ("source_page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_links" ADD CONSTRAINT "page_links_target_page_id_fkey" FOREIGN KEY ("target_page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "databases" ADD CONSTRAINT "databases_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "databases" ADD CONSTRAINT "databases_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "db_rows" ADD CONSTRAINT "db_rows_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "db_rows" ADD CONSTRAINT "db_rows_database_id_fkey" FOREIGN KEY ("database_id") REFERENCES "databases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "db_rows" ADD CONSTRAINT "db_rows_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
