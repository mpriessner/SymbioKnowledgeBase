import { describe, test, expect, vi, beforeEach } from "vitest";
import type { User } from "@supabase/supabase-js";

// ── Prisma mock ──────────────────────────────────────────────────────────────
const mockUserFindUnique = vi.fn();
const mockUserFindFirst = vi.fn();
const mockUserCreate = vi.fn();
const mockTenantMemberUpsert = vi.fn();
const mockTenantFindUnique = vi.fn();
const mockTenantCreate = vi.fn();

// $transaction(cb) invokes cb with a tx object exposing the same mocked methods.
const tx = {
  user: { create: (...a: unknown[]) => mockUserCreate(...a) },
  tenantMember: { upsert: (...a: unknown[]) => mockTenantMemberUpsert(...a) },
};
const mockTransaction = vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: (...a: unknown[]) => mockUserFindUnique(...a),
      findFirst: (...a: unknown[]) => mockUserFindFirst(...a),
      create: (...a: unknown[]) => mockUserCreate(...a),
    },
    tenantMember: { upsert: (...a: unknown[]) => mockTenantMemberUpsert(...a) },
    tenant: {
      findUnique: (...a: unknown[]) => mockTenantFindUnique(...a),
      create: (...a: unknown[]) => mockTenantCreate(...a),
    },
    $transaction: (cb: (t: typeof tx) => unknown) => mockTransaction(cb),
  },
}));

const { ensureUserExists } = await import("@/lib/auth/ensureUserExists");

function supaUser(overrides: Partial<User> = {}): User {
  return {
    id: "sub-123",
    email: "u@example.com",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  } as User;
}

const SHARED_TENANT = "00000000-0000-4000-a000-000000000001";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.DEFAULT_TENANT_ID = SHARED_TENANT;
  delete process.env.SKB_PERSONAL_TENANT_BY_DEFAULT;
  // By default the shared tenant exists.
  mockTenantFindUnique.mockResolvedValue({ id: SHARED_TENANT });
  mockUserCreate.mockImplementation(async ({ data }: { data: { id: string; tenantId: string; role: string } }) => ({
    id: data.id,
    tenantId: data.tenantId,
    role: data.role,
  }));
  mockTenantMemberUpsert.mockResolvedValue({});
});

describe("ensureUserExists — least-privilege provisioning (audit S4)", () => {
  test("new SSO user is provisioned as USER (not ADMIN) and member (not owner)", async () => {
    mockUserFindUnique.mockResolvedValue(null);

    const result = await ensureUserExists(supaUser());

    expect(result.role).toBe("USER");
    expect(result.tenantId).toBe(SHARED_TENANT);
    // User row created with role USER
    const createArg = mockUserCreate.mock.calls[0][0];
    expect(createArg.data.role).toBe("USER");
    // TenantMember created as "member", not "owner"
    const upsertArg = mockTenantMemberUpsert.mock.calls[0][0];
    expect(upsertArg.create.role).toBe("member");
    expect(upsertArg.update).toEqual({});
  });

  test("new user joins the shared tenant (not siloed) so kb-query still works", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    await ensureUserExists(supaUser());
    expect(mockUserCreate.mock.calls[0][0].data.tenantId).toBe(SHARED_TENANT);
    // Did NOT create a personal tenant by default.
    expect(mockTenantCreate).not.toHaveBeenCalled();
  });

  test("existing user is returned unchanged (no re-provision)", async () => {
    mockUserFindUnique.mockResolvedValue({
      id: "sub-123",
      tenantId: "some-tenant",
      role: "ADMIN",
    });

    const result = await ensureUserExists(supaUser());

    expect(result).toEqual({ id: "sub-123", tenantId: "some-tenant", role: "ADMIN" });
    expect(mockUserCreate).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  test("user_metadata.tenantId takes precedence over the default tenant", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    await ensureUserExists(
      supaUser({ user_metadata: { tenantId: "meta-tenant" } })
    );
    expect(mockUserCreate.mock.calls[0][0].data.tenantId).toBe("meta-tenant");
    // metadata tenant => user is a "member" (did not create it)
    expect(mockTenantMemberUpsert.mock.calls[0][0].create.role).toBe("member");
  });

  test("P2002 (email collision) recovery returns the existing user unchanged", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    const p2002 = Object.assign(new Error("unique"), { code: "P2002" });
    mockTransaction.mockRejectedValueOnce(p2002);
    mockUserFindFirst.mockResolvedValue({
      id: "other-id",
      tenantId: SHARED_TENANT,
      role: "USER",
    });

    const result = await ensureUserExists(supaUser());
    expect(result).toEqual({ id: "other-id", tenantId: SHARED_TENANT, role: "USER" });
  });
});

describe("ensureUserExists — opt-in personal tenant", () => {
  test("SKB_PERSONAL_TENANT_BY_DEFAULT=1 gives a fresh personal tenant as owner", async () => {
    process.env.SKB_PERSONAL_TENANT_BY_DEFAULT = "1";
    mockUserFindUnique.mockResolvedValue(null);
    mockTenantCreate.mockResolvedValue({ id: "personal-tenant-xyz" });

    const result = await ensureUserExists(supaUser());

    expect(mockTenantCreate).toHaveBeenCalled();
    expect(result.tenantId).toBe("personal-tenant-xyz");
    // Creator of their own tenant => "owner"
    expect(mockTenantMemberUpsert.mock.calls[0][0].create.role).toBe("owner");
    // Still role USER (not ADMIN)
    expect(result.role).toBe("USER");
  });

  test("falls back to a personal tenant (owner) when no shared tenant exists", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    mockTenantFindUnique.mockResolvedValue(null); // DEFAULT_TENANT_ID row missing
    mockTenantCreate.mockResolvedValue({ id: "fallback-personal" });

    const result = await ensureUserExists(supaUser());

    expect(result.tenantId).toBe("fallback-personal");
    expect(mockTenantMemberUpsert.mock.calls[0][0].create.role).toBe("owner");
  });
});
