-- Audit S11: backfill scopes for API keys created before scopes were persisted.
--
-- Before this remediation, `authenticateApiKey` hardcoded ["read","write"] and
-- the key-creation routes never set `scopes`, so every existing row has the
-- default empty array `{}`. Now that scope enforcement reads the column, those
-- legacy rows must be granted read+write so no currently-working key is locked
-- out. New keys default to least-privilege ["read"] at creation.
--
-- Idempotent: only touches rows that are still empty.
UPDATE "api_keys" SET "scopes" = ARRAY['read', 'write'] WHERE "scopes" = '{}';
