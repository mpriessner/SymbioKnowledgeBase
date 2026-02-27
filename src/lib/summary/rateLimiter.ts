/**
 * Token bucket rate limiter for LLM API calls.
 * Per-tenant buckets with configurable rate.
 */

interface Bucket {
  tokens: number;
  lastRefill: number;
}

export class RateLimiter {
  private buckets = new Map<string, Bucket>();
  private maxTokens: number;
  private refillIntervalMs = 60_000; // 1 minute

  constructor(maxPerMinute: number) {
    this.maxTokens = maxPerMinute;
  }

  /**
   * Try to acquire a token for the given tenant.
   * Returns true if a token was available, false if rate limited.
   */
  acquire(tenantId: string): boolean {
    this.refill(tenantId);
    const bucket = this.buckets.get(tenantId);
    if (!bucket || bucket.tokens <= 0) return false;
    bucket.tokens--;
    return true;
  }

  /**
   * Wait until a token is available for the given tenant.
   * Returns after acquiring the token.
   */
  async waitForSlot(tenantId: string): Promise<void> {
    while (!this.acquire(tenantId)) {
      // Wait 1 second and retry
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  private refill(tenantId: string): void {
    const now = Date.now();
    let bucket = this.buckets.get(tenantId);

    if (!bucket) {
      bucket = { tokens: this.maxTokens, lastRefill: now };
      this.buckets.set(tenantId, bucket);
      return;
    }

    const elapsed = now - bucket.lastRefill;
    if (elapsed >= this.refillIntervalMs) {
      bucket.tokens = this.maxTokens;
      bucket.lastRefill = now;
    }
  }
}
