/**
 * W81-C1 — per-tenant advisory lock on a DEDICATED single connection.
 *
 * Under `@prisma/adapter-pg` every pooled Prisma call may land on a DIFFERENT
 * connection, so `pg_try_advisory_lock` → work → `pg_advisory_unlock` issued as
 * ordinary Prisma calls target different sessions and the lock is a silent no-op
 * (two worker runs overlap — GLM R2). This helper takes the lock on its OWN
 * `pg.Client`, holds it for the whole run, and releases it on the SAME client in
 * `finally`. `pg_try_advisory_lock` (non-blocking) means a second concurrent run
 * for the tenant simply declines rather than queueing.
 *
 * The lock only prevents worker/worker overlap; it does NOT serialize C1 against
 * B1/ingest/editor/C2 — that is why every finding write additionally rechecks its
 * precondition with `SELECT … FOR UPDATE` (see findingWriter.ts).
 */

import { Client } from "pg";

/** Stable 32-bit-ish namespace so C1's lock never collides with other advisory locks. */
const LOCK_NAMESPACE = "w81-c1-triage";

export interface LockOutcome<T> {
  acquired: boolean;
  result?: T;
}

/**
 * Run `fn` while holding the per-tenant advisory lock. Returns `{acquired:false}`
 * without running `fn` when another worker already holds it. The dedicated client
 * is always ended in `finally`.
 */
export async function withTenantLock<T>(
  tenantId: string,
  fn: () => Promise<T>,
  connectionString: string | undefined = process.env.DATABASE_URL
): Promise<LockOutcome<T>> {
  if (!connectionString) {
    throw new Error("withTenantLock: DATABASE_URL is not set");
  }
  const client = new Client({ connectionString });
  await client.connect();
  let acquired = false;
  try {
    const res = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock(hashtext($1), hashtext($2)) AS locked",
      [tenantId, LOCK_NAMESPACE]
    );
    acquired = res.rows[0]?.locked === true;
    if (!acquired) {
      return { acquired: false };
    }
    const result = await fn();
    return { acquired: true, result };
  } finally {
    if (acquired) {
      // Release on the SAME connection that took the lock.
      await client
        .query("SELECT pg_advisory_unlock(hashtext($1), hashtext($2))", [
          tenantId,
          LOCK_NAMESPACE,
        ])
        .catch(() => {});
    }
    await client.end().catch(() => {});
  }
}
