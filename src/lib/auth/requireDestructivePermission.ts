import type { TenantContext } from "@/types/auth";
import { AuthenticationError } from "@/lib/tenantContext";

/**
 * Permission gate for destructive shared-KB operations (delete / trash / restore
 * / purge of pages, blocks, databases) — audit S4.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 * ──────────────────────────────────────────────────────────────────────────
 * Flipping new users from ADMIN→USER (done in `ensureUserExists`) does NOT, by
 * itself, stop a non-admin USER from deleting shared KB content: the destructive
 * routes are wrapped in `withTenant`, which does NOT consult `User.role`. Only
 * the user-management + broadcast routes use `withAdmin`. So a least-privilege
 * USER could still delete/trash/restore every seeded + synced experiment in the
 * shared `DEFAULT_TENANT_ID`.
 *
 * This gate closes that hole: a non-admin USER principal is blocked from the
 * destructive KB routes; ADMIN principals (the owner-equivalent for the shared
 * tenant — `TenantContext` carries the `User.role` enum, which is ADMIN | USER
 * only, NOT a `MEMBER`/`OWNER` value) retain access.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * CONFIG FLAG (defaults to ON / block)
 * ──────────────────────────────────────────────────────────────────────────
 * Behaviour is governed by `SKB_BLOCK_NON_ADMIN_DESTRUCTIVE`:
 *   - unset / "1" / "true"  → ON  (block non-admin USERs — the secure default)
 *   - "0" / "false" / "off" → OFF (legacy behaviour: any tenant member may
 *                                   delete; relax without a code change)
 * Defaulting to ON means the least-privilege posture is the out-of-the-box
 * behaviour; an operator who wants the old shared-write-for-all model can opt
 * out via env, no redeploy of changed code required.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * SCOPE
 * ──────────────────────────────────────────────────────────────────────────
 * Wired into the destructive `withTenant` routes:
 *   - src/app/api/pages/[id]/route.ts          (DELETE)
 *   - src/app/api/pages/[id]/archive/route.ts  (POST — trash)
 *   - src/app/api/pages/[id]/purge/route.ts    (DELETE — permanent delete)
 *   - src/app/api/pages/[id]/restore/route.ts  (POST — restore)
 *   - src/app/api/blocks/[id]/route.ts         (DELETE)
 *   - src/app/api/databases/[id]/route.ts      (DELETE)
 *
 * Out of scope (by design): the AGENT write path is scope-governed
 * (`withAgentAuth` authorizes by per-key `scopes`, NOT `User.role`) — limiting
 * agent writes is scope narrowing (audit-01), not a role gate, so this function
 * is intentionally NOT called from `/api/agent/*`.
 */

/**
 * Returns true when the destructive-op gate is active (block non-admins).
 * Default ON; only an explicit falsy flag value disables it.
 */
export function isDestructiveGateEnabled(): boolean {
  const raw = process.env.SKB_BLOCK_NON_ADMIN_DESTRUCTIVE;
  if (raw === undefined) return true; // default ON
  const normalized = raw.trim().toLowerCase();
  return !(normalized === "0" || normalized === "false" || normalized === "off");
}

/**
 * Throw a 403 `AuthenticationError` if the principal is not allowed to perform a
 * destructive shared-KB operation. ADMIN principals always pass. When the gate
 * is disabled via `SKB_BLOCK_NON_ADMIN_DESTRUCTIVE`, everyone passes (legacy
 * behaviour).
 *
 * `withTenant`'s catch maps `AuthenticationError` to a JSON error response with
 * the carried status/code, so callers just need to invoke this before mutating.
 */
export function requireDestructivePermission(ctx: TenantContext): void {
  if (!isDestructiveGateEnabled()) return;
  if (ctx.role === "ADMIN") return;
  throw new AuthenticationError(
    "Insufficient permissions: destructive operations on shared knowledge-base content require an admin role",
    403,
    "FORBIDDEN"
  );
}
