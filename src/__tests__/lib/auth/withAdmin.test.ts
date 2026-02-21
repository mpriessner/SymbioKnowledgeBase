import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/tenantContext", () => ({
  getTenantContext: vi.fn(),
  AuthenticationError: class AuthenticationError extends Error {
    statusCode: number;
    errorCode: string;
    constructor(
      message: string,
      statusCode = 401,
      errorCode = "UNAUTHORIZED"
    ) {
      super(message);
      this.statusCode = statusCode;
      this.errorCode = errorCode;
    }
  },
}));

import { getTenantContext, AuthenticationError } from "@/lib/tenantContext";
import { withAdmin } from "@/lib/auth/withAdmin";

const mockedGetTenantContext = vi.mocked(getTenantContext);

function createMockRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/users");
}

describe("withAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows ADMIN role to proceed", async () => {
    mockedGetTenantContext.mockResolvedValue({
      tenantId: "tenant-1",
      userId: "admin-1",
      role: "ADMIN",
    });

    const handler = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: "ok" }), { status: 200 })
    );

    const wrappedHandler = withAdmin(handler);
    const req = createMockRequest();
    const response = await wrappedHandler(req);

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(
      req,
      { tenantId: "tenant-1", userId: "admin-1", role: "ADMIN" },
      {}
    );
  });

  it("rejects USER role with 403", async () => {
    mockedGetTenantContext.mockResolvedValue({
      tenantId: "tenant-1",
      userId: "user-1",
      role: "USER",
    });

    const handler = vi.fn();
    const wrappedHandler = withAdmin(handler);
    const req = createMockRequest();
    const response = await wrappedHandler(req);

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe("FORBIDDEN");
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 401 when not authenticated", async () => {
    mockedGetTenantContext.mockRejectedValue(
      new AuthenticationError("Authentication required")
    );

    const handler = vi.fn();
    const wrappedHandler = withAdmin(handler);
    const req = createMockRequest();
    const response = await wrappedHandler(req);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 500 for unexpected errors", async () => {
    mockedGetTenantContext.mockRejectedValue(
      new Error("Database connection failed")
    );

    const handler = vi.fn();
    const wrappedHandler = withAdmin(handler);
    const req = createMockRequest();
    const response = await wrappedHandler(req);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });

  it("resolves route params and passes them to handler", async () => {
    mockedGetTenantContext.mockResolvedValue({
      tenantId: "tenant-1",
      userId: "admin-1",
      role: "ADMIN",
    });

    const handler = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: "ok" }), { status: 200 })
    );

    const wrappedHandler = withAdmin(handler);
    const req = createMockRequest();
    const routeContext = {
      params: Promise.resolve({ id: "user-123" }),
    };
    await wrappedHandler(req, routeContext);

    expect(handler).toHaveBeenCalledWith(
      req,
      { tenantId: "tenant-1", userId: "admin-1", role: "ADMIN" },
      { id: "user-123" }
    );
  });
});
