import { timingSafeEqual } from "crypto";

/**
 * Constant-time string comparison for secrets (e.g. `SYNC_SERVICE_KEY`).
 *
 * Fails closed: returns `false` if either operand is missing/empty, or if
 * the byte lengths differ (a length check is inherently non-constant-time,
 * but leaking the *length* of a shared secret is an accepted trade-off —
 * `timingSafeEqual` itself throws on mismatched buffer lengths).
 */
export function constantTimeEqual(a: string | undefined | null, b: string | undefined | null): boolean {
  if (!a || !b) return false;

  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");

  if (bufA.length !== bufB.length) return false;

  return timingSafeEqual(bufA, bufB);
}
