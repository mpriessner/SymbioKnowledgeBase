-- Audit S15: make AuditLog.user_id / tenant_id nullable so pre-auth / anonymous
-- auth-rejection events can be persisted with a NULL principal. The existing FK
-- constraints are unaffected — a NULL FK value is simply skipped by the check, so
-- a row with NULL user_id/tenant_id is valid while a non-NULL value must still
-- reference a real User/Tenant.
ALTER TABLE "audit_logs" ALTER COLUMN "user_id" DROP NOT NULL;
ALTER TABLE "audit_logs" ALTER COLUMN "tenant_id" DROP NOT NULL;
