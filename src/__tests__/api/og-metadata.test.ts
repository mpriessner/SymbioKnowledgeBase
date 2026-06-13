import { describe, test, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock auth: control whether getTenantContext succeeds or throws.
const mockGetTenantContext = vi.fn();
const { AuthenticationError } = await import("@/lib/tenantContext");
vi.mock("@/lib/tenantContext", async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return {
    ...actual,
    getTenantContext: (...a: unknown[]) => mockGetTenantContext(...a),
  };
});

// Mock the SSRF guard so we test the route wiring, not DNS.
const mockAssert = vi.fn();
vi.mock("@/lib/security/ssrfGuard", async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return {
    ...actual,
    assertUrlIsFetchable: (...a: unknown[]) => mockAssert(...a),
  };
});

const { POST } = await import("@/app/api/og-metadata/route");
const { BlockedUrlError } = await import("@/lib/security/ssrfGuard");

function post(body: unknown, headers: Record<string, string> = {}): NextRequest {
  const h = new Headers({ "Content-Type": "application/json", ...headers });
  return new NextRequest("http://localhost:3000/api/og-metadata", {
    method: "POST",
    headers: h,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: authenticated.
  mockGetTenantContext.mockResolvedValue({ tenantId: "t", userId: "u", role: "USER" });
});

describe("POST /api/og-metadata — auth (audit S5)", () => {
  test("unauthenticated (auth wrapper throws 401) => JSON 401, no fetch", async () => {
    mockGetTenantContext.mockRejectedValue(
      new AuthenticationError("Invalid or revoked API key", 401)
    );
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const res = await POST(post({ url: "https://example.com" }, { authorization: "Bearer junk" }));

    expect(res.status).toBe(401);
    expect(mockAssert).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe("POST /api/og-metadata — SSRF guard (audit S5)", () => {
  test("blocked URL => 422, no outbound fetch", async () => {
    mockAssert.mockRejectedValue(new BlockedUrlError("blocked"));
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const res = await POST(post({ url: "http://169.254.169.254/" }));

    expect(res.status).toBe(422);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  test("validation error for a non-URL body => 400", async () => {
    const res = await POST(post({ url: "not-a-url" }));
    expect(res.status).toBe(400);
  });

  test("public URL passes the guard and fetches with redirect:error", async () => {
    mockAssert.mockResolvedValue(new URL("https://example.com/"));
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<html><head><title>Hi</title></head></html>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      })
    );

    const res = await POST(post({ url: "https://example.com" }));

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(init.redirect).toBe("error");
    fetchSpy.mockRestore();
  });
});
