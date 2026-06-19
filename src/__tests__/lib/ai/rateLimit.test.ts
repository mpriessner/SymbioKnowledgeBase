import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  checkRateLimit,
  InMemoryRateLimitStore,
  setRateLimitStore,
  getRateLimitStore,
} from "@/lib/rateLimit";

describe("rateLimit", () => {
  beforeEach(() => {
    // Reset to a clean in-memory store before each test.
    setRateLimitStore(new InMemoryRateLimitStore());
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows hits up to the limit, then blocks", () => {
    const opts = { limit: 3, windowMs: 60_000 };
    expect(checkRateLimit("k", opts).allowed).toBe(true);
    expect(checkRateLimit("k", opts).allowed).toBe(true);
    expect(checkRateLimit("k", opts).allowed).toBe(true);
    const blocked = checkRateLimit("k", opts);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("reports decreasing remaining counts", () => {
    const opts = { limit: 3, windowMs: 60_000 };
    expect(checkRateLimit("k", opts).remaining).toBe(2);
    expect(checkRateLimit("k", opts).remaining).toBe(1);
    expect(checkRateLimit("k", opts).remaining).toBe(0);
  });

  it("isolates limits by key", () => {
    const opts = { limit: 1, windowMs: 60_000 };
    expect(checkRateLimit("a", opts).allowed).toBe(true);
    expect(checkRateLimit("a", opts).allowed).toBe(false);
    // Different key has its own bucket.
    expect(checkRateLimit("b", opts).allowed).toBe(true);
  });

  it("resets after the window elapses", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const opts = { limit: 1, windowMs: 1_000 };

    expect(checkRateLimit("k", opts).allowed).toBe(true);
    expect(checkRateLimit("k", opts).allowed).toBe(false);

    // Advance past the window.
    vi.setSystemTime(new Date("2026-01-01T00:00:02Z"));
    expect(checkRateLimit("k", opts).allowed).toBe(true);
  });

  it("returns a resetAt in the future on the first hit", () => {
    const before = Date.now();
    const result = checkRateLimit("k", { limit: 5, windowMs: 60_000 });
    expect(result.resetAt).toBeGreaterThan(before);
  });

  it("supports swapping the store backend (Redis/DB drop-in seam)", () => {
    const calls: string[] = [];
    setRateLimitStore({
      hit(key) {
        calls.push(key);
        return { allowed: true, remaining: 99, resetAt: Date.now() + 1000 };
      },
    });
    const result = checkRateLimit("custom-key", { limit: 1, windowMs: 1 });
    expect(result.remaining).toBe(99);
    expect(calls).toEqual(["custom-key"]);
    expect(getRateLimitStore()).toBeDefined();
  });

  it("InMemoryRateLimitStore.reset clears tracked windows", () => {
    const store = new InMemoryRateLimitStore();
    const opts = { limit: 1, windowMs: 60_000 };
    expect(store.hit("k", opts).allowed).toBe(true);
    expect(store.hit("k", opts).allowed).toBe(false);
    store.reset();
    expect(store.hit("k", opts).allowed).toBe(true);
  });
});
