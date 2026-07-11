-- W81-B1: Bitemporal claim edges + contradiction-driven supersession.
--
-- Depends on: W81-A1 (sources), W81-A2 (claims / claim_evidence). Strict order:
--   A70 tree → a71-13 → W81-A1 → W81-A2 → W81-B1 (this).
--
-- ORDER MATTERS (Codex R1 convention): (1) enum, (2) additive columns +
-- BACKFILL of legacy A2 rows, (3) NOT NULL tightening, (4) new table, (5)
-- indexes/uniques, (6) foreign keys, (7) CHECK constraints, (8) re-point the
-- claims→pages FK from CASCADE to NO ACTION (never cascade-delete belief history).

-- 1. Enum: date precision (a bare DateTime cannot carry "~approx").
CREATE TYPE "DatePrecision" AS ENUM ('EXACT', 'APPROX', 'UNKNOWN');

-- 2a. Source event-date columns (when the artifact's content is dated in the
--     world, distinct from ingested_at). Nullable + UNKNOWN by default so every
--     existing Source is untouched and blocks auto-supersession.
ALTER TABLE "sources"
  ADD COLUMN "event_date"     TIMESTAMP(3),
  ADD COLUMN "date_precision" "DatePrecision" NOT NULL DEFAULT 'UNKNOWN';

-- 2b. Claim bitemporal columns. Added NULLABLE first so the backfill can set
--     legacy rows deterministically (tValid := txCreated := created_at) instead
--     of stamping them with the migration wall-clock via a DEFAULT now().
ALTER TABLE "claims"
  ADD COLUMN "t_valid"                 TIMESTAMP(3),
  ADD COLUMN "t_invalid"               TIMESTAMP(3),
  ADD COLUMN "tx_created"              TIMESTAMP(3),
  ADD COLUMN "tx_expired"              TIMESTAMP(3),
  ADD COLUMN "date_precision"          "DatePrecision" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "superseded_by_claim_id"  TEXT,
  ADD COLUMN "supersede_reason"        TEXT;

-- 2c. BACKFILL legacy A2 claims: their world-valid time and system-record time
--     both equal when they were created. date_precision stays UNKNOWN (already
--     the column default) so a legacy claim can never auto-supersede.
UPDATE "claims"
  SET "t_valid" = "created_at",
      "tx_created" = "created_at"
  WHERE "t_valid" IS NULL OR "tx_created" IS NULL;

-- 3. Tighten to NOT NULL + attach the DB-generated default for NEW rows (now()
--    is transaction-time, so t_valid and tx_created coincide on an insert that
--    omits both — the "unknown world date → falls back to txCreated" rule).
ALTER TABLE "claims"
  ALTER COLUMN "t_valid" SET NOT NULL,
  ALTER COLUMN "t_valid" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "tx_created" SET NOT NULL,
  ALTER COLUMN "tx_created" SET DEFAULT CURRENT_TIMESTAMP;

-- 4. claim_supersessions — append-only audit of every applied supersession.
CREATE TABLE "claim_supersessions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "old_claim_id" TEXT NOT NULL,
    "new_claim_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "t_invalid_applied" TIMESTAMP(3) NOT NULL,
    "effective_now" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "claim_supersessions_pkey" PRIMARY KEY ("id")
);

-- 5. Indexes + uniques.
CREATE INDEX "idx_claims_tenant_status_tvalid" ON "claims"("tenant_id", "status", "t_valid");
CREATE INDEX "idx_claims_superseded_by" ON "claims"("superseded_by_claim_id");

CREATE UNIQUE INDEX "uq_claim_supersession_old_new_reason" ON "claim_supersessions"("old_claim_id", "new_claim_id", "reason");
CREATE INDEX "idx_claim_supersession_tenant_old" ON "claim_supersessions"("tenant_id", "old_claim_id");
CREATE INDEX "idx_claim_supersession_tenant_new" ON "claim_supersessions"("tenant_id", "new_claim_id");

-- 6. Foreign keys.
-- Self-relation: the newer claim that superseded this one. NO ACTION — claims are
-- never deleted; a tenant Cascade removes them via their own tenant FK.
ALTER TABLE "claims" ADD CONSTRAINT "claims_superseded_by_claim_id_fkey" FOREIGN KEY ("superseded_by_claim_id") REFERENCES "claims"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "claim_supersessions" ADD CONSTRAINT "claim_supersessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "claim_supersessions" ADD CONSTRAINT "claim_supersessions_old_claim_id_fkey" FOREIGN KEY ("old_claim_id") REFERENCES "claims"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "claim_supersessions" ADD CONSTRAINT "claim_supersessions_new_claim_id_fkey" FOREIGN KEY ("new_claim_id") REFERENCES "claims"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- 7. CHECK: an interval can never invert. When t_invalid is set it MUST be
--    strictly after t_valid, so a superseded claim's valid-time window is real.
ALTER TABLE "claims" ADD CONSTRAINT "chk_claims_tinvalid_after_tvalid" CHECK ("t_invalid" IS NULL OR "t_invalid" > "t_valid");

-- 8. Re-point claims → pages from CASCADE to NO ACTION. Purging a page must NOT
--    cascade-delete its claims (that would erase belief history — the W81-B1
--    never-delete invariant). NO ACTION blocks a direct page delete while claims
--    reference it (hard-purge must archive claims first) yet lets a whole-tenant
--    Cascade still clean up (claims go via their own tenant FK before the
--    end-of-statement check). The A2 migration named this constraint
--    "claims_page_id_fkey".
ALTER TABLE "claims" DROP CONSTRAINT "claims_page_id_fkey";
ALTER TABLE "claims" ADD CONSTRAINT "claims_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
