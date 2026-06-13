import { describe, test, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ────────────────────────────────────────────────────────────────────
const mockApiKeyFindFirst = vi.fn();
const mockApiKeyFindMany = vi.fn();
const mockApiKeyUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    apiKey: {
      findFirst: (...a: unknown[]) => mockApiKeyFindFirst(...a),
      findMany: (...a: unknown[]) => mockApiKeyFindMany(...a),
      update: (...a: unknown[]) => mockApiKeyUpdate(...a),
    },
  },
}));

// Rate limiter: always allow so it doesn't interfere with auth assertions.
vi.mock("@/lib/agent/ratelimit", () => ({
  checkRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 99,
    resetAt: Date.now() + 60_000,
  })),
}));

const mockGetUser = vi.fn();
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: (...a: unknown[]) => mockGetUser(...a) },
  })),
}));

const mockEnsureUserExists = vi.fn();
vi.mock("@/lib/auth/ensureUserExists", () => ({
  ensureUserExists: (...a: unknown[]) => mockEnsureUserExists(...a),
}));

const { withAgentAuth } = await import("@/lib/agent/auth");

// ── Helpers ──────────────────────────────────────────────────────────────────
function req(method: string, authHeader?: string): NextRequest {
  const headers = new Headers();
  if (authHeader) headers.set("Authorization", authHeader);
  return new NextRequest("http://localhost:3000/api/agent/pages", {
    method,
    headers,
  });
}

type Ctx = { tenantId: string; userId: string; apiKeyId?: string; scopes: string[] };
const okHandler = vi.fn(
  async (_req: NextRequest, _ctx: Ctx) =>
    new Response(JSON.stringify({ data: "ok" }), { status: 200 })
);

async function call(method: string, authHeader?: string): Promise<Response> {
  return withAgentAuth(okHandler)(req(method, authHeader));
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54341";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-not-placeholder";
  delete process.env.SUPABASE_INTERNAL_URL;
});

describe("withAgentAuth — mock branch removed (audit S1/S7)", () => {
  test("a non-skb_ garbage bearer is no longer accepted (401, not 200)", async () => {
    // No Supabase user for this token => invalid.
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "bad" } });

    const res = await call("GET", "Bearer x");

    expect(res.status).toBe(401);
    expect(okHandler).not.toHaveBeenCalled();
  });

  test("missing Authorization header => 401", async () => {
    const res = await call("GET");
    expect(res.status).toBe(401);
  });

  test("the synthetic mock principal strings are gone from the module", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const src = readFileSync(
      join(process.cwd(), "src/lib/agent/auth.ts"),
      "utf8"
    );
    expect(src).not.toContain("mock-tenant-id");
    expect(src).not.toContain("mock-user-id");
  });
});

describe("withAgentAuth — skb_ API key path (audit S11 scopes)", () => {
  test("valid skb_ key authenticates and runs the handler", async () => {
    mockApiKeyFindFirst.mockResolvedValue({
      id: "key-1",
      tenantId: "tenant-1",
      userId: "user-1",
      scopes: ["read", "write"],
    });
    mockApiKeyUpdate.mockResolvedValue({});

    const res = await call("GET", "Bearer skb_live_validkey");

    expect(res.status).toBe(200);
    expect(okHandler).toHaveBeenCalledTimes(1);
    const [, ctx] = okHandler.mock.calls[0];
    expect(ctx).toMatchObject({
      tenantId: "tenant-1",
      userId: "user-1",
      apiKeyId: "key-1",
      scopes: ["read", "write"],
    });
  });

  test("read-only key is blocked (403) on a write (POST)", async () => {
    mockApiKeyFindFirst.mockResolvedValue({
      id: "key-ro",
      tenantId: "t",
      userId: "u",
      scopes: ["read"],
    });

    const res = await call("POST", "Bearer skb_live_readonly");

    expect(res.status).toBe(403);
    expect(okHandler).not.toHaveBeenCalled();
  });

  test("read-only key is allowed (200) on a read (GET)", async () => {
    mockApiKeyFindFirst.mockResolvedValue({
      id: "key-ro",
      tenantId: "t",
      userId: "u",
      scopes: ["read"],
    });

    const res = await call("GET", "Bearer skb_live_readonly");
    expect(res.status).toBe(200);
  });

  test("legacy key with empty scopes falls back to read+write (no lockout pre-migration)", async () => {
    mockApiKeyFindFirst.mockResolvedValue({
      id: "key-legacy",
      tenantId: "t",
      userId: "u",
      scopes: [],
    });

    const res = await call("POST", "Bearer skb_live_legacy");
    expect(res.status).toBe(200);
  });

  test("unknown skb_ key (no SHA + no bcrypt match) => 401", async () => {
    mockApiKeyFindFirst.mockResolvedValue(null);
    mockApiKeyFindMany.mockResolvedValue([]);

    const res = await call("GET", "Bearer skb_live_nope");
    expect(res.status).toBe(401);
  });
});

describe("withAgentAuth — Supabase JWT path (audit S1/S7 replacement)", () => {
  test("valid JWT is verified and mapped via ensureUserExists", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "sub-123", email: "u@x.io" } },
      error: null,
    });
    mockEnsureUserExists.mockResolvedValue({
      id: "sub-123",
      tenantId: "tenant-x",
      role: "USER",
    });

    const res = await call("GET", "Bearer eyJ.real.jwt");

    expect(res.status).toBe(200);
    expect(mockGetUser).toHaveBeenCalledWith("eyJ.real.jwt");
    const [, ctx] = okHandler.mock.calls[0];
    expect(ctx).toMatchObject({ tenantId: "tenant-x", userId: "sub-123" });
  });

  test("expired/forged JWT (user null + error) => 401, handler not run", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "jwt expired" },
    });

    const res = await call("GET", "Bearer eyJ.expired.jwt");
    expect(res.status).toBe(401);
    expect(okHandler).not.toHaveBeenCalled();
  });

  test("Supabase unconfigured => JWT cannot be verified => 401", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const res = await call("GET", "Bearer eyJ.some.jwt");
    expect(res.status).toBe(401);
    expect(mockGetUser).not.toHaveBeenCalled();
  });
});
