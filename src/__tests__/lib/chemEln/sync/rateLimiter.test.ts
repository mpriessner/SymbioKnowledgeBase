import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TokenBucketRateLimiter } from "@/lib/chemEln/sync/rateLimiter";

describe("TokenBucketRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should allow burst up to maxTokens without waiting", async () => {
    const limiter = new TokenBucketRateLimiter(3, 1);

    // All three should resolve immediately since we start with 3 tokens
    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();
    // If we got here without hanging, burst succeeded
  });

  it("should block when tokens are exhausted", async () => {
    const limiter = new TokenBucketRateLimiter(1, 1);

    // First acquire uses the single token
    await limiter.acquire();

    // Second acquire should trigger a setTimeout wait
    let resolved = false;
    const promise = limiter.acquire().then(() => {
      resolved = true;
    });

    // The acquire should not have resolved yet
    expect(resolved).toBe(false);

    // Advance time enough for 1 token to refill (1 token/sec = 1000ms)
    await vi.advanceTimersByTimeAsync(1000);

    await promise;
    expect(resolved).toBe(true);
  });

  it("should refill tokens over time", async () => {
    const limiter = new TokenBucketRateLimiter(2, 2); // 2 max, 2 per second

    // Use both tokens
    await limiter.acquire();
    await limiter.acquire();

    // Advance 500ms => should refill 1 token (2 tokens/sec * 0.5s = 1)
    await vi.advanceTimersByTimeAsync(500);

    // Should be able to acquire one more without blocking
    let resolved = false;
    const promise = limiter.acquire().then(() => {
      resolved = true;
    });

    // Let microtasks settle
    await vi.advanceTimersByTimeAsync(0);
    await promise;
    expect(resolved).toBe(true);
  });

  it("should not refill beyond maxTokens", async () => {
    const limiter = new TokenBucketRateLimiter(2, 10); // 2 max, 10 per second

    // Wait a long time - tokens should cap at 2
    await vi.advanceTimersByTimeAsync(5000);

    // Should be able to acquire 2
    await limiter.acquire();
    await limiter.acquire();

    // Third should block
    let resolved = false;
    limiter.acquire().then(() => {
      resolved = true;
    });

    expect(resolved).toBe(false);
  });
});
