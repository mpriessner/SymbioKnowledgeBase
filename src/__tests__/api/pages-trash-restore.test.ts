import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const TENANT_ID = "tenant-test-123";
const PAGE_ID = "a0000000-0000-4000-8000-000000000001";

vi.mock("@/lib/db", () => ({
  prisma: {
    page: {
      findFirst: vi.fn(),
      aggregate: vi.fn(),
      update: vi.fn(),
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

vi.mock("@/lib/wikilinks/renameUpdater", () => ({
  relinkIncomingWikilinks: vi.fn(),
}));

vi.mock("@/lib/wikilinks/indexer", () => ({
  rebuildPageLinks: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/search/indexer", () => ({
  updateSearchIndexForPage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/sync/SyncService", () => ({
  syncPageToFilesystem: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/pages/serialize", () => ({
  serializePage: (p: { id: string; title: string; parentId: string | null }) => ({
    id: p.id,
    title: p.title,
    parentId: p.parentId,
  }),
}));

import { POST } from "@/app/api/pages/[id]/trash-restore/route";
import { prisma } from "@/lib/db";
import { relinkIncomingWikilinks } from "@/lib/wikilinks/renameUpdater";
import { rebuildPageLinks } from "@/lib/wikilinks/indexer";
import { updateSearchIndexForPage } from "@/lib/search/indexer";

function makeRouteContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/pages/[id]/trash-restore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.page.aggregate).mockResolvedValue({
      _max: { position: 3 },
    } as never);
    vi.mocked(relinkIncomingWikilinks).mockResolvedValue({
      relinkedBlockCount: 0,
      affectedPageIds: [],
    });
  });

  it("restores a trashed page, rebuilds its links + search index, and re-links incoming wikilinks", async () => {
    // Trashed target page.
    vi.mocked(prisma.page.findFirst)
      .mockResolvedValueOnce({
        id: PAGE_ID,
        title: "My Page",
        parentId: "parent-1",
        deletedAt: new Date("2026-02-01"),
      } as never)
      // Original parent is alive.
      .mockResolvedValueOnce({ id: "parent-1" } as never);

    vi.mocked(prisma.page.update).mockResolvedValueOnce({
      id: PAGE_ID,
      title: "My Page",
      parentId: "parent-1",
    } as never);

    vi.mocked(relinkIncomingWikilinks).mockResolvedValueOnce({
      relinkedBlockCount: 2,
      affectedPageIds: ["src-1", "src-2"],
    });

    const req = new NextRequest(
      `http://localhost/api/pages/${PAGE_ID}/trash-restore`,
      { method: "POST" }
    );
    const res = await POST(req, makeRouteContext(PAGE_ID) as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.id).toBe(PAGE_ID);

    // deletedAt/deletedBy cleared, restored under the alive original parent.
    const updateArgs = vi.mocked(prisma.page.update).mock.calls[0][0];
    expect(updateArgs.data).toMatchObject({
      deletedAt: null,
      deletedBy: null,
      parentId: "parent-1",
      position: 4,
    });

    // Own outgoing links + search index rebuilt.
    expect(updateSearchIndexForPage).toHaveBeenCalledWith(PAGE_ID, TENANT_ID);
    expect(relinkIncomingWikilinks).toHaveBeenCalledWith(
      PAGE_ID,
      "My Page",
      TENANT_ID
    );

    // rebuildPageLinks called for the restored page AND each affected source.
    const rebuiltIds = vi
      .mocked(rebuildPageLinks)
      .mock.calls.map((c) => c[0]);
    expect(rebuiltIds).toContain(PAGE_ID);
    expect(rebuiltIds).toContain("src-1");
    expect(rebuiltIds).toContain("src-2");
  });

  it("falls back to root when the original parent is gone/trashed", async () => {
    vi.mocked(prisma.page.findFirst)
      .mockResolvedValueOnce({
        id: PAGE_ID,
        title: "Orphaned",
        parentId: "dead-parent",
        deletedAt: new Date("2026-02-01"),
      } as never)
      // Original parent not found alive.
      .mockResolvedValueOnce(null as never);

    vi.mocked(prisma.page.update).mockResolvedValueOnce({
      id: PAGE_ID,
      title: "Orphaned",
      parentId: null,
    } as never);

    const req = new NextRequest(
      `http://localhost/api/pages/${PAGE_ID}/trash-restore`,
      { method: "POST" }
    );
    const res = await POST(req, makeRouteContext(PAGE_ID) as never);

    expect(res.status).toBe(200);
    const updateArgs = vi.mocked(prisma.page.update).mock.calls[0][0];
    expect(updateArgs.data.parentId).toBeNull();
    // Position computed among root siblings.
    expect(vi.mocked(prisma.page.aggregate).mock.calls[0][0]!.where).toMatchObject(
      { tenantId: TENANT_ID, parentId: null }
    );
  });

  it("404s a page that is not trashed", async () => {
    vi.mocked(prisma.page.findFirst).mockResolvedValueOnce({
      id: PAGE_ID,
      title: "Alive",
      parentId: null,
      deletedAt: null,
    } as never);

    const req = new NextRequest(
      `http://localhost/api/pages/${PAGE_ID}/trash-restore`,
      { method: "POST" }
    );
    const res = await POST(req, makeRouteContext(PAGE_ID) as never);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(prisma.page.update).not.toHaveBeenCalled();
  });

  it("404s a cross-tenant / missing page", async () => {
    vi.mocked(prisma.page.findFirst).mockResolvedValueOnce(null as never);

    const req = new NextRequest(
      `http://localhost/api/pages/${PAGE_ID}/trash-restore`,
      { method: "POST" }
    );
    const res = await POST(req, makeRouteContext(PAGE_ID) as never);
    expect(res.status).toBe(404);

    // The lookup must be tenant-scoped.
    expect(vi.mocked(prisma.page.findFirst).mock.calls[0][0]!.where).toMatchObject(
      { id: PAGE_ID, tenantId: TENANT_ID }
    );
  });

  it("400s an invalid UUID", async () => {
    const req = new NextRequest(
      "http://localhost/api/pages/not-a-uuid/trash-restore",
      { method: "POST" }
    );
    const res = await POST(req, makeRouteContext("not-a-uuid") as never);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
