import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const TENANT_ID = "tenant-test-123";

vi.mock("@/lib/db", () => ({
  prisma: {
    page: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
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

import { GET } from "@/app/api/pages/trash/route";
import { prisma } from "@/lib/db";

describe("GET /api/pages/trash", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // No chemistry hierarchy by default → archive lookup returns null.
    vi.mocked(prisma.page.findFirst).mockResolvedValue(null as never);
  });

  it("returns the tenant's soft-deleted pages, newest first", async () => {
    vi.mocked(prisma.page.findMany).mockResolvedValueOnce([
      {
        id: "d1",
        title: "Deleted A",
        icon: "🧪",
        deletedAt: new Date("2026-02-02"),
        parentId: "parent-1",
        parent: { id: "parent-1", title: "Home" },
      },
    ] as never);
    vi.mocked(prisma.page.count).mockResolvedValueOnce(1 as never);

    const req = new NextRequest("http://localhost/api/pages/trash");
    const res = await GET(req, undefined as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      id: "d1",
      title: "Deleted A",
      parentTitle: "Home",
    });
    expect(body.meta.total).toBe(1);

    // The list query must be tenant-scoped and filter trashed pages only.
    const listArgs = vi.mocked(prisma.page.findMany).mock.calls[0][0];
    expect(listArgs?.where).toMatchObject({
      tenantId: TENANT_ID,
      deletedAt: { not: null },
    });
    expect(listArgs?.orderBy).toEqual({ deletedAt: "desc" });
  });

  it("excludes archive-folder pages when the archive folder exists", async () => {
    // Root lookup, then archive lookup.
    vi.mocked(prisma.page.findFirst)
      .mockResolvedValueOnce({ id: "root-1" } as never)
      .mockResolvedValueOnce({ id: "archive-1" } as never);
    vi.mocked(prisma.page.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.page.count).mockResolvedValueOnce(0 as never);

    const req = new NextRequest("http://localhost/api/pages/trash");
    await GET(req, undefined as never);

    const listArgs = vi.mocked(prisma.page.findMany).mock.calls[0][0];
    expect(listArgs?.where).toMatchObject({
      tenantId: TENANT_ID,
      deletedAt: { not: null },
      parentId: { not: "archive-1" },
    });
  });

  it("clamps limit and honors offset pagination", async () => {
    vi.mocked(prisma.page.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.page.count).mockResolvedValueOnce(0 as never);

    const req = new NextRequest(
      "http://localhost/api/pages/trash?limit=9999&offset=20"
    );
    const res = await GET(req, undefined as never);
    const body = await res.json();

    const listArgs = vi.mocked(prisma.page.findMany).mock.calls[0][0];
    expect(listArgs?.take).toBe(200); // MAX_LIMIT
    expect(listArgs?.skip).toBe(20);
    expect(body.meta.limit).toBe(200);
    expect(body.meta.offset).toBe(20);
  });
});
