import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const TENANT_ID = "tenant-test-123";
const PAGE_ID = "a0000000-0000-4000-8000-000000000001";

vi.mock("@/lib/db", () => ({
  prisma: {
    page: {
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
      aggregate: vi.fn(),
    },
    $transaction: vi.fn((cb: Function) =>
      cb({
        page: {
          update: vi.fn().mockResolvedValue({}),
          findMany: vi.fn().mockResolvedValue([]),
        },
      })
    ),
  },
}));

vi.mock("@/lib/auth/withTenant", () => ({
  withTenant: (handler: Function) => {
    return async (req: NextRequest, routeContext?: unknown) => {
      const ctx = { tenantId: TENANT_ID, userId: "user-1" };
      const rc = routeContext ?? {
        params: Promise.resolve({}),
      };
      return handler(req, ctx, rc);
    };
  },
}));

vi.mock("@/lib/wikilinks/renameUpdater", () => ({
  updateWikilinksOnRename: vi.fn().mockResolvedValue(undefined),
  markWikilinksAsDeleted: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/markdown/helpers", () => ({
  pageToMarkdown: vi.fn().mockReturnValue("# Test"),
  savePageBlocks: vi.fn().mockResolvedValue(undefined),
  markdownToTiptap: vi.fn().mockReturnValue({ content: {}, metadata: {} }),
}));

vi.mock("@/lib/sync/SyncService", () => ({
  syncPageToFilesystem: vi.fn().mockResolvedValue(undefined),
  deletePageFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/pages/getPageTree", () => ({
  isDescendant: vi.fn().mockResolvedValue(false),
}));

import { GET, PUT, DELETE } from "@/app/api/pages/[id]/route";
import { prisma } from "@/lib/db";

const mockPage = {
  id: PAGE_ID,
  tenantId: TENANT_ID,
  parentId: null,
  title: "Test Page",
  icon: null,
  coverUrl: null,
  position: 0,
  spaceType: "PRIVATE",
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
};

function makeRouteContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/pages/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return a page by ID", async () => {
    vi.mocked(prisma.page.findFirst).mockResolvedValueOnce(mockPage as never);

    const req = new NextRequest(`http://localhost/api/pages/${PAGE_ID}`);
    const response = await GET(req, makeRouteContext(PAGE_ID) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.id).toBe(PAGE_ID);
    expect(body.data.title).toBe("Test Page");
  });

  it("should return 404 for non-existent page", async () => {
    vi.mocked(prisma.page.findFirst).mockResolvedValueOnce(null as never);

    const req = new NextRequest(`http://localhost/api/pages/${PAGE_ID}`);
    const response = await GET(req, makeRouteContext(PAGE_ID) as never);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("should return 400 for invalid UUID", async () => {
    const req = new NextRequest("http://localhost/api/pages/not-a-uuid");
    const response = await GET(req, makeRouteContext("not-a-uuid") as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("PUT /api/pages/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should update a page", async () => {
    const updatedPage = { ...mockPage, title: "Updated Title" };
    vi.mocked(prisma.page.findFirst).mockResolvedValueOnce({
      id: PAGE_ID,
      title: "Test Page",
      spaceType: "PRIVATE",
    } as never);
    vi.mocked(prisma.$transaction).mockImplementationOnce(
      async (cb: Function) =>
        cb({
          page: {
            update: vi.fn().mockResolvedValue(updatedPage),
            findMany: vi.fn().mockResolvedValue([]),
          },
        })
    );

    const req = new NextRequest(`http://localhost/api/pages/${PAGE_ID}`, {
      method: "PUT",
      body: JSON.stringify({ title: "Updated Title" }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await PUT(req, makeRouteContext(PAGE_ID) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.title).toBe("Updated Title");
  });

  it("should return 404 when page does not exist", async () => {
    vi.mocked(prisma.page.findFirst).mockResolvedValueOnce(null as never);

    const req = new NextRequest(`http://localhost/api/pages/${PAGE_ID}`, {
      method: "PUT",
      body: JSON.stringify({ title: "Updated" }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await PUT(req, makeRouteContext(PAGE_ID) as never);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("should return 400 for invalid body", async () => {
    const req = new NextRequest(`http://localhost/api/pages/${PAGE_ID}`, {
      method: "PUT",
      body: JSON.stringify({ title: "x".repeat(501) }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await PUT(req, makeRouteContext(PAGE_ID) as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("DELETE /api/pages/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should delete a page and return 204", async () => {
    vi.mocked(prisma.page.findFirst).mockResolvedValueOnce(mockPage as never);
    vi.mocked(prisma.page.delete).mockResolvedValueOnce(mockPage as never);

    const req = new NextRequest(`http://localhost/api/pages/${PAGE_ID}`, {
      method: "DELETE",
    });
    const response = await DELETE(req, makeRouteContext(PAGE_ID) as never);

    expect(response.status).toBe(204);
  });

  it("should return 404 when deleting non-existent page", async () => {
    vi.mocked(prisma.page.findFirst).mockResolvedValueOnce(null as never);

    const req = new NextRequest(`http://localhost/api/pages/${PAGE_ID}`, {
      method: "DELETE",
    });
    const response = await DELETE(req, makeRouteContext(PAGE_ID) as never);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("should return 400 for invalid UUID", async () => {
    const req = new NextRequest("http://localhost/api/pages/bad-id", {
      method: "DELETE",
    });
    const response = await DELETE(req, makeRouteContext("bad-id") as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
