-- a71-08: document intake (upload or link).
--
-- Adds a closed `kind` discriminator to `pages` (default 'PAGE') so document
-- pages can be told apart from ordinary pages without a new table, plus two
-- nullable columns describing where a document page's content came from.
--
-- The NOT NULL + DEFAULT combination backfills every existing row to 'PAGE'
-- as part of this migration (Round 2 finding 5 / AC10) — no row is left NULL,
-- so pre-migration pages never surface under a `kind='DOCUMENT'` filter.

-- CreateEnum
CREATE TYPE "PageKind" AS ENUM ('PAGE', 'DOCUMENT');

-- AlterTable
ALTER TABLE "pages" ADD COLUMN "kind" "PageKind" NOT NULL DEFAULT 'PAGE';
ALTER TABLE "pages" ADD COLUMN "source_url" TEXT;
ALTER TABLE "pages" ADD COLUMN "doc_source" TEXT;

-- CreateIndex
CREATE INDEX "idx_pages_tenant_id_kind" ON "pages"("tenant_id", "kind");
