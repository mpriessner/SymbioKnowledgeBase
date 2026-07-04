import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const TENANT_ID = "tenant-test-123";
const USER_ID = "user-1";

// Mutable auth context so each test can vary the caller's identity / global role.
const auth = vi.hoisted(() => ({
  ctx: { tenantId: "tenant-test-123", userId: "user-1", role: "MEMBER" },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    tenantMember: {
      findUnique: vi.fn(),
    },
    tenant: {
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth/withTenant", () => ({
  withTenant: (handler: Function) => {
    return async (req: NextRequest, routeContext?: unknown) => {
      const rc = routeContext ?? { params: Promise.resolve({}) };
      return handler(req, auth.ctx, rc);
    };
  },
}));

import { PATCH } from "@/app/api/workspaces/current/route";
import { prisma } from "@/lib/db";

function patchRequest(body: unknown, raw = false) {
  return new NextRequest("http://localhost/api/workspaces/current", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: raw ? (body as string) : JSON.stringify(body),
  });
}

describe("PATCH /api/workspaces/current", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.ctx = { tenantId: TENANT_ID, userId: USER_ID, role: "MEMBER" };
  });

  it("renames the active workspace when the caller is an owner", async () => {
    vi.mocked(prisma.tenantMember.findUnique).mockResolvedValueOnce({
      id: "m1",
      userId: USER_ID,
      tenantId: TENANT_ID,
      role: "owner",
      joinedAt: new Date(),
    } as never);
    vi.mocked(prisma.tenant.update).mockResolvedValueOnce({
      id: TENANT_ID,
      name: "Renamed WS",
      createdAt: new Date("2025-01-01"),
    } as never);

    const res = await PATCH(patchRequest({ name: "Renamed WS" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.name).toBe("Renamed WS");
    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: TENANT_ID },
      data: { name: "Renamed WS" },
    });
  });

  it("renames when the caller is a workspace admin", async () => {
    vi.mocked(prisma.tenantMember.findUnique).mockResolvedValueOnce({
      id: "m1",
      userId: USER_ID,
      tenantId: TENANT_ID,
      role: "admin",
      joinedAt: new Date(),
    } as never);
    vi.mocked(prisma.tenant.update).mockResolvedValueOnce({
      id: TENANT_ID,
      name: "Admin Rename",
      createdAt: new Date("2025-01-01"),
    } as never);

    const res = await PATCH(patchRequest({ name: "Admin Rename" }));
    expect(res.status).toBe(200);
    expect(prisma.tenant.update).toHaveBeenCalled();
  });

  it("trims the name before persisting", async () => {
    vi.mocked(prisma.tenantMember.findUnique).mockResolvedValueOnce({
      role: "owner",
    } as never);
    vi.mocked(prisma.tenant.update).mockResolvedValueOnce({
      id: TENANT_ID,
      name: "Trimmed",
      createdAt: new Date("2025-01-01"),
    } as never);

    const res = await PATCH(patchRequest({ name: "  Trimmed  " }));
    expect(res.status).toBe(200);
    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: TENANT_ID },
      data: { name: "Trimmed" },
    });
  });

  it("returns 403 for a plain member (not owner/admin)", async () => {
    vi.mocked(prisma.tenantMember.findUnique).mockResolvedValueOnce({
      role: "member",
    } as never);

    const res = await PATCH(patchRequest({ name: "Nope" }));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });

  it("returns 403 for a GLOBAL admin who is only a plain member of the workspace (ctx.role trap)", async () => {
    // Caller's global dbUser.role is ADMIN, but their per-workspace membership
    // role is a plain member — the gate must reject based on TenantMember.role.
    auth.ctx = { tenantId: TENANT_ID, userId: USER_ID, role: "ADMIN" };
    vi.mocked(prisma.tenantMember.findUnique).mockResolvedValueOnce({
      role: "member",
    } as never);

    const res = await PATCH(patchRequest({ name: "Global Admin Try" }));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });

  it("returns 404 when the caller has no membership in the tenant", async () => {
    vi.mocked(prisma.tenantMember.findUnique).mockResolvedValueOnce(
      null as never
    );

    const res = await PATCH(patchRequest({ name: "Ghost" }));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });

  it("rejects an empty name with 400", async () => {
    vi.mocked(prisma.tenantMember.findUnique).mockResolvedValueOnce({
      role: "owner",
    } as never);

    const res = await PATCH(patchRequest({ name: "" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });

  it("rejects a whitespace-only name with 400", async () => {
    vi.mocked(prisma.tenantMember.findUnique).mockResolvedValueOnce({
      role: "owner",
    } as never);

    const res = await PATCH(patchRequest({ name: "    " }));
    expect(res.status).toBe(400);
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });

  it("rejects a name longer than 100 characters with 400", async () => {
    vi.mocked(prisma.tenantMember.findUnique).mockResolvedValueOnce({
      role: "owner",
    } as never);

    const res = await PATCH(patchRequest({ name: "a".repeat(101) }));
    expect(res.status).toBe(400);
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON with 400", async () => {
    vi.mocked(prisma.tenantMember.findUnique).mockResolvedValueOnce({
      role: "owner",
    } as never);

    const res = await PATCH(patchRequest("{ not json", true));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });
});
