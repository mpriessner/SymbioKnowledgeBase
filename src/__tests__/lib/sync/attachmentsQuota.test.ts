import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    tenant: {
      update: vi.fn(),
    },
  },
}));

import { adjustStorageUsed, wouldExceedQuota } from "@/lib/sync/attachments";
import { prisma } from "@/lib/db";

const TENANT_ID = "tenant-quota-1";

describe("wouldExceedQuota (BigInt math)", () => {
  it("allows a file that fits within the remaining quota", () => {
    expect(
      wouldExceedQuota(BigInt(1000), BigInt(5000), BigInt(2000))
    ).toBe(false);
  });

  it("allows a file that exactly fills the quota", () => {
    expect(
      wouldExceedQuota(BigInt(3000), BigInt(5000), BigInt(2000))
    ).toBe(false);
  });

  it("rejects a file that would exceed the quota by one byte", () => {
    expect(
      wouldExceedQuota(BigInt(3000), BigInt(5000), BigInt(2001))
    ).toBe(true);
  });

  it("stays exact beyond Number.MAX_SAFE_INTEGER", () => {
    // 5 GiB quota, already 5 GiB - 10 bytes used; a 20-byte file must overflow.
    const quota = BigInt("5368709120"); // 5 GiB
    const used = quota - BigInt(10);
    expect(wouldExceedQuota(used, quota, BigInt(20))).toBe(true);
    expect(wouldExceedQuota(used, quota, BigInt(10))).toBe(false);

    // A value that loses precision as a Number but must stay exact as BigInt.
    const huge = BigInt(Number.MAX_SAFE_INTEGER) + BigInt(100);
    expect(wouldExceedQuota(huge, huge, BigInt(1))).toBe(true);
    expect(wouldExceedQuota(huge, huge, BigInt(0))).toBe(false);
  });
});

describe("adjustStorageUsed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("increments storageUsed by a positive delta", async () => {
    await adjustStorageUsed(TENANT_ID, BigInt(2048));
    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: TENANT_ID },
      data: { storageUsed: { increment: BigInt(2048) } },
    });
  });

  it("decrements storageUsed with a negative delta (increment of a negative)", async () => {
    await adjustStorageUsed(TENANT_ID, BigInt(-512));
    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: TENANT_ID },
      data: { storageUsed: { increment: BigInt(-512) } },
    });
  });

  it("is a no-op for a zero delta", async () => {
    await adjustStorageUsed(TENANT_ID, BigInt(0));
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });
});
