import type { TenantContext } from "@/types/auth";

/**
 * Permission gate for destructive shared-KB operations (delete / archive / purge
 * of pages, blocks, databases) — audit S4.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * 🔴 INTENTIONALLY A NO-OP — BLOCKED ON A USER DECISION.
 * ──────────────────────────────────────────────────────────────────────────
 * Flipping new users from ADMIN→USER (done in `ensureUserExists`) does NOT, by
 * itself, stop a non-owner USER from deleting shared KB content: the destructive
 * routes are wrapped in `withTenant`, which does NOT consult `User.role`. Only
 * the user-management + broadcast routes use `withAdmin`.
 *
 * The headline NEEDS-USER-INPUT for audit-04 is: should a non-owner USER be
 * blocked from delete/archive/purge of shared KB content? That has NOT been
 * answered, so the gate is deliberately left as a no-op rather than guessed —
 * enabling it would change the authorization model for every existing user.
 *
 * Affected routes (where this would be called, AFTER the decision):
 *   - src/app/api/pages/[id]/route.ts          (update :79, delete :277)
 *   - src/app/api/blocks/[id]/route.ts         (update :44, delete :101)
 *   - src/app/api/databases/[id]/route.ts      (update :60, delete :210)
 *   - src/app/api/pages/[id]/archive/route.ts  (:12)
 *   - src/app/api/pages/[id]/purge/route.ts    (:14)
 *
 * Out of scope here regardless: the AGENT write path is scope-governed
 * (`withAgentAuth`), NOT role-governed — limiting agent writes is scope
 * narrowing (audit-01), not a role gate.
 *
 * TODO(audit-04): pending user decision — block non-owner USER deletes?
 * If "yes", implement (e.g. throw AuthenticationError(403) unless
 * ctx.role === "ADMIN" or the caller is the tenant owner) and wire into the
 * routes above. If "no", S4's write/delete-of-shared-content concern stays
 * explicitly deferred and this stub can be removed.
 */
export function requireDestructivePermission(_ctx: TenantContext): void {
  // No-op until the gating decision is made. See the doc block above.
  return;
}
