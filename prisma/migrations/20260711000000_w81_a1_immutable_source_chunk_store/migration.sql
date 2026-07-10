-- W81-A1: Immutable Source + SourceChunk store (append-only, hashed, chunked, embedded).
--
-- ORDER MATTERS (Codex R1): (1) enable pgvector BEFORE any vector column,
-- (2) create enum + tables, (3) create indexes/constraints, (4) install the
-- append-only immutability triggers.
--
-- OPS / ROLLBACK (Codex R1): this migration assumes a pgvector-capable Postgres
-- image (docker-compose.yml swapped to `pgvector/pgvector:pg18`). Back up + test a
-- copy of the `pgdata` volume before recreating the container — an existing volume
-- is NOT re-initialised by /docker-entrypoint-initdb.d. Rolling back to plain
-- `postgres:18` AFTER these vector columns exist is NOT a safe rollback (the old
-- image lacks the extension library). Non-Compose environments must also install
-- the pgvector server files — editing docker-compose.yml only fixes local Docker.
--
-- SHADOW-DB CAVEAT (GLM R2): `prisma migrate dev` replays this migration
-- (including CREATE EXTENSION) in a shadow DB that needs a role with
-- superuser/control-file access to install `vector`. If the shadow role lacks it,
-- ALL subsequent local migrations are blocked. Mitigate by pre-provisioning the
-- `vector` extension in the shadow DB, or point the shadow DB at a
-- `pgvector/pgvector:pg18` image/role. `prisma validate` and `prisma generate` do
-- NOT need this (they don't provision a shadow DB); raw-SQL embedding writes keep
-- the typed client clean of the Unsupported column.

-- 1. pgvector extension (must precede any `vector` column).
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Enum.
CREATE TYPE "SourceKind" AS ENUM ('DOCUMENT', 'TRANSCRIPT', 'NOTE', 'EXPERIMENT_SYNC', 'URL');

-- 3a. sources (append-only raw artifact; raw_text stored verbatim).
CREATE TABLE "sources" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "kind" "SourceKind" NOT NULL,
    "title" TEXT NOT NULL,
    "content_sha256" TEXT NOT NULL,
    "chunker_version" TEXT NOT NULL,
    "raw_text" TEXT NOT NULL,
    "ingested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ingested_by" TEXT,
    "correlation_id" TEXT,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- 3b. source_chunks (deterministic segmentation; embedding nullable until backfill).
CREATE TABLE "source_chunks" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "char_start" INTEGER NOT NULL,
    "char_end" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "text_sha256" TEXT NOT NULL,
    "embedding" vector(1536),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_chunks_pkey" PRIMARY KEY ("id")
);

-- 3c. source_origins (N ingestion occurrences per immutable Source).
CREATE TABLE "source_origins" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "origin_ref" TEXT,
    "kind" "SourceKind" NOT NULL,
    "title" TEXT NOT NULL,
    "ingested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ingested_by" TEXT,

    CONSTRAINT "source_origins_pkey" PRIMARY KEY ("id")
);

-- 4. Unique constraints + indexes.
-- Dedup key: identical text re-chunked under a new chunker_version mints a new Source.
CREATE UNIQUE INDEX "uq_sources_tenant_sha_chunker" ON "sources"("tenant_id", "content_sha256", "chunker_version");
-- REQUIRED for the composite FKs below (Postgres 42890 otherwise).
CREATE UNIQUE INDEX "uq_sources_tenant_id" ON "sources"("tenant_id", "id");
CREATE INDEX "idx_sources_tenant_id" ON "sources"("tenant_id");

-- Chunk identity is (source_id, chunk_index) — never text_sha256.
CREATE UNIQUE INDEX "uq_source_chunks_source_chunk_index" ON "source_chunks"("source_id", "chunk_index");
CREATE INDEX "idx_source_chunks_tenant_source" ON "source_chunks"("tenant_id", "source_id");

CREATE UNIQUE INDEX "uq_source_origins_tenant_source_ref" ON "source_origins"("tenant_id", "source_id", "origin_ref");
CREATE INDEX "idx_source_origins_tenant_source" ON "source_origins"("tenant_id", "source_id");

-- 5. Data-integrity CHECK constraints (Codex R1 nice-to-haves).
ALTER TABLE "source_chunks" ADD CONSTRAINT "chk_source_chunks_chunk_index_nonneg" CHECK ("chunk_index" >= 0);
ALTER TABLE "source_chunks" ADD CONSTRAINT "chk_source_chunks_bounds" CHECK ("char_start" >= 0 AND "char_start" <= "char_end");

-- 6. Foreign keys.
-- Source -> tenant (cascade, matching every other tenant-scoped table).
ALTER TABLE "sources" ADD CONSTRAINT "sources_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Tenant-consistent composite FKs: a chunk/origin can only hang off a Source of the SAME tenant.
ALTER TABLE "source_chunks" ADD CONSTRAINT "source_chunks_tenant_id_source_id_fkey" FOREIGN KEY ("tenant_id", "source_id") REFERENCES "sources"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "source_origins" ADD CONSTRAINT "source_origins_tenant_id_source_id_fkey" FOREIGN KEY ("tenant_id", "source_id") REFERENCES "sources"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 7. Append-only immutability triggers (GLM R2 mechanics — load-bearing).
--
-- Shared guard: any invocation raises. The triggers below decide WHEN it fires.
CREATE OR REPLACE FUNCTION skb_immutable_guard() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'immutable append-only row: % on %.% is not permitted',
    TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

-- UPDATE guard is COLUMN-SCOPED. `BEFORE UPDATE OF <content cols>` EXCLUDES
-- `embedding`, so the raw-SQL embedding backfill (`UPDATE ... SET embedding=...`)
-- does NOT fire the guard. A blanket BEFORE UPDATE would fire per row and leave
-- every embedding null forever.
CREATE TRIGGER trg_sources_block_update
  BEFORE UPDATE OF "raw_text" ON "sources"
  FOR EACH ROW EXECUTE FUNCTION skb_immutable_guard();

CREATE TRIGGER trg_source_chunks_block_update
  BEFORE UPDATE OF "text", "char_start", "char_end", "chunk_index" ON "source_chunks"
  FOR EACH ROW EXECUTE FUNCTION skb_immutable_guard();

-- DELETE guard CANNOT be column-scoped, so it uses `pg_trigger_depth() = 0`: a
-- direct app DELETE (depth 0) is blocked, but a DELETE cascading from `tenants`
-- (depth > 0) passes through, so tenant deletion still cascades cleanly.
CREATE TRIGGER trg_sources_block_delete
  BEFORE DELETE ON "sources"
  FOR EACH ROW WHEN (pg_trigger_depth() = 0) EXECUTE FUNCTION skb_immutable_guard();

CREATE TRIGGER trg_source_chunks_block_delete
  BEFORE DELETE ON "source_chunks"
  FOR EACH ROW WHEN (pg_trigger_depth() = 0) EXECUTE FUNCTION skb_immutable_guard();
