-- W81-A2: Claim / ClaimEvidence citation layer + durable EnrichJob queue.
--
-- Depends on: W81-A1 (sources / source_chunks) and a71-13 (document_versions,
-- ingest_ledger_entries). Strict, immutable migration order (Codex R1):
--   A70-rebased tree → a71-13 → W81-A1 → W81-A2 (this).
--
-- ORDER MATTERS: (1) enums, (2) tables, (3) indexes/uniques, (4) foreign keys.
-- `Claim.document_version_id` FK is ON DELETE RESTRICT — a pinned per-version
-- snapshot must never dangle; `pruneOldVersions()` (versioning.ts) is patched to
-- skip any document_version referenced by a claim so retention pruning can never
-- FK-violate a save.

-- 1. Enums.
CREATE TYPE "ClaimStatus" AS ENUM ('ACTIVE', 'SUPERSEDED');
CREATE TYPE "EvidenceRelation" AS ENUM ('SUPPORTS', 'CONTRADICTS');
CREATE TYPE "EvidenceValidation" AS ENUM ('EXACT', 'FUZZY', 'UNVERIFIED');
CREATE TYPE "EnrichJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED');

-- 2a. claims — one atomic assertion on a wiki page, pinned to a DocumentVersion.
CREATE TABLE "claims" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "claim_key" TEXT NOT NULL,
    "anchor_text_sha" TEXT NOT NULL,
    "document_version_id" TEXT NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "claims_pkey" PRIMARY KEY ("id")
);

-- 2b. claim_evidence — a Claim ↔ SourceChunk citation edge + gate verdict.
CREATE TABLE "claim_evidence" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "claim_id" TEXT NOT NULL,
    "chunk_id" TEXT NOT NULL,
    "matched_text" TEXT,
    "quote_sha256" TEXT NOT NULL,
    "chunk_char_start" INTEGER,
    "chunk_char_end" INTEGER,
    "relation" "EvidenceRelation" NOT NULL,
    "validation_state" "EvidenceValidation" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "claim_evidence_pkey" PRIMARY KEY ("id")
);

-- 2c. enrich_jobs — durable async-job queue (survives restarts).
CREATE TABLE "enrich_jobs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "status" "EnrichJobStatus" NOT NULL DEFAULT 'QUEUED',
    "request" JSONB NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enrich_jobs_pkey" PRIMARY KEY ("id")
);

-- 3. Indexes + uniques.
CREATE UNIQUE INDEX "uq_claims_tenant_claim_key" ON "claims"("tenant_id", "claim_key");
CREATE INDEX "idx_claims_tenant_page" ON "claims"("tenant_id", "page_id");
CREATE INDEX "idx_claims_tenant_status" ON "claims"("tenant_id", "status");
CREATE INDEX "idx_claims_document_version" ON "claims"("document_version_id");

CREATE UNIQUE INDEX "uq_claim_evidence_claim_chunk_quote" ON "claim_evidence"("claim_id", "chunk_id", "quote_sha256");
CREATE INDEX "idx_claim_evidence_tenant_claim" ON "claim_evidence"("tenant_id", "claim_id");
CREATE INDEX "idx_claim_evidence_tenant_chunk" ON "claim_evidence"("tenant_id", "chunk_id");

CREATE INDEX "idx_enrich_jobs_tenant_status" ON "enrich_jobs"("tenant_id", "status");
CREATE INDEX "idx_enrich_jobs_status_created" ON "enrich_jobs"("status", "created_at");

-- 4. Foreign keys.
ALTER TABLE "claims" ADD CONSTRAINT "claims_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "claims" ADD CONSTRAINT "claims_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- RESTRICT: a claim pins a per-version snapshot; the version must never be pruned
-- out from under it (pruneOldVersions skips claim-referenced versions).
ALTER TABLE "claims" ADD CONSTRAINT "claims_document_version_id_fkey" FOREIGN KEY ("document_version_id") REFERENCES "document_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "claim_evidence" ADD CONSTRAINT "claim_evidence_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "claim_evidence" ADD CONSTRAINT "claim_evidence_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "claim_evidence" ADD CONSTRAINT "claim_evidence_chunk_id_fkey" FOREIGN KEY ("chunk_id") REFERENCES "source_chunks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "enrich_jobs" ADD CONSTRAINT "enrich_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
