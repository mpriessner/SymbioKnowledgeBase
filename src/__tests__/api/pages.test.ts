import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const TENANT_ID = "tenant-test-123";

vi.mock("@/lib/db", () => ({
  prisma: {
    page: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      aggregate: vi.fn(),
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

vi.mock("@/lib/wikilinks/resolver", () => ({
  resolveUnresolvedLinksForNewPage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/pages/generateUniqueTitle", () => ({
  generateUniqueUntitledTitle: vi.fn().mockResolvedValue("Untitled 1"),
}));

import { GET, POST } from "@/app/api/pages/route";
import { prisma } from "@/lib/db";

const mockPage = {
  id: "page-1",
  tenantId: TENANT_ID,
  parentId: null,
  title: "Test Page",
  icon: null,
  coverUrl: null,
  position: 0,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
};

describe("GET /api/pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return a list of pages", async () => {
    vi.mocked(prisma.page.findMany).mockResolvedValueOnce([mockPage] as never);
    vi.mocked(prisma.page.count).mockResolvedValueOnce(1 as never);

    const req = new NextRequest("http://localhost/api/pages");
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("page-1");
    expect(body.data[0].title).toBe("Test Page");
    expect(body.meta.total).toBe(1);
  });

  it("should return empty list when no pages exist", async () => {
    vi.mocked(prisma.page.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.page.count).mockResolvedValueOnce(0 as never);

    const req = new NextRequest("http://localhost/api/pages");
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(0);
    expect(body.meta.total).toBe(0);
  });

  it("should pass query parameters to Prisma", async () => {
    vi.mocked(prisma.page.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.page.count).mockResolvedValueOnce(0 as never);

    const req = new NextRequest(
      "http://localhost/api/pages?limit=5&offset=10&sortBy=title&order=asc"
    );
    await GET(req);

    expect(prisma.page.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 5,
        orderBy: { title: "asc" },
      })
    );
  });

  it("should return 400 for invalid query parameters", async () => {
    const req = new NextRequest("http://localhost/api/pages?limit=-1");
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /api/pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a new page", async () => {
    vi.mocked(prisma.page.aggregate).mockResolvedValueOnce({
      _max: { position: 0 },
    } as never);
    vi.mocked(prisma.page.create).mockResolvedValueOnce({
      ...mockPage,
      title: "New Page",
    } as never);

    const req = new NextRequest("http://localhost/api/pages", {
      method: "POST",
      body: JSON.stringify({ title: "New Page" }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.title).toBe("New Page");
  });

  it("should return 400 for invalid body", async () => {
    const req = new NextRequest("http://localhost/api/pages", {
      method: "POST",
      body: JSON.stringify({ title: "x".repeat(501) }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 404 when parentId does not exist", async () => {
    vi.mocked(prisma.page.findFirst).mockResolvedValueOnce(null as never);

    const req = new NextRequest("http://localhost/api/pages", {
      method: "POST",
      body: JSON.stringify({
        title: "Child Page",
        parentId: "a0000000-0000-4000-8000-000000000001",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
