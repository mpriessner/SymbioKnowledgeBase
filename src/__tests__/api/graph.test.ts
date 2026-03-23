import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const TENANT_ID = "tenant-test-123";

vi.mock("@/lib/db", () => ({
  prisma: {
    page: {
      findFirst: vi.fn(),
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

vi.mock("@/lib/graph/builder", () => ({
  buildGraphData: vi.fn(),
}));

import { GET } from "@/app/api/graph/route";
import { buildGraphData } from "@/lib/graph/builder";

describe("GET /api/graph", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return nodes and edges", async () => {
    const mockGraph = {
      nodes: [
        {
          id: "page-1",
          label: "Page 1",
          icon: null,
          oneLiner: null,
          linkCount: 1,
          updatedAt: "2025-01-01T00:00:00.000Z",
          contentLength: 100,
        },
      ],
      edges: [{ source: "page-1", target: "page-2" }],
    };
    vi.mocked(buildGraphData).mockResolvedValueOnce(mockGraph);

    const req = new NextRequest("http://localhost/api/graph");
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.nodes).toHaveLength(1);
    expect(body.data.edges).toHaveLength(1);
    expect(body.meta.nodeCount).toBe(1);
    expect(body.meta.edgeCount).toBe(1);
  });

  it("should have correct response shape", async () => {
    const mockGraph = { nodes: [], edges: [] };
    vi.mocked(buildGraphData).mockResolvedValueOnce(mockGraph);

    const req = new NextRequest("http://localhost/api/graph");
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveProperty("data");
    expect(body.data).toHaveProperty("nodes");
    expect(body.data).toHaveProperty("edges");
    expect(body).toHaveProperty("meta");
    expect(body.meta).toHaveProperty("nodeCount");
    expect(body.meta).toHaveProperty("edgeCount");
  });

  it("should return 400 for invalid pageId parameter", async () => {
    const req = new NextRequest(
      "http://localhost/api/graph?pageId=not-a-uuid"
    );
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 500 when graph builder fails", async () => {
    vi.mocked(buildGraphData).mockRejectedValueOnce(
      new Error("Builder failure")
    );

    const req = new NextRequest("http://localhost/api/graph");
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
