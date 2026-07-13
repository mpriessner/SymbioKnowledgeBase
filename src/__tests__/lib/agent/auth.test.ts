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

// Audit logger: spy so we can assert key-usage failures are routed through the
// structured logger (audit S15), not swallowed silently.
const mockLogAuthEvent = vi.fn(async (..._a: unknown[]) => {});
vi.mock("@/lib/agent/audit", () => ({
  logAuthEvent: (...a: unknown[]) => mockLogAuthEvent(...a),
  clientIpFromHeaders: () => undefined,
}));

// bcrypt.compare result is controllable per-test for the bcrypt key path.
let bcryptCompareResult = false;
vi.mock("bcryptjs", () => ({
  default: { compare: vi.fn(async () => bcryptCompareResult) },
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

// The canonical verifier (`@/lib/apiAuth`) resolves an api_keys row with the
// owning user attached via a Prisma `include`; mock rows below mirror that
// shape so this suite exercises the same contract as `resolveApiKey.test.ts`.
function apiKeyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "key-1",
    scopes: ["read", "write"],
    revokedAt: null,
    user: { id: "user-1", tenantId: "tenant-1", role: "USER" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  bcryptCompareResult = false;
  mockApiKeyFindMany.mockResolvedValue([]);
});

describe("withAgentAuth — mock branch removed (audit S1/S7)", () => {
  test("a non-skb_ garbage bearer is no longer accepted (401, not 200)", async () => {
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

// NOTE: the agent path is API-key-only by design (see CLAUDE.md "Agent API");
// there is no Supabase-JWT fallback here to test. A prior revision of this
// suite exercised a JWT code path that no longer exists on `withAgentAuth` —
// removed rather than re-pointed, since there is nothing left to point at.
describe("withAgentAuth — skb_ API key path (audit S11 scopes)", () => {
  test("valid skb_ key authenticates and runs the handler", async () => {
    mockApiKeyFindFirst.mockResolvedValue(apiKeyRow());
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
    mockApiKeyFindFirst.mockResolvedValue(
      apiKeyRow({
        id: "key-ro",
        scopes: ["read"],
        user: { id: "u", tenantId: "t", role: "USER" },
      })
    );

    const res = await call("POST", "Bearer skb_live_readonly");

    expect(res.status).toBe(403);
    expect(okHandler).not.toHaveBeenCalled();
  });

  test("read-only key is allowed (200) on a read (GET)", async () => {
    mockApiKeyFindFirst.mockResolvedValue(
      apiKeyRow({
        id: "key-ro",
        scopes: ["read"],
        user: { id: "u", tenantId: "t", role: "USER" },
      })
    );

    const res = await call("GET", "Bearer skb_live_readonly");
    expect(res.status).toBe(200);
  });

  test("legacy key with empty scopes falls back to read+write (no lockout pre-migration)", async () => {
    mockApiKeyFindFirst.mockResolvedValue(
      apiKeyRow({
        id: "key-legacy",
        scopes: [],
        user: { id: "u", tenantId: "t", role: "USER" },
      })
    );

    const res = await call("POST", "Bearer skb_live_legacy");
    expect(res.status).toBe(200);
  });

  test("unknown skb_ key (no SHA + no bcrypt match) => 401", async () => {
    mockApiKeyFindFirst.mockResolvedValue(null);
    mockApiKeyFindMany.mockResolvedValue([]);

    const res = await call("GET", "Bearer skb_live_nope");
    expect(res.status).toBe(401);
  });

  test("SHA key lastUsedAt failure is routed through the structured logger, not swallowed (audit S15)", async () => {
    mockApiKeyFindFirst.mockResolvedValue(apiKeyRow());
    // lastUsedAt update fails — must NOT fail the request, but must be logged.
    mockApiKeyUpdate.mockRejectedValue(new Error("db write failed"));

    const res = await call("GET", "Bearer skb_live_validkey");
    expect(res.status).toBe(200); // request still succeeds

    // The .catch handler is fire-and-forget; let the microtask queue drain.
    await new Promise((r) => setTimeout(r, 0));

    expect(mockLogAuthEvent).toHaveBeenCalledWith(
      "key.last_used_update_failed",
      "apiKey.lastUsedAt",
      expect.objectContaining({ apiKeyId: "key-1", userId: "user-1", tenantId: "tenant-1" }),
      expect.objectContaining({ reason: "db write failed" })
    );
  });

  test("bcrypt key lastUsedAt failure is also routed through the structured logger (audit S15)", async () => {
    mockApiKeyFindFirst.mockResolvedValue(null);
    mockApiKeyFindMany.mockResolvedValue([
      apiKeyRow({ id: "key-bc", user: { id: "u", tenantId: "t", role: "USER" } }),
    ]);
    bcryptCompareResult = true;
    mockApiKeyUpdate.mockRejectedValue(new Error("bcrypt path db fail"));

    const res = await call("GET", "Bearer skb_live_bcryptkey");
    expect(res.status).toBe(200);

    await new Promise((r) => setTimeout(r, 0));

    expect(mockLogAuthEvent).toHaveBeenCalledWith(
      "key.last_used_update_failed",
      "apiKey.lastUsedAt",
      expect.objectContaining({ apiKeyId: "key-bc" }),
      expect.objectContaining({ reason: "bcrypt path db fail" })
    );
  });
});

// SKB-02: withAgentAuth previously did not call logAuthEvent at all (lost in
// merge d6896fd, not recovered by PR #4). These tests pin the restored wiring:
// rejections are AWAITED, success is fire-and-forget (void, not awaited).
describe("withAgentAuth — auth.reject / auth.success wiring (SKB-02)", () => {
  test("missing Authorization header logs an awaited auth.reject with an anonymous principal", async () => {
    const res = await call("GET");

    expect(res.status).toBe(401);
    expect(mockLogAuthEvent).toHaveBeenCalledWith(
      "auth.reject",
      "GET /api/agent/pages",
      {},
      expect.objectContaining({ reason: expect.any(String) })
    );
  });

  test("invalid/unknown skb_ key logs an awaited auth.reject", async () => {
    mockApiKeyFindFirst.mockResolvedValue(null);
    mockApiKeyFindMany.mockResolvedValue([]);

    const res = await call("GET", "Bearer skb_live_nope");

    expect(res.status).toBe(401);
    expect(mockLogAuthEvent).toHaveBeenCalledWith(
      "auth.reject",
      "GET /api/agent/pages",
      {},
      expect.objectContaining({ reason: expect.any(String) })
    );
  });

  test("insufficient scope (write required) logs an awaited auth.reject with the resolved principal", async () => {
    mockApiKeyFindFirst.mockResolvedValue(
      apiKeyRow({
        id: "key-ro",
        scopes: ["read"],
        user: { id: "u", tenantId: "t", role: "USER" },
      })
    );

    const res = await call("POST", "Bearer skb_live_readonly");

    expect(res.status).toBe(403);
    expect(mockLogAuthEvent).toHaveBeenCalledWith(
      "auth.reject",
      "POST /api/agent/pages",
      expect.objectContaining({ tenantId: "t", userId: "u" }),
      expect.objectContaining({ reason: "missing write scope" })
    );
  });

  test("a successful auth logs auth.success without awaiting it (fire-and-forget)", async () => {
    mockApiKeyFindFirst.mockResolvedValue(apiKeyRow());
    mockApiKeyUpdate.mockResolvedValue({});

    // Make logAuthEvent's promise resolve only after this test's assertions —
    // if withAgentAuth awaited it, the handler would never run in time and
    // `res.status` would not yet be 200.
    let releaseLog: () => void = () => {};
    mockLogAuthEvent.mockImplementationOnce(
      () => new Promise((resolve) => (releaseLog = () => resolve(undefined)))
    );

    const res = await call("GET", "Bearer skb_live_validkey");

    expect(res.status).toBe(200);
    expect(okHandler).toHaveBeenCalledTimes(1);
    expect(mockLogAuthEvent).toHaveBeenCalledWith(
      "auth.success",
      "GET /api/agent/pages",
      expect.objectContaining({
        tenantId: "tenant-1",
        userId: "user-1",
        apiKeyId: "key-1",
      })
    );
    releaseLog();
  });
});
