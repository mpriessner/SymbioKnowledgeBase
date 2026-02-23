-- CreateEnum
CREATE TYPE "TeamspaceRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'GUEST');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('PAGE_MENTION', 'PAGE_UPDATE', 'AGENT_CREATED');

-- DropIndex
DROP INDEX "idx_blocks_search_vector";

-- DropIndex
DROP INDEX "idx_blocks_tenant_search";

-- AlterTable
ALTER TABLE "pages" ADD COLUMN     "teamspace_id" TEXT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;

-- CreateTable
CREATE TABLE "teamspaces" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teamspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teamspace_members" (
    "id" TEXT NOT NULL,
    "teamspace_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "TeamspaceRole" NOT NULL DEFAULT 'MEMBER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teamspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_share_links" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "public_share_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_presence" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "last_heartbeat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_editing" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "page_presence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "page_id" TEXT,
    "source_user_id" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_teamspaces_tenant_id" ON "teamspaces"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_teamspaces_tenant_name" ON "teamspaces"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "idx_teamspace_members_teamspace_role" ON "teamspace_members"("teamspace_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "uq_teamspace_members_teamspace_user" ON "teamspace_members"("teamspace_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "public_share_links_token_key" ON "public_share_links"("token");

-- CreateIndex
CREATE INDEX "idx_public_share_links_token" ON "public_share_links"("token");

-- CreateIndex
CREATE INDEX "idx_public_share_links_page_id" ON "public_share_links"("page_id");

-- CreateIndex
CREATE INDEX "idx_page_presence_page_id" ON "page_presence"("page_id");

-- CreateIndex
CREATE INDEX "idx_page_presence_last_heartbeat" ON "page_presence"("last_heartbeat");

-- CreateIndex
CREATE UNIQUE INDEX "uq_page_presence_page_user" ON "page_presence"("page_id", "user_id");

-- CreateIndex
CREATE INDEX "idx_notifications_user_created" ON "notifications"("tenant_id", "user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_notifications_user_read" ON "notifications"("tenant_id", "user_id", "read");

-- CreateIndex
CREATE INDEX "idx_pages_tenant_id_teamspace_id" ON "pages"("tenant_id", "teamspace_id");

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_teamspace_id_fkey" FOREIGN KEY ("teamspace_id") REFERENCES "teamspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teamspaces" ADD CONSTRAINT "teamspaces_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teamspace_members" ADD CONSTRAINT "teamspace_members_teamspace_id_fkey" FOREIGN KEY ("teamspace_id") REFERENCES "teamspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teamspace_members" ADD CONSTRAINT "teamspace_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_share_links" ADD CONSTRAINT "public_share_links_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_share_links" ADD CONSTRAINT "public_share_links_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_share_links" ADD CONSTRAINT "public_share_links_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_presence" ADD CONSTRAINT "page_presence_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_presence" ADD CONSTRAINT "page_presence_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_presence" ADD CONSTRAINT "page_presence_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_source_user_id_fkey" FOREIGN KEY ("source_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
