-- W81-C1: Staleness / contradiction triage worker (cheap tier, 24/7 local Ollama).
--
-- Depends on: A70 tree → a71-13 (pages.properties) → W81-A1 (sources/chunks +
-- pgvector) → W81-A2 (claims) → W81-B1 (bitemporal + pendingContested signal).
-- Strictly additive: new enums + four tables + a PARTIAL unique index. Touches no
-- existing table's columns.
--
-- ORDER MATTERS (Codex R1 convention): (1) enums, (2) tables, (3) indexes +
-- uniques (incl. the PARTIAL unique that Prisma can't express in-schema),
-- (4) foreign keys. All FKs on page/source/claim are ON DELETE SET NULL so a
-- purge retains the finding's display evidence; tenant-consistency of those FKs
-- is enforced in-transaction by the app (no RLS — the repo's per-query isolation
-- convention), because a composite (tenant_id,*) FK with SET NULL would try to
-- null the NOT NULL tenant_id half.

-- 1. Enums.
CREATE TYPE "TriagePass" AS ENUM ('STALENESS', 'TAGGING', 'DEDUP', 'CONTRADICTION');
CREATE TYPE "TriageKind" AS ENUM ('STALE', 'SOURCE_TAGGED', 'POSSIBLE_DUPLICATE', 'CONTRADICTION_CANDIDATE');
CREATE TYPE "TriageStatus" AS ENUM ('OPEN', 'ESCALATED', 'DEFERRED', 'DISMISSED', 'RESOLVED');
CREATE TYPE "TriageRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'BUDGET_EXHAUSTED', 'FAILED');

-- 2a. triage_runs — one bounded sweep invocation (stats + pinned model digest).
CREATE TABLE "triage_runs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "status" "TriageRunStatus" NOT NULL DEFAULT 'RUNNING',
    "budget" INTEGER NOT NULL,
    "model_digest" TEXT,
    "stats" JSONB NOT NULL DEFAULT '{}',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "triage_runs_pkey" PRIMARY KEY ("id")
);

-- 2b. triage_cursors — per-pass keyset watermark over the SCANNED anchor entity.
CREATE TABLE "triage_cursors" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "pass" "TriagePass" NOT NULL,
    "cursor_at" TIMESTAMP(3),
    "cursor_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "triage_cursors_pkey" PRIMARY KEY ("id")
);

-- 2c. triage_findings — the flagged work-list (never a page body).
CREATE TABLE "triage_findings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "kind" "TriageKind" NOT NULL,
    "status" "TriageStatus" NOT NULL DEFAULT 'OPEN',
    "severity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "page_id" TEXT,
    "related_page_id" TEXT,
    "claim_id" TEXT,
    "related_claim_id" TEXT,
    "source_id" TEXT,
    "fingerprint" TEXT NOT NULL,
    "evidence" JSONB NOT NULL DEFAULT '{}',
    "model_digest" TEXT,
    "defer_reason" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3),
    "escalated_at" TIMESTAMP(3),
    "leased_at" TIMESTAMP(3),
    "lease_owner" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "triage_findings_pkey" PRIMARY KEY ("id")
);

-- 2d. source_relevance — (b) source→concept tag, upsert-idempotent.
CREATE TABLE "source_relevance" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "model_digest" TEXT NOT NULL,
    "tagged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_relevance_pkey" PRIMARY KEY ("id")
);

-- 2e. triage_digests — durable, idempotent weekly health-check.
CREATE TABLE "triage_digests" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "period_key" TEXT NOT NULL,
    "stats" JSONB NOT NULL DEFAULT '{}',
    "notified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "triage_digests_pkey" PRIMARY KEY ("id")
);

-- 3. Indexes + uniques.
CREATE INDEX "idx_triage_runs_tenant_started" ON "triage_runs"("tenant_id", "started_at");

CREATE UNIQUE INDEX "uq_triage_cursors_tenant_pass" ON "triage_cursors"("tenant_id", "pass");

CREATE INDEX "idx_triage_findings_tenant_status" ON "triage_findings"("tenant_id", "status");
CREATE INDEX "idx_triage_findings_tenant_kind_status" ON "triage_findings"("tenant_id", "kind", "status");
CREATE INDEX "idx_triage_findings_tenant_defer" ON "triage_findings"("tenant_id", "status", "next_attempt_at");
CREATE INDEX "idx_triage_findings_escalation" ON "triage_findings"("status", "escalated_at");

-- PARTIAL unique on the fingerprint, scoped to NON-TERMINAL statuses only. A
-- global unique would P2002-drop (and silently lose) a recurrence after a finding
-- was DISMISSED/RESOLVED (GLM R2). This lets a live finding dedupe while a genuine
-- regression can be re-flagged. Finding writes target this index explicitly via
-- `INSERT ... ON CONFLICT (fingerprint) WHERE status IN (...) DO ...`.
CREATE UNIQUE INDEX "uq_triage_findings_fingerprint_active"
    ON "triage_findings"("fingerprint")
    WHERE "status" IN ('OPEN', 'ESCALATED', 'DEFERRED');

CREATE UNIQUE INDEX "uq_source_relevance_tenant_source_page" ON "source_relevance"("tenant_id", "source_id", "page_id");
CREATE INDEX "idx_source_relevance_tenant_source" ON "source_relevance"("tenant_id", "source_id");
CREATE INDEX "idx_source_relevance_tenant_page" ON "source_relevance"("tenant_id", "page_id");

CREATE UNIQUE INDEX "uq_triage_digests_tenant_period" ON "triage_digests"("tenant_id", "period_key");
CREATE INDEX "idx_triage_digests_tenant_notified" ON "triage_digests"("tenant_id", "notified_at");

-- 4. Foreign keys.
-- Tenant FKs cascade (whole-tenant purge cleans these rows).
ALTER TABLE "triage_runs" ADD CONSTRAINT "triage_runs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "triage_cursors" ADD CONSTRAINT "triage_cursors_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "triage_findings" ADD CONSTRAINT "triage_findings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "source_relevance" ADD CONSTRAINT "source_relevance_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "triage_digests" ADD CONSTRAINT "triage_digests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Finding entity FKs: SET NULL on purge (retain display evidence). No composite
-- (tenant_id,*) FK — SET NULL cannot null the NOT NULL tenant_id column; the
-- worker rechecks FK tenant-consistency in the finding-write transaction instead.
ALTER TABLE "triage_findings" ADD CONSTRAINT "triage_findings_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "triage_findings" ADD CONSTRAINT "triage_findings_related_page_id_fkey" FOREIGN KEY ("related_page_id") REFERENCES "pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "triage_findings" ADD CONSTRAINT "triage_findings_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "claims"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "triage_findings" ADD CONSTRAINT "triage_findings_related_claim_id_fkey" FOREIGN KEY ("related_claim_id") REFERENCES "claims"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "triage_findings" ADD CONSTRAINT "triage_findings_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- SourceRelevance is a pure tag row (no display value once its page/source is
-- gone) → CASCADE on purge.
ALTER TABLE "source_relevance" ADD CONSTRAINT "source_relevance_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "source_relevance" ADD CONSTRAINT "source_relevance_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
