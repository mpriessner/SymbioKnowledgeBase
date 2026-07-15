# Secret Rotation & Committed-Secret Purge Runbook

**Audit story:** `docs/stories/2026-06-13-audit-02-purge-committed-secrets.md` (findings S3, S9)

This runbook documents the operational steps that accompany the code change which removed
working default secrets from version-controlled files. The code change alone is **hygiene**;
the rotation steps below are the **actual remediation**.

## What the code change did (already committed)

- `docker-compose.yml` (dev): the secret env values are now **required** via `${VAR:?...}` —
  a `docker compose up`/`build` with no `DB_PASSWORD`, `NEXTAUTH_SECRET`, or
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` fails fast with a clear "variable not set" message instead of
  silently booting with the old defaults. The non-secret `NEXT_PUBLIC_SUPABASE_URL` stays
  defaulted (it is not a secret).
- `scripts/seed-demo-experiments.ts`, `scripts/seed-agent-personas.ts`: require `DATABASE_URL`
  from the environment; no inline `postgresql://symbio:symbio_dev_password@...` fallback.
- `scripts/fix-env.js`: no longer bakes `symbio_dev_password`; sources `DB_PASSWORD` from the
  environment or writes a `CHANGE_ME` placeholder with a warning.
- `tests/e2e/global-setup.ts`: sources the anon key + Supabase port from the environment
  (`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `TEST_SUPABASE_PORT`, default port `54341` = the live
  ExpTube Supabase); the public demo JWT is no longer an implicit fallback.

## Public anon key vs the backing secret — do not conflate

The Supabase **anon key** is *public by design* (it ships in client JS). Purging the literal from
the repo is hygiene, not a security fix. The real risk is that the committed demo anon key
(`iss: supabase-demo`) implies the paired Supabase stack may still use the **public** demo JWT
secret (`super-secret-jwt-token-with-at-least-32-characters`), which would let anyone forge a
`service_role` token. The actual remediation is therefore reissuing the Supabase **JWT secret**
+ **service-role key** on ExpTube's stack — NOT just deleting the anon-key string here.

> **NOTE:** `NEXTAUTH_SECRET` is **not** the cookie-auth secret. SKB cookie auth is Supabase
> (`getTenantContext` → `supabase.auth.getUser()`); there is no NextAuth in `src/`.
> `NEXTAUTH_SECRET` is only validated by `docker-entrypoint.prod.sh` / `scripts/deploy-prod.sh`.
> Rotating it does **not** affect session-token validity.

## Rotation steps (operational — perform manually; cross-repo)

1. **Rotate the ExpTube Supabase JWT secret + service-role key** (executed against ExpTube's
   Supabase stack on `localhost:54341`, NOT this repo). This is the step that stops the demo
   key/secret from validating.
2. **Big-bang impact:** the instant the JWT secret changes, every in-flight session token across
   **all four ecosystem apps** (ExpTube, iOS SciSymbioLens, ChemELN, SKB) stops validating, and
   every `service_role` integration 401s until re-keyed. Schedule a maintenance window.
3. **Re-key consumers:** update the Supabase keys wherever they are consumed — SKB `.env`
   (`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`), the Clawdbot Gateway, the
   iOS app, and ChemELN.
4. **Agent API keys:** any committed/leaked `skb_live_…` agent key should be revoked and
   reissued at the same time (see Story 01 for the agent-auth cutover ordering).

## DB-password rotation against an existing volume (BREAKING)

`docker-entrypoint.sh` runs `prisma migrate deploy` at container start. Changing only
`DB_PASSWORD` while the `pgdata` volume still holds the old `symbio` role password makes the
app authenticate with the new password while Postgres still has the old one — migrations fail
**before** the app boots.

To rotate `DB_PASSWORD` on a host with an already-initialized `pgdata` volume, either:

- **In-place:** `ALTER ROLE symbio PASSWORD '<new-password>';` inside the running DB, THEN
  update `DB_PASSWORD` in the environment; **or**
- **Volume reset:** tear down the volume (`docker compose down -v`) and re-init from backup with
  the new password. Only acceptable if the data is reproducible / backed up.

A clean-volume `docker compose up` with a populated `.env` is unaffected.

## .env.example / .env.production.example — MANUAL EDIT REQUIRED

The repository damage-control hook blocks all writes to `.env*` paths (including the
`*.example` files), so these could not be edited automatically. Apply these edits by hand:

### `.env.example`
- `DATABASE_URL` → replace `symbio_dev_password` with `CHANGE_ME`:
  `DATABASE_URL="postgresql://symbio:CHANGE_ME@localhost:5432/symbio?schema=public"`
- `DB_PASSWORD` → `DB_PASSWORD="CHANGE_ME"` (was `symbio_dev_password`)
- Add the sync secrets (consumed by `/api/sync/experiments`, `/api/sync/reconcile`, and
  `reconciliationSync.ts`, which read `EXPTUBE_API_KEY || SYNC_SERVICE_KEY`):
  ```
  # ── ChemELN/ExpTube Sync ──────────────────────────────────
  # Shared bearer token for the server-to-server sync endpoints. Without it, sync 401s.
  SYNC_SERVICE_KEY=""
  # Optional override used by the outbound reconciliation client; falls back to SYNC_SERVICE_KEY.
  EXPTUBE_API_KEY=""
  ```
- Document `NEXTAUTH_SECRET` (if kept for the prod entrypoint) as "prod-entrypoint check only —
  NOT the cookie-auth secret (auth is Supabase)".

### `.env.production.example`
- Add the same `SYNC_SERVICE_KEY` / `EXPTUBE_API_KEY` entries (marked `[REQUIRED]` if sync is used).

## Known pre-existing gaps (flagged, not fixed by this story)

- **`Dockerfile.prod` lacks the `NEXT_PUBLIC_*` ARG declarations** that the dev `Dockerfile` has,
  so production images built from it bake **empty** client-side Supabase values → prod login + the
  cloud→local auth callback are already broken. `docker-compose.prod.yml` also does not pass the
  `NEXT_PUBLIC_*` / `SUPABASE_INTERNAL_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `DEFAULT_TENANT_ID` /
  sync env into the app. Fixing this is a small adjacent prod-build story (recommended fast
  follow-up; not part of the secret purge).
- **Git history** still contains the old secrets. This story removes them from the working tree
  but does not scrub history (a destructive `git filter-repo` / force-push is a separate
  operational decision). Treat the committed values as compromised → the rotation above is the
  real fix.
- **`scripts/test-agent-contract.sh`** (cited in the story as carrying a committed `skb_live_`
  token) **does not exist in this checkout** — no purge needed here. No real `skb_live_…` token is
  committed anywhere in the working tree (only test fixtures and `skb_live_xxx` doc placeholders).
