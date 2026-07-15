import { describe, test, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Minimal coverage for the OAuth-callback failure path (2026-07-05 CI triage):
// `src/app/auth/callback/route.ts` imports and calls `logAuthEvent` on a failed
// code-exchange, but had no test pinning that call — the missing export broke
// both tsc and the route's build with no test catching it. This test exists so
// a future regression on that path fails a test, not just the typechecker.

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [],
    set: () => {},
  })),
}));

const mockExchangeCodeForSession = vi.fn();
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      exchangeCodeForSession: (...a: unknown[]) =>
        mockExchangeCodeForSession(...a),
    },
  })),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/auth/ensureUserExists", () => ({
  ensureUserExists: vi.fn(),
}));

const mockLogAuthEvent = vi.fn(async (..._a: unknown[]) => {});
vi.mock("@/lib/agent/audit", () => ({
  logAuthEvent: (...a: unknown[]) => mockLogAuthEvent(...a),
}));

const { GET } = await import("@/app/auth/callback/route");

function req(url: string): NextRequest {
  return new NextRequest(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54341";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-not-placeholder";
  delete process.env.NEXT_PUBLIC_SUPABASE_CLOUD_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_CLOUD_ANON_KEY;
  delete process.env.SUPABASE_INTERNAL_URL;
});

describe("GET /auth/callback — OAuth exchange failure (audit S15)", () => {
  test("a failed code exchange is logged via logAuthEvent with an anonymous principal", async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { user: null },
      error: { message: "invalid grant" },
    });

    const res = await GET(
      req("http://localhost:3000/auth/callback?code=bad-code")
    );

    // Structured audit row for the anonymous OAuth-exchange failure.
    expect(mockLogAuthEvent).toHaveBeenCalledWith(
      "oauth.exchange_failed",
      "auth/callback",
      {},
      expect.objectContaining({ reason: "invalid grant" })
    );
    // Still redirects to login on failure rather than throwing.
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login?error=oauth_failed");
  });

  test("a successful code exchange does not log an auth-failure event", async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { user: { id: "user-1", email: "u@example.com" } },
      error: null,
    });

    await GET(req("http://localhost:3000/auth/callback?code=good-code"));

    expect(mockLogAuthEvent).not.toHaveBeenCalledWith(
      "oauth.exchange_failed",
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
  });

  // SKB-02: OAuth success was previously unlogged (only the failure path had
  // coverage). Success is fire-and-forget (not awaited) so it must never
  // delay the redirect.
  test("a successful code exchange logs an oauth.success event", async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { user: { id: "user-1", email: "u@example.com" } },
      error: null,
    });

    const res = await GET(
      req("http://localhost:3000/auth/callback?code=good-code")
    );

    expect(mockLogAuthEvent).toHaveBeenCalledWith(
      "oauth.success",
      "auth/callback",
      expect.objectContaining({ userId: "user-1" })
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/home");
  });
});
