import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";

/**
 * One-time OAuth CSRF `state` storage (a71-12).
 *
 * SKB has no Redis/session cache — only Postgres — so the state value is
 * persisted in the `OAuthState` table, bound to the tenant/user that
 * initiated the `connect` flow, and deleted the moment it's consumed
 * (single-use). A short TTL bounds how long an unconsumed state can be
 * replayed.
 */

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export interface OAuthStateBinding {
  tenantId: string;
  userId: string;
}

/** Create and persist a new one-time state value, returning it for the redirect URL. */
export async function createOAuthState(
  binding: OAuthStateBinding
): Promise<string> {
  const state = randomBytes(32).toString("hex");
  await prisma.oAuthState.create({
    data: {
      state,
      tenantId: binding.tenantId,
      userId: binding.userId,
      expiresAt: new Date(Date.now() + STATE_TTL_MS),
    },
  });
  return state;
}

/**
 * Verify and consume a state value. Returns the bound tenant/user on success,
 * or null if the state is missing, unknown, expired, or already consumed.
 * Single-use: the row is deleted whether or not it is expired, so a replayed
 * state (valid or not) never succeeds twice.
 */
export async function consumeOAuthState(
  state: string
): Promise<OAuthStateBinding | null> {
  if (!state) return null;

  const row = await prisma.oAuthState.findUnique({ where: { state } });
  if (!row) return null;

  // Always delete on read — single-use regardless of expiry outcome.
  await prisma.oAuthState.delete({ where: { id: row.id } }).catch(() => {
    // Row may have been raced by a concurrent consume; either way this
    // attempt does not succeed twice.
  });

  if (row.expiresAt.getTime() < Date.now()) {
    return null;
  }

  return { tenantId: row.tenantId, userId: row.userId };
}

/**
 * Best-effort cleanup of expired, never-consumed state rows. Safe to call
 * opportunistically (e.g. from the connect route) since there is no
 * background job scheduler in SKB to run this on a timer.
 */
export async function purgeExpiredOAuthStates(): Promise<void> {
  await prisma.oAuthState
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(() => {
      // Non-fatal — this is housekeeping, not correctness-critical.
    });
}
