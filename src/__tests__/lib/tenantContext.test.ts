import { describe, test, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// SKB-02: getTenantContext's 401 rejections were unlogged (zero logAuthEvent
// references). These tests pin that every rejection path now emits an
// auth.reject event with an anonymous principal, without changing the
// auth *decision* (still 401 either way).

const mockResolveApiKey = vi.fn();
vi.mock("@/lib/apiAuth", () => ({
  resolveApiKey: (...a: unknown[]) => mockResolveApiKey(...a),
}));

const mockGetUser = vi.fn();
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: (...a: unknown[]) => mockGetUser(...a) },
  })),
}));

vi.mock("@/lib/auth/ensureUserExists", () => ({
  ensureUserExists: vi.fn(),
}));

const mockLogAuthEvent = vi.fn(async (..._a: unknown[]) => {});
vi.mock("@/lib/agent/audit", () => ({
  logAuthEvent: (...a: unknown[]) => mockLogAuthEvent(...a),
  clientIpFromHeaders: () => undefined,
}));

const { getTenantContext } = await import("@/lib/tenantContext");

function req(headers: Record<string, string> = {}): NextRequest {
  const h = new Headers(headers);
  return new NextRequest("http://localhost:3000/api/kb-query", { headers: h });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54341";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-not-placeholder";
  delete process.env.SUPABASE_INTERNAL_URL;
  delete process.env.ALLOW_DEV_AUTH;
  vi.stubEnv("NODE_ENV", "development");
});

describe("getTenantContext — 401 paths log an auth.reject event (SKB-02)", () => {
  test("an invalid/revoked API key rejects with 401 and logs auth.reject", async () => {
    mockResolveApiKey.mockResolvedValue(null);

    await expect(
      getTenantContext(req({ authorization: "Bearer skb_live_bad" }))
    ).rejects.toMatchObject({ statusCode: 401 });

    expect(mockLogAuthEvent).toHaveBeenCalledWith(
      "auth.reject",
      "tenantContext",
      {},
      expect.objectContaining({ reason: "Invalid or revoked API key" })
    );
  });

  test("no session cookie and no API key rejects with 401 and logs auth.reject", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    await expect(getTenantContext(req())).rejects.toMatchObject({
      statusCode: 401,
    });

    expect(mockLogAuthEvent).toHaveBeenCalledWith(
      "auth.reject",
      "tenantContext",
      {},
      expect.objectContaining({
        reason: "No session cookie or API key provided",
      })
    );
  });

  test("Supabase not configured (fail-closed) rejects with 401 and logs auth.reject", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    await expect(getTenantContext(req())).rejects.toMatchObject({
      statusCode: 401,
    });

    expect(mockLogAuthEvent).toHaveBeenCalledWith(
      "auth.reject",
      "tenantContext",
      {},
      expect.objectContaining({ reason: "Supabase is not configured" })
    );
  });

  test("a valid API key does not log a reject event", async () => {
    mockResolveApiKey.mockResolvedValue({
      tenantId: "tenant-1",
      userId: "user-1",
      role: "USER",
    });

    const ctx = await getTenantContext(
      req({ authorization: "Bearer skb_live_good" })
    );

    expect(ctx).toMatchObject({ tenantId: "tenant-1", userId: "user-1" });
    expect(mockLogAuthEvent).not.toHaveBeenCalled();
  });
});
