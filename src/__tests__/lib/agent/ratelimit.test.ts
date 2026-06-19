import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { checkRateLimit } from "@/lib/agent/ratelimit";

beforeEach(() => {
  vi.useRealTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("checkRateLimit — per-principal buckets (audit S8)", () => {
  test("distinct principals do NOT share a bucket", async () => {
    // Exhaust principal A.
    let last = { allowed: true, remaining: 100, resetAt: 0 };
    for (let i = 0; i < 105; i++) {
      last = await checkRateLimit("principal-A");
    }
    expect(last.allowed).toBe(false);

    // Principal B is unaffected.
    const b = await checkRateLimit("principal-B");
    expect(b.allowed).toBe(true);
    expect(b.remaining).toBe(99);
  });

  test("first request reports remaining 99 of 100", async () => {
    const r = await checkRateLimit("fresh-principal");
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(99);
    expect(r.resetAt).toBeGreaterThan(Date.now());
  });
});

describe("checkRateLimit — lazy window pruning (no import-time timer)", () => {
  test("entries older than the window are dropped on access", async () => {
    const start = 1_000_000_000_000;
    vi.useFakeTimers();
    vi.setSystemTime(start);

    // Fill the bucket near the limit.
    for (let i = 0; i < 100; i++) await checkRateLimit("ttl-principal");
    const atLimit = await checkRateLimit("ttl-principal"); // 101st => blocked
    expect(atLimit.allowed).toBe(false);

    // Advance beyond the 60s window: old timestamps expire, bucket resets.
    vi.setSystemTime(start + 61_000);
    const afterWindow = await checkRateLimit("ttl-principal");
    expect(afterWindow.allowed).toBe(true);
    expect(afterWindow.remaining).toBe(99);
  });

  test("module does NOT register a background timer at import", async () => {
    // The setInterval foot-gun was removed; importing the module must not
    // schedule any timer. (If it did, fake timers would show a pending timer.)
    vi.useFakeTimers();
    const before = vi.getTimerCount();
    await import("@/lib/agent/ratelimit");
    expect(vi.getTimerCount()).toBe(before);
  });
});
