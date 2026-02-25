/*
  Warnings:

  - Added the required column `updated_at` to the `public_share_links` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Permission" AS ENUM ('FULL_ACCESS', 'CAN_EDIT', 'CAN_COMMENT', 'CAN_VIEW');

-- CreateEnum
CREATE TYPE "GeneralAccess" AS ENUM ('INVITED_ONLY', 'ANYONE_WITH_LINK');

-- AlterTable
ALTER TABLE "databases" ADD COLUMN     "default_view" TEXT NOT NULL DEFAULT 'table',
ADD COLUMN     "view_config" JSONB;

-- AlterTable
ALTER TABLE "pages" ADD COLUMN     "general_access" "GeneralAccess" NOT NULL DEFAULT 'INVITED_ONLY';

-- AlterTable
ALTER TABLE "public_share_links" ADD COLUMN     "allow_indexing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "published_at" TIMESTAMP(3),
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "tenant_members" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'owner',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_favorites" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_shares" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "permission" "Permission" NOT NULL DEFAULT 'CAN_VIEW',
    "shared_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "page_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_tenant_members_user_id" ON "tenant_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tenant_members_user_tenant" ON "tenant_members"("user_id", "tenant_id");

-- CreateIndex
CREATE INDEX "idx_page_favorites_user_tenant" ON "page_favorites"("user_id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_page_favorites_user_page" ON "page_favorites"("user_id", "page_id");

-- CreateIndex
CREATE INDEX "idx_page_shares_user_tenant" ON "page_shares"("user_id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_page_shares_page_user" ON "page_shares"("page_id", "user_id");

-- AddForeignKey
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_favorites" ADD CONSTRAINT "page_favorites_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_favorites" ADD CONSTRAINT "page_favorites_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_shares" ADD CONSTRAINT "page_shares_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_shares" ADD CONSTRAINT "page_shares_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
