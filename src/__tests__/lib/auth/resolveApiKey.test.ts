import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

// Mock the Prisma client used by the canonical verifier.
vi.mock("@/lib/db", () => ({
  prisma: {
    apiKey: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(() => ({ catch: vi.fn() })),
    },
  },
}));

import { resolveApiKey, hashApiKey } from "@/lib/apiAuth";
import { prisma } from "@/lib/db";

const mockedFindFirst = vi.mocked(prisma.apiKey.findFirst);
const mockedFindMany = vi.mocked(prisma.apiKey.findMany);

const RAW_KEY =
  "skb_live_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";

function sha256Row(overrides: Record<string, unknown> = {}) {
  return {
    id: "key-1",
    keyHash: hashApiKey(RAW_KEY),
    keyPrefix: RAW_KEY.substring(0, 15),
    scopes: ["read", "write"],
    revokedAt: null,
    user: { id: "user-1", tenantId: "tenant-1", role: "USER" },
    ...overrides,
  };
}

describe("resolveApiKey (canonical verifier)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFindMany.mockResolvedValue([]);
  });

  it("returns null for a missing or malformed header", async () => {
    expect(await resolveApiKey(null)).toBeNull();
    expect(await resolveApiKey("NotBearer foo")).toBeNull();
  });

  it("resolves via SHA-256 and returns apiKeyId + real scopes", async () => {
    mockedFindFirst.mockResolvedValue(sha256Row({ scopes: ["read"] }) as never);

    const ctx = await resolveApiKey(`Bearer ${RAW_KEY}`);

    expect(ctx).not.toBeNull();
    expect(ctx!.tenantId).toBe("tenant-1");
    expect(ctx!.userId).toBe("user-1");
    expect(ctx!.role).toBe("USER");
    expect(ctx!.apiKeyId).toBe("key-1");
    expect(ctx!.scopes).toEqual(["read"]);
  });

  it("treats empty scopes as full access (backward-compat for legacy keys)", async () => {
    mockedFindFirst.mockResolvedValue(sha256Row({ scopes: [] }) as never);

    const ctx = await resolveApiKey(`Bearer ${RAW_KEY}`);

    expect(ctx!.scopes).toEqual(["read", "write"]);
  });

  it("falls back to bcrypt-by-prefix when SHA-256 misses", async () => {
    mockedFindFirst.mockResolvedValue(null);
    const bcryptHash = await bcrypt.hash(RAW_KEY, 4);
    mockedFindMany.mockResolvedValue([
      {
        id: "key-bcrypt",
        keyHash: bcryptHash,
        keyPrefix: RAW_KEY.substring(0, 15),
        scopes: ["read"],
        revokedAt: null,
        user: { id: "user-2", tenantId: "tenant-2", role: "ADMIN" },
      },
    ] as never);

    const ctx = await resolveApiKey(`Bearer ${RAW_KEY}`);

    expect(ctx).not.toBeNull();
    expect(ctx!.apiKeyId).toBe("key-bcrypt");
    expect(ctx!.tenantId).toBe("tenant-2");
    expect(ctx!.scopes).toEqual(["read"]);
  });

  it("returns null when neither SHA-256 nor bcrypt matches", async () => {
    mockedFindFirst.mockResolvedValue(null);
    const otherHash = await bcrypt.hash("some-other-key", 4);
    mockedFindMany.mockResolvedValue([
      {
        id: "key-x",
        keyHash: otherHash,
        keyPrefix: RAW_KEY.substring(0, 15),
        scopes: ["read"],
        revokedAt: null,
        user: { id: "user-x", tenantId: "tenant-x", role: "USER" },
      },
    ] as never);

    const ctx = await resolveApiKey(`Bearer ${RAW_KEY}`);

    expect(ctx).toBeNull();
  });
});
