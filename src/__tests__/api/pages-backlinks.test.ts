import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const TENANT_ID = "tenant-test-123";
const PAGE_ID = "a0000000-0000-4000-8000-000000000001";

vi.mock("@/lib/db", () => ({
  prisma: {
    page: { findFirst: vi.fn() },
    pageLink: { findMany: vi.fn() },
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

import { GET } from "@/app/api/pages/[id]/backlinks/route";
import { prisma } from "@/lib/db";

function makeRouteContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/pages/[id]/backlinks deletedAt filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("404s when the target page is soft-deleted", async () => {
    // findFirst with deletedAt:null returns nothing for a trashed page.
    vi.mocked(prisma.page.findFirst).mockResolvedValueOnce(null as never);

    const req = new NextRequest(
      `http://localhost/api/pages/${PAGE_ID}/backlinks`
    );
    const res = await GET(req, makeRouteContext(PAGE_ID) as never);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
    // The existence check must include the deletedAt filter.
    expect(vi.mocked(prisma.page.findFirst).mock.calls[0][0]!.where).toMatchObject(
      { id: PAGE_ID, tenantId: TENANT_ID, deletedAt: null }
    );
  });

  it("excludes backlinks whose source page is soft-deleted", async () => {
    vi.mocked(prisma.page.findFirst).mockResolvedValueOnce({
      id: PAGE_ID,
    } as never);
    vi.mocked(prisma.pageLink.findMany).mockResolvedValueOnce([
      {
        sourcePage: {
          id: "src-1",
          title: "Live source",
          icon: null,
          oneLiner: null,
          summary: null,
          summaryUpdatedAt: null,
        },
      },
    ] as never);

    const req = new NextRequest(
      `http://localhost/api/pages/${PAGE_ID}/backlinks`
    );
    const res = await GET(req, makeRouteContext(PAGE_ID) as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);

    // The backlinks query filters out soft-deleted source pages at the DB.
    expect(vi.mocked(prisma.pageLink.findMany).mock.calls[0][0]!.where).toMatchObject(
      {
        targetPageId: PAGE_ID,
        tenantId: TENANT_ID,
        sourcePage: { deletedAt: null },
      }
    );
  });
});
