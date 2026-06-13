# Agent-Auth Cutover Runbook (audit-01)

**Story:** `docs/stories/2026-06-13-audit-01-real-auth-on-agent-path.md` (S1, S2, S7, S11)

> 🔴 **HARD SEQUENCING CONSTRAINT — READ BEFORE DEPLOYING.**
> The mock-auth branch on the agent path was DELETED in code. The instant this ships,
> any caller sending a bearer token that is neither a valid `skb_` API key nor a valid
> Supabase JWT gets **401** with no grace period. Every live caller MUST be migrated to a
> real credential **before** this code reaches production.

## What changed in code (already committed)

- **`/api/agent/*`** (`withAgentAuth`): the `else` branch that accepted ANY non-`skb_` bearer
  as `mock-user-id` / `DEFAULT_TENANT_ID` with `["read","write"]` is gone. The agent path now
  accepts:
  1. a valid `skb_` API key (verified against `api_keys`, with **per-key scopes**), or
  2. a valid Supabase access token (JWT), verified via `supabase.auth.getUser(token)` and
     mapped to a Prisma user/tenant via `ensureUserExists`.
  Anything else → 401.
- **Scopes (S11):** `authenticateApiKey` now reads the key's persisted `scopes` column. Legacy
  rows with empty scopes fall back to `["read","write"]` until the backfill migration runs
  (`prisma/migrations/20260613170000_backfill_api_key_scopes`). NEW keys default to
  least-privilege `["read"]`; request `["write"]` explicitly for CRUD.
- **Dev/ADMIN fallback (S2):** the "Supabase not configured ⇒ dev-user/ADMIN" behavior in
  `updateSession` and `getTenantContext` now requires `NODE_ENV !== "production"` AND
  `ALLOW_DEV_AUTH=1`. In production, missing Supabase config **fails the boot** (via
  `src/instrumentation.ts` → `assertSupabaseConfiguredInProd`), rather than silently opening the
  instance.
- **API 401, not redirect:** middleware now lets unauthenticated `/api/*` fall through to the
  route's own JSON 401 instead of 307-redirecting to `/login`.

## Inventory of live agent-path callers (must be migrated FIRST)

| Caller | Where | Credential today | Action before cutover |
|---|---|---|---|
| **Clawdbot Gateway** (iOS → Gateway → `/api/agent/kb-query`) | External — `~/clawd` on the Mac mini (port 18799), NOT in this repo | Unverifiable from here; per the mock path it could be any bearer | Mint an `skb_live_…` key (or forward the user's Supabase JWT) and set the Gateway's SKB auth to send it |
| **ChemELN sync writer** | `src/lib/chemEln/sync/writer.ts` (sends `Authorization: Bearer ${SKB_AGENT_API_KEY}` to `/api/agent/pages`) | `process.env.SKB_AGENT_API_KEY` | Ensure `SKB_AGENT_API_KEY` is a real `skb_live_…` key with `["read","write"]` scope |

> The `src/app/api/ai/*` routes also send `Authorization: Bearer ${apiKey}`, but those call
> **outbound LLM providers** (OpenAI/Anthropic), NOT SKB's agent API — they are unaffected.

## Deploy order (do NOT reorder)

1. **Mint the credential(s):** create an `skb_live_…` API key for the Gateway and confirm
   `SKB_AGENT_API_KEY` (used by `writer.ts`) is a real `skb_live_…` key. If you want per-end-user
   attribution on voice queries instead, configure the Gateway to forward the user's Supabase
   access token (the JWT path is implemented and ready).
   - **Scope note:** a brand-new key now defaults to `["read"]`. The Gateway's `kb-query` is a
     GET (read) — fine. But `writer.ts` does **page create/update/delete** (writes), so its key
     MUST be granted `["read","write"]` at creation, or those writes 403.
2. **Update the callers** to send the real credential (Gateway config + `SKB_AGENT_API_KEY`).
3. **Verify against the still-mock-free pre-prod / current prod:** confirm a live `kb-query`
   succeeds with the `skb_` key (or JWT) BEFORE the mock deletion is the running code. Because
   `skb_` keys already worked end-to-end before this change, you can verify the Gateway's new key
   against the *current* deployment first.
4. **Run the scopes backfill migration** (`20260613170000_backfill_api_key_scopes`) as part of the
   deploy so every pre-existing key keeps `["read","write"]` (no lockout). The code has a
   temporary empty-scopes fallback so ordering is forgiving, but run it to make scopes real.
5. **Ensure production Supabase env is set** (`NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY`,
   `SUPABASE_INTERNAL_URL` for Docker) — otherwise the new `assertSupabaseConfiguredInProd` will
   **refuse to boot**. This is intentional (S2).
6. **Only then** ship the mock-deletion code to production.

## Optional one-deploy safety valve

If you cannot fully verify the Gateway cutover ahead of time, you may add a time-boxed,
**default-off** `AGENT_ALLOW_MOCK=1` env flag for a single deploy so prod can be flipped after the
Gateway cutover is confirmed, then removed. This was deliberately NOT implemented (default-off or
not, it is an open door); prefer the verify-first ordering above. Implement it only if ops needs
the rollback window.

## Codex-confirmed facts (de-risk the cutover)

- `@supabase/supabase-js@2.97.0` → `auth-js` `getUser(jwt?: string)` accepts the token and
  validates it server-side against ExpTube's stack; `ensureUserExists` already handles the
  cross-app SSO mapping. The JWT path is technically sound.
- `getUser(token)` does **not** throw on a bad token — it returns `{ user: null, error }`. The
  code checks **both** and returns 401 for either.
- An `skb_` key never reaches `getUser` (the `startsWith("skb_")` branch is first), so there is no
  "getUser mis-parses an API key" hazard.
- JWT-authenticated users land in the shared `DEFAULT_TENANT_ID` via `ensureUserExists` — the same
  placement the mock produced (no NEW cross-tenant leak). Least-privilege provisioning for those
  users is audit-04's job.
