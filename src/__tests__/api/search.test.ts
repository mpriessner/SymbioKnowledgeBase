import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const TENANT_ID = "tenant-test-123";

vi.mock("@/lib/db", () => ({
  prisma: {},
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

vi.mock("@/lib/search/query", () => ({
  enhancedSearchBlocks: vi.fn(),
}));

import { GET } from "@/app/api/search/route";
import { enhancedSearchBlocks } from "@/lib/search/query";

describe("GET /api/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return search results for a valid query", async () => {
    vi.mocked(enhancedSearchBlocks).mockResolvedValueOnce({
      results: [
        {
          pageId: "page-1",
          pageTitle: "Test Page",
          pageIcon: null,
          snippet: "...matching text...",
          score: 0.95,
          updatedAt: "2025-01-01T00:00:00.000Z",
          matchedBlockIds: ["block-1"],
        },
      ],
      total: 1,
    });

    const req = new NextRequest("http://localhost/api/search?q=test");
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].pageId).toBe("page-1");
    expect(body.data[0].snippet).toBe("...matching text...");
    expect(body.meta.total).toBe(1);
  });

  it("should return 400 when query parameter is missing", async () => {
    const req = new NextRequest("http://localhost/api/search");
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 when query is empty", async () => {
    const req = new NextRequest("http://localhost/api/search?q=");
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should pass limit and offset to the search function", async () => {
    vi.mocked(enhancedSearchBlocks).mockResolvedValueOnce({
      results: [],
      total: 0,
    });

    const req = new NextRequest(
      "http://localhost/api/search?q=test&limit=5&offset=10"
    );
    await GET(req);

    expect(enhancedSearchBlocks).toHaveBeenCalledWith(
      "test",
      TENANT_ID,
      expect.any(Object),
      5,
      10
    );
  });

  it("should return 500 when search fails", async () => {
    vi.mocked(enhancedSearchBlocks).mockRejectedValueOnce(
      new Error("Search error")
    );

    const req = new NextRequest("http://localhost/api/search?q=test");
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
