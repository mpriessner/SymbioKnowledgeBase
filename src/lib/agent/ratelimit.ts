/**
 * In-memory sliding window rate limiter.
 * TODO: Replace with Redis-backed implementation for production (multi-instance).
 */

const RATE_LIMIT = 100; // requests per minute
const WINDOW_MS = 60 * 1000; // 1 minute

// In-memory store: key → array of request timestamps
const requestWindows = new Map<string, number[]>();

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of requestWindows.entries()) {
    const valid = timestamps.filter((t) => now - t < WINDOW_MS);
    if (valid.length === 0) {
      requestWindows.delete(key);
    } else {
      requestWindows.set(key, valid);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export async function checkRateLimit(key: string): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  // Get or create window
  let timestamps = requestWindows.get(key) || [];

  // Remove entries outside the window
  timestamps = timestamps.filter((t) => t > windowStart);

  // Add current request
  timestamps.push(now);
  requestWindows.set(key, timestamps);

  const count = timestamps.length;
  const allowed = count <= RATE_LIMIT;
  const remaining = Math.max(0, RATE_LIMIT - count);
  const resetAt = now + WINDOW_MS;

  return { allowed, remaining, resetAt };
}
