/**
 * In-memory, NON-BLOCKING sliding-window rate limiter for the agent middleware
 * (audit S8). Returns {allowed, remaining, resetAt} immediately so the caller can
 * emit a 429 with X-RateLimit-* headers — deliberately distinct from the BLOCKING
 * TokenBucketRateLimiter (which awaits a slot to pace OUTGOING requests); do not
 * converge them.
 *
 * Single-instance only: the agent routes run on the Node.js runtime (long-lived
 * process) so the map persists across requests as intended. Behind multiple
 * replicas the limit holds per-instance, not globally — swap to a shared store
 * (Postgres/Redis) if SKB is ever horizontally scaled. No background timer: stale
 * keys are pruned lazily on access (the old module-load setInterval leaked one
 * timer per worker and never cleared).
 */

const RATE_LIMIT = 100; // requests per minute
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_TRACKED_KEYS = 10_000; // bound memory if many distinct principals appear

// In-memory store: key → array of request timestamps
const requestWindows = new Map<string, number[]>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Opportunistically drop fully-expired keys to bound memory without a timer.
 * Only runs the full sweep when the map grows past the cap.
 */
function pruneIfNeeded(now: number): void {
  if (requestWindows.size <= MAX_TRACKED_KEYS) return;
  const windowStart = now - WINDOW_MS;
  for (const [key, timestamps] of requestWindows.entries()) {
    if (timestamps.every((t) => t <= windowStart)) {
      requestWindows.delete(key);
    }
  }
}

export async function checkRateLimit(key: string): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  // Get the window and drop entries outside it (lazy prune for THIS key).
  let timestamps = (requestWindows.get(key) || []).filter((t) => t > windowStart);

  // Add current request
  timestamps.push(now);
  requestWindows.set(key, timestamps);

  pruneIfNeeded(now);

  const count = timestamps.length;
  const allowed = count <= RATE_LIMIT;
  const remaining = Math.max(0, RATE_LIMIT - count);
  const resetAt = now + WINDOW_MS;

  return { allowed, remaining, resetAt };
}
