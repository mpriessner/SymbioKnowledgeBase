import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock dependencies
vi.mock("@/lib/search/query", () => ({
  searchBlocks: vi.fn(),
  enhancedSearchBlocks: vi.fn(),
}));

vi.mock("@/lib/auth/withTenant", () => ({
  withTenant: (handler: (req: NextRequest, tenant: { tenantId: string; userId: string; role: string }, ctx: { params: Promise<Record<string, string>> }) => unknown) => {
    return (req: NextRequest) => {
      return handler(
        req,
        { tenantId: "test-tenant-id", userId: "test-user-id", role: "owner" },
        { params: Promise.resolve({}) }
      );
    };
  },
}));

import { GET } from "@/app/api/search/route";
import { enhancedSearchBlocks } from "@/lib/search/query";
const mockEnhancedSearchBlocks = vi.mocked(enhancedSearchBlocks);

describe("GET /api/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return search results for valid query", async () => {
    mockEnhancedSearchBlocks.mockResolvedValue({
      results: [
        {
          pageId: "page-1",
          pageTitle: "Test Page",
          pageIcon: null,
          snippet: "matching <mark>content</mark>",
          score: 0.85,
          updatedAt: "2026-01-01T00:00:00.000Z",
          matchedBlockIds: ["block-1"],
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
    mockEnhancedSearchBlocks.mockResolvedValue({ results: [], total: 0 });

    const request = new NextRequest(
      "http://localhost:3000/api/search?q=test"
    );
    await GET(request);

    expect(mockEnhancedSearchBlocks).toHaveBeenCalledWith(
      "test",
      "test-tenant-id",
      expect.objectContaining({}),
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
    mockEnhancedSearchBlocks.mockResolvedValue({ results: [], total: 0 });

    const request = new NextRequest(
      "http://localhost:3000/api/search?q=nonexistent"
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual([]);
    expect(body.meta.total).toBe(0);
  });

  it("should pass tenant_id to enhancedSearchBlocks", async () => {
    mockEnhancedSearchBlocks.mockResolvedValue({ results: [], total: 0 });

    const request = new NextRequest(
      "http://localhost:3000/api/search?q=test"
    );
    await GET(request);

    expect(mockEnhancedSearchBlocks).toHaveBeenCalledWith(
      "test",
      "test-tenant-id",
      expect.objectContaining({}),
      expect.any(Number),
      expect.any(Number)
    );
  });

  it("should handle custom limit and offset", async () => {
    mockEnhancedSearchBlocks.mockResolvedValue({ results: [], total: 0 });

    const request = new NextRequest(
      "http://localhost:3000/api/search?q=test&limit=5&offset=10"
    );
    await GET(request);

    expect(mockEnhancedSearchBlocks).toHaveBeenCalledWith(
      "test",
      "test-tenant-id",
      expect.objectContaining({}),
      5,
      10
    );
  });
});
