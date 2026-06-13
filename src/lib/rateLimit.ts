/**
 * Shared rate-limiting abstraction.
 *
 * The public surface is intentionally a single function — `checkRateLimit(key, opts)` —
 * plus a pluggable `RateLimitStore` interface. Today the only store is an in-process
 * `Map` (`InMemoryRateLimitStore`), which is fine for a single instance but resets on
 * restart and does NOT share state across processes/instances.
 *
 * FOLLOW-UP (multi-instance correctness): implement a `RedisRateLimitStore` (or a
 * DB-backed store) that satisfies the same `RateLimitStore` interface and swap it in via
 * `setRateLimitStore()`. No caller needs to change — they only ever see `checkRateLimit`.
 *
 * Two limiters already exist in the codebase (`src/lib/summary/rateLimiter.ts`,
 * `src/lib/agent/ratelimit.ts`). FOLLOW-UP: consolidate those onto this abstraction so
 * the whole app shares one limiter implementation (and one future Redis backend).
 */

export interface RateLimitOptions {
  /** Maximum number of allowed hits within the window. */
  limit: number;
  /** Length of the rolling window, in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  /** Whether this request is allowed (true) or should be rejected (false). */
  allowed: boolean;
  /** Hits remaining in the current window after this call (0 when blocked). */
  remaining: number;
  /** Epoch-ms timestamp at which the current window resets. */
  resetAt: number;
}

/**
 * Pluggable backend. A store decides whether a key may proceed under the given options
 * and is responsible for its own bookkeeping (counts, windows, eviction).
 *
 * Implementations MUST be safe to call concurrently for the same key within a single
 * runtime. A distributed implementation (Redis/DB) additionally makes the decision
 * correct across instances.
 */
export interface RateLimitStore {
  hit(key: string, options: RateLimitOptions): RateLimitResult;
}

interface WindowEntry {
  count: number;
  resetAt: number;
}

/**
 * Default in-memory, fixed-window store. Single-process only.
 *
 * Lazily evicts expired windows on access; also runs a light sweep so a process that
 * sees many distinct keys does not leak memory indefinitely.
 */
export class InMemoryRateLimitStore implements RateLimitStore {
  private windows = new Map<string, WindowEntry>();
  private lastSweep = 0;
  private static readonly SWEEP_INTERVAL_MS = 60_000;

  hit(key: string, options: RateLimitOptions): RateLimitResult {
    const now = Date.now();
    this.maybeSweep(now);

    const entry = this.windows.get(key);

    if (!entry || now >= entry.resetAt) {
      const resetAt = now + options.windowMs;
      this.windows.set(key, { count: 1, resetAt });
      return { allowed: true, remaining: Math.max(0, options.limit - 1), resetAt };
    }

    if (entry.count >= options.limit) {
      return { allowed: false, remaining: 0, resetAt: entry.resetAt };
    }

    entry.count += 1;
    return {
      allowed: true,
      remaining: Math.max(0, options.limit - entry.count),
      resetAt: entry.resetAt,
    };
  }

  /** Drop all tracked windows. Intended for tests. */
  reset(): void {
    this.windows.clear();
    this.lastSweep = 0;
  }

  private maybeSweep(now: number): void {
    if (now - this.lastSweep < InMemoryRateLimitStore.SWEEP_INTERVAL_MS) return;
    this.lastSweep = now;
    for (const [key, entry] of this.windows) {
      if (now >= entry.resetAt) this.windows.delete(key);
    }
  }
}

let activeStore: RateLimitStore = new InMemoryRateLimitStore();

/**
 * Swap the backing store. Call this once at startup to install a distributed store
 * (e.g. Redis) without touching any caller of `checkRateLimit`.
 */
export function setRateLimitStore(store: RateLimitStore): void {
  activeStore = store;
}

/** Access the active store. Exposed mainly so tests can reset in-memory state. */
export function getRateLimitStore(): RateLimitStore {
  return activeStore;
}

/**
 * Record a hit for `key` and report whether it is allowed under `options`.
 *
 * `key` should encode everything that scopes the limit — for the AI routes that means
 * the tenant id plus the route name, e.g. `ai:chat:<tenantId>`.
 */
export function checkRateLimit(
  key: string,
  options: RateLimitOptions
): RateLimitResult {
  return activeStore.hit(key, options);
}
