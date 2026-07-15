import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const TENANT_ID = "tenant-test-123";
const USER_ID = "user-1";

const mockTenantMemberUpsert = vi.fn();
const mockTenantMemberFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    tenantMember: {
      upsert: (...a: unknown[]) => mockTenantMemberUpsert(...a),
      findMany: (...a: unknown[]) => mockTenantMemberFindMany(...a),
    },
  },
}));

vi.mock("@/lib/auth/withTenant", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  withTenant: (handler: any) => {
    return async (req: NextRequest, routeContext?: unknown) => {
      const ctx = { tenantId: TENANT_ID, userId: USER_ID, role: "USER" };
      const rc = routeContext ?? { params: Promise.resolve({}) };
      return handler(req, ctx, rc);
    };
  },
}));

const { GET } = await import("@/app/api/workspaces/route");

function req(): NextRequest {
  return new NextRequest("http://localhost:3000/api/workspaces");
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTenantMemberUpsert.mockResolvedValue({});
  mockTenantMemberFindMany.mockResolvedValue([]);
});

describe("GET /api/workspaces — auto-repair least privilege (audit S4)", () => {
  it("auto-repairs a missing TenantMember as 'member', not 'owner'", async () => {
    await GET(req());

    expect(mockTenantMemberUpsert).toHaveBeenCalledTimes(1);
    const arg = mockTenantMemberUpsert.mock.calls[0][0];
    expect(arg.create.role).toBe("member");
    // update:{} means an EXISTING membership keeps its role (no re-promotion).
    expect(arg.update).toEqual({});
  });
});
