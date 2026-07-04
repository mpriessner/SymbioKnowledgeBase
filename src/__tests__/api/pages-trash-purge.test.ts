import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const TENANT_ID = "tenant-test-123";
const PAGE_ID = "a0000000-0000-4000-8000-000000000001";

const txFileAttachmentDeleteMany = vi.fn().mockResolvedValue({ count: 2 });
const txPageDelete = vi.fn().mockResolvedValue({});

vi.mock("@/lib/db", () => ({
  prisma: {
    page: { findFirst: vi.fn() },
    fileAttachment: { findMany: vi.fn() },
    $transaction: vi.fn((cb: Function) =>
      cb({
        fileAttachment: { deleteMany: txFileAttachmentDeleteMany },
        page: { delete: txPageDelete },
      })
    ),
  },
}));

vi.mock("@/lib/auth/withTenant", () => ({
  withTenant: (handler: Function) => {
    return async (req: NextRequest, routeContext?: unknown) => {
      const ctx = { tenantId: TENANT_ID, userId: "user-1" };
      const rc = routeContext ?? { params: Promise.resolve({}) };
      return handler(req, ctx, rc);
    };
  },
}));

vi.mock("@/lib/wikilinks/renameUpdater", () => ({
  markWikilinksAsDeleted: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/sync/attachments", () => ({
  adjustStorageUsed: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/sync/SyncService", () => ({
  deletePageFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/sync/config", () => ({
  MIRROR_ROOT: "/tmp/skb-mirror-test",
}));

const unlinkMock = vi.fn().mockResolvedValue(undefined);
vi.mock("fs/promises", () => ({
  default: { unlink: (p: string) => unlinkMock(p) },
  unlink: (p: string) => unlinkMock(p),
}));

import { DELETE } from "@/app/api/pages/[id]/trash-purge/route";
import { prisma } from "@/lib/db";
import { adjustStorageUsed } from "@/lib/sync/attachments";

function makeRouteContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("DELETE /api/pages/[id]/trash-purge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("purges a trashed page, deletes attachment rows + files, and decrements storageUsed", async () => {
    vi.mocked(prisma.page.findFirst).mockResolvedValueOnce({
      id: PAGE_ID,
      title: "Doomed",
      deletedAt: new Date("2026-02-01"),
    } as never);

    vi.mocked(prisma.fileAttachment.findMany).mockResolvedValueOnce([
      {
        id: "att-1",
        fileSize: BigInt(1000),
        storagePath: "tenant/Doomed/assets/a.png",
      },
      {
        id: "att-2",
        fileSize: BigInt(2048),
        storagePath: "tenant/Doomed/assets/b.pdf",
      },
    ] as never);

    const req = new NextRequest(
      `http://localhost/api/pages/${PAGE_ID}/trash-purge`,
      { method: "DELETE" }
    );
    const res = await DELETE(req, makeRouteContext(PAGE_ID) as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.status).toBe("purged");

    // Attachment rows and the page were deleted inside the transaction.
    expect(txFileAttachmentDeleteMany).toHaveBeenCalledWith({
      where: { pageId: PAGE_ID, tenantId: TENANT_ID },
    });
    expect(txPageDelete).toHaveBeenCalledWith({ where: { id: PAGE_ID } });

    // storageUsed decremented by the summed attachment bytes (negative delta).
    expect(adjustStorageUsed).toHaveBeenCalledWith(TENANT_ID, BigInt(-3048));

    // Both stored files removed from disk.
    expect(unlinkMock).toHaveBeenCalledTimes(2);
  });

  it("purges a page with no attachments without touching storage accounting", async () => {
    vi.mocked(prisma.page.findFirst).mockResolvedValueOnce({
      id: PAGE_ID,
      title: "Empty",
      deletedAt: new Date("2026-02-01"),
    } as never);
    vi.mocked(prisma.fileAttachment.findMany).mockResolvedValueOnce([] as never);

    const req = new NextRequest(
      `http://localhost/api/pages/${PAGE_ID}/trash-purge`,
      { method: "DELETE" }
    );
    const res = await DELETE(req, makeRouteContext(PAGE_ID) as never);

    expect(res.status).toBe(200);
    expect(txPageDelete).toHaveBeenCalled();
    expect(adjustStorageUsed).not.toHaveBeenCalled();
    expect(unlinkMock).not.toHaveBeenCalled();
  });

  it("404s a page that is not trashed", async () => {
    vi.mocked(prisma.page.findFirst).mockResolvedValueOnce({
      id: PAGE_ID,
      title: "Alive",
      deletedAt: null,
    } as never);

    const req = new NextRequest(
      `http://localhost/api/pages/${PAGE_ID}/trash-purge`,
      { method: "DELETE" }
    );
    const res = await DELETE(req, makeRouteContext(PAGE_ID) as never);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(txPageDelete).not.toHaveBeenCalled();
  });

  it("404s a cross-tenant / missing page (tenant-scoped lookup)", async () => {
    vi.mocked(prisma.page.findFirst).mockResolvedValueOnce(null as never);

    const req = new NextRequest(
      `http://localhost/api/pages/${PAGE_ID}/trash-purge`,
      { method: "DELETE" }
    );
    const res = await DELETE(req, makeRouteContext(PAGE_ID) as never);

    expect(res.status).toBe(404);
    expect(vi.mocked(prisma.page.findFirst).mock.calls[0][0]!.where).toMatchObject(
      { id: PAGE_ID, tenantId: TENANT_ID }
    );
  });

  it("400s an invalid UUID", async () => {
    const req = new NextRequest(
      "http://localhost/api/pages/bad-id/trash-purge",
      { method: "DELETE" }
    );
    const res = await DELETE(req, makeRouteContext("bad-id") as never);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
