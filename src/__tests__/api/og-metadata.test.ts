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

// NOTE: the route does its OWN inline DNS/net SSRF validation (isPublicHttpUrl
// below it) rather than calling `@/lib/security/ssrfGuard` — that module is
// currently unused by any route (dead code, tracked separately; out of scope
// for this fix). So the SSRF checks below exercise the route's real guard via
// a literal blocked IP, not a mock.
const { POST } = await import("@/app/api/og-metadata/route");

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
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe("POST /api/og-metadata — SSRF guard (audit S5)", () => {
  test("blocked URL => 502, no outbound fetch", async () => {
    // A literal blocked IP is rejected by the route's own inline validation
    // before any fetch is attempted — no DNS lookup needed for a literal IP.
    // The route returns a generic 502 (not the blocked reason) so it never
    // reveals to the caller why a host was rejected.
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const res = await POST(post({ url: "http://169.254.169.254/" }));

    expect(res.status).toBe(502);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  test("validation error for a non-URL body => 400", async () => {
    const res = await POST(post({ url: "not-a-url" }));
    expect(res.status).toBe(400);
  });

  test("public URL passes the guard and fetches with redirect:manual", async () => {
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
    // The route follows redirects manually, re-validating each hop, rather
    // than letting fetch auto-follow to a possibly-internal host.
    expect(init.redirect).toBe("manual");
    fetchSpy.mockRestore();
  });
});
