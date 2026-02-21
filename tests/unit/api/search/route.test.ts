import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock dependencies
vi.mock("@/lib/search/query", () => ({
  searchBlocks: vi.fn(),
}));

vi.mock("@/lib/auth/withTenant", () => ({
  withTenant: (handler: Function) => {
    return (req: NextRequest) => {
      return handler(
        req,
        { tenantId: "test-tenant-id", userId: "test-user-id" },
        { params: Promise.resolve({}) }
      );
    };
  },
}));

import { GET } from "@/app/api/search/route";
import { searchBlocks } from "@/lib/search/query";
const mockSearchBlocks = vi.mocked(searchBlocks);

describe("GET /api/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return search results for valid query", async () => {
    mockSearchBlocks.mockResolvedValue({
      results: [
        {
          pageId: "page-1",
          pageTitle: "Test Page",
          pageIcon: null,
          blockId: "block-1",
          snippet: "matching <mark>content</mark>",
          rank: 0.85,
        },
      ],
      total: 1,
    });

    const request = new NextRequest(
      "http://localhost:3000/api/search?q=content"
    );
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].pageId).toBe("page-1");
    expect(body.data[0].pageTitle).toBe("Test Page");
    expect(body.data[0].snippet).toContain("<mark>");
    expect(body.data[0].score).toBe(0.85);
    expect(body.meta.total).toBe(1);
    expect(body.meta.limit).toBe(20);
    expect(body.meta.offset).toBe(0);
  });

  it("should return 400 when q parameter is missing", async () => {
    const request = new NextRequest("http://localhost:3000/api/search");
    const response = await GET(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should use default limit and offset when not provided", async () => {
    mockSearchBlocks.mockResolvedValue({ results: [], total: 0 });

    const request = new NextRequest(
      "http://localhost:3000/api/search?q=test"
    );
    await GET(request);

    expect(mockSearchBlocks).toHaveBeenCalledWith(
      "test",
      "test-tenant-id",
      20,
      0
    );
  });

  it("should reject limit greater than 100", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/search?q=test&limit=200"
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should reject negative offset", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/search?q=test&offset=-1"
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
  });

  it("should return empty data array for no results (not 404)", async () => {
    mockSearchBlocks.mockResolvedValue({ results: [], total: 0 });

    const request = new NextRequest(
      "http://localhost:3000/api/search?q=nonexistent"
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual([]);
    expect(body.meta.total).toBe(0);
  });

  it("should pass tenant_id to searchBlocks", async () => {
    mockSearchBlocks.mockResolvedValue({ results: [], total: 0 });

    const request = new NextRequest(
      "http://localhost:3000/api/search?q=test"
    );
    await GET(request);

    expect(mockSearchBlocks).toHaveBeenCalledWith(
      "test",
      "test-tenant-id",
      expect.any(Number),
      expect.any(Number)
    );
  });

  it("should handle custom limit and offset", async () => {
    mockSearchBlocks.mockResolvedValue({ results: [], total: 0 });

    const request = new NextRequest(
      "http://localhost:3000/api/search?q=test&limit=5&offset=10"
    );
    await GET(request);

    expect(mockSearchBlocks).toHaveBeenCalledWith(
      "test",
      "test-tenant-id",
      5,
      10
    );
  });
});
