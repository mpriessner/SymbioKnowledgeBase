import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  getTenantContext,
  AuthenticationError,
} from "@/lib/tenantContext";

// Mock next-auth/jwt
vi.mock("next-auth/jwt", () => ({
  getToken: vi.fn(),
}));

// Mock apiAuth
vi.mock("@/lib/apiAuth", () => ({
  resolveApiKey: vi.fn(),
}));

import { getToken } from "next-auth/jwt";
import { resolveApiKey } from "@/lib/apiAuth";

const mockedGetToken = vi.mocked(getToken);
const mockedResolveApiKey = vi.mocked(resolveApiKey);

function createMockRequest(
  headers: Record<string, string> = {}
): NextRequest {
  const headersInit = new Headers();
  Object.entries(headers).forEach(([key, value]) =>
    headersInit.set(key, value)
  );

  return new NextRequest("http://localhost:3000/api/test", {
    headers: headersInit,
  });
}

describe("getTenantContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves tenant context from JWT session", async () => {
    mockedGetToken.mockResolvedValue({
      userId: "user-123",
      tenantId: "tenant-456",
      role: "USER",
      sub: "user-123",
      iat: 0,
      exp: 0,
      jti: "",
    });

    const req = createMockRequest();
    const ctx = await getTenantContext(req);

    expect(ctx).toEqual({
      tenantId: "tenant-456",
      userId: "user-123",
      role: "USER",
    });
  });

  it("resolves tenant context from API key", async () => {
    mockedResolveApiKey.mockResolvedValue({
      tenantId: "tenant-789",
      userId: "user-abc",
      role: "USER",
    });

    const req = createMockRequest({
      authorization: "Bearer skb_live_abcdef1234567890",
    });
    const ctx = await getTenantContext(req);

    expect(ctx).toEqual({
      tenantId: "tenant-789",
      userId: "user-abc",
      role: "USER",
    });
  });

  it("prioritizes API key over JWT session", async () => {
    mockedGetToken.mockResolvedValue({
      userId: "session-user",
      tenantId: "session-tenant",
      role: "USER",
      sub: "session-user",
      iat: 0,
      exp: 0,
      jti: "",
    });
    mockedResolveApiKey.mockResolvedValue({
      tenantId: "apikey-tenant",
      userId: "apikey-user",
      role: "USER",
    });

    const req = createMockRequest({
      authorization: "Bearer skb_live_test",
    });
    const ctx = await getTenantContext(req);

    // API key takes precedence
    expect(ctx.tenantId).toBe("apikey-tenant");
    expect(ctx.userId).toBe("apikey-user");
  });

  it("throws AuthenticationError when no auth is present", async () => {
    mockedGetToken.mockResolvedValue(null);

    const req = createMockRequest();

    await expect(getTenantContext(req)).rejects.toThrow(AuthenticationError);
    await expect(getTenantContext(req)).rejects.toThrow(
      "Authentication required"
    );
  });

  it("throws AuthenticationError when API key is invalid", async () => {
    mockedResolveApiKey.mockResolvedValue(null);

    const req = createMockRequest({
      authorization: "Bearer invalid-key",
    });

    await expect(getTenantContext(req)).rejects.toThrow(AuthenticationError);
    await expect(getTenantContext(req)).rejects.toThrow(
      "Invalid or revoked API key"
    );
  });

  it("throws AuthenticationError when JWT token is missing required fields", async () => {
    mockedGetToken.mockResolvedValue({
      sub: "user-123",
      iat: 0,
      exp: 0,
      jti: "",
      // Missing userId, tenantId, role
    });

    const req = createMockRequest();

    await expect(getTenantContext(req)).rejects.toThrow(AuthenticationError);
  });
});

describe("withTenant (via tenantContext)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes tenant context to handler", async () => {
    // Import withTenant here to get the real implementation
    const { withTenant } = await import("@/lib/auth/withTenant");

    mockedGetToken.mockResolvedValue({
      userId: "user-123",
      tenantId: "tenant-456",
      role: "USER",
      sub: "user-123",
      iat: 0,
      exp: 0,
      jti: "",
    });

    const handler = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: "ok" }), { status: 200 })
    );

    const wrappedHandler = withTenant(handler);
    const req = createMockRequest();
    await wrappedHandler(req);

    expect(handler).toHaveBeenCalledWith(
      req,
      {
        tenantId: "tenant-456",
        userId: "user-123",
        role: "USER",
      },
      expect.objectContaining({ params: expect.anything() })
    );
  });

  it("returns 401 when authentication fails", async () => {
    const { withTenant } = await import("@/lib/auth/withTenant");

    mockedGetToken.mockResolvedValue(null);

    const handler = vi.fn();
    const wrappedHandler = withTenant(handler);

    const req = createMockRequest();
    const response = await wrappedHandler(req);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.meta.timestamp).toBeDefined();
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 500 for unexpected errors", async () => {
    const { withTenant } = await import("@/lib/auth/withTenant");

    mockedGetToken.mockRejectedValue(new Error("Database connection failed"));

    const handler = vi.fn();
    const wrappedHandler = withTenant(handler);

    const req = createMockRequest();
    const response = await wrappedHandler(req);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
