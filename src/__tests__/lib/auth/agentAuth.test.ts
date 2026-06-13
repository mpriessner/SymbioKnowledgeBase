import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Canonical verifier is mocked — we only test the wrapper's auth/scope logic.
vi.mock("@/lib/apiAuth", () => ({
  resolveApiKey: vi.fn(),
}));

// Rate limiter always allows in these tests.
vi.mock("@/lib/agent/ratelimit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({
    allowed: true,
    remaining: 99,
    resetAt: Date.now() + 60_000,
  }),
}));

import { withAgentAuth } from "@/lib/agent/auth";
import { resolveApiKey } from "@/lib/apiAuth";

const mockedResolveApiKey = vi.mocked(resolveApiKey);

function req(method: string, headers: Record<string, string> = {}): NextRequest {
  const h = new Headers();
  Object.entries(headers).forEach(([k, v]) => h.set(k, v));
  return new NextRequest("http://localhost:3000/api/agent/pages", {
    method,
    headers: h,
  });
}

function okHandler() {
  return vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
}

describe("withAgentAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("401s when the Authorization header is missing", async () => {
    const handler = okHandler();
    const res = await withAgentAuth(handler)(req("GET"));
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("401s for any token that is not a valid key (mock backdoor removed)", async () => {
    // A non-skb_ token no longer grants a mock-user/default-tenant context.
    mockedResolveApiKey.mockResolvedValue(null);

    const handler = okHandler();
    const res = await withAgentAuth(handler)(
      req("POST", { authorization: "Bearer not-a-real-key" })
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(handler).not.toHaveBeenCalled();
  });

  it("passes a valid key's context through to the handler", async () => {
    mockedResolveApiKey.mockResolvedValue({
      tenantId: "tenant-1",
      userId: "user-1",
      role: "USER",
      apiKeyId: "key-1",
      scopes: ["read", "write"],
    });

    const handler = okHandler();
    const res = await withAgentAuth(handler)(
      req("GET", { authorization: "Bearer skb_live_valid" })
    );

    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
    const passedCtx = handler.mock.calls[0][1];
    expect(passedCtx).toMatchObject({
      tenantId: "tenant-1",
      userId: "user-1",
      apiKeyId: "key-1",
      scopes: ["read", "write"],
    });
  });

  it("enforces real scopes: a read-only key cannot mutate (403)", async () => {
    mockedResolveApiKey.mockResolvedValue({
      tenantId: "tenant-1",
      userId: "user-1",
      role: "USER",
      apiKeyId: "key-1",
      scopes: ["read"],
    });

    const handler = okHandler();
    const res = await withAgentAuth(handler)(
      req("POST", { authorization: "Bearer skb_live_readonly" })
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("FORBIDDEN");
    expect(handler).not.toHaveBeenCalled();
  });

  it("enforces real scopes: a write-only key cannot read (403)", async () => {
    mockedResolveApiKey.mockResolvedValue({
      tenantId: "tenant-1",
      userId: "user-1",
      role: "USER",
      apiKeyId: "key-1",
      scopes: ["write"],
    });

    const handler = okHandler();
    const res = await withAgentAuth(handler)(
      req("GET", { authorization: "Bearer skb_live_writeonly" })
    );

    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("allows a read-only key to perform a GET", async () => {
    mockedResolveApiKey.mockResolvedValue({
      tenantId: "tenant-1",
      userId: "user-1",
      role: "USER",
      apiKeyId: "key-1",
      scopes: ["read"],
    });

    const handler = okHandler();
    const res = await withAgentAuth(handler)(
      req("GET", { authorization: "Bearer skb_live_readonly" })
    );

    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
