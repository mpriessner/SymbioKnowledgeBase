/**
 * Route test for GET /api/agent/search — the other agent read path.
 *
 * Two independent response shapes share this handler:
 *   - WITH `depth`: delegates to `depthSearch()` and returns its result via
 *     `successResponse` (`{ data, meta }`) — no pagination.
 *   - WITHOUT `depth` (legacy): runs FTS `$queryRaw` directly in the route and
 *     returns a paginated list via `listResponse` (`{ data, meta: { total,
 *     limit, offset, timestamp } }`).
 *
 * Strategy (mock-first): mock `resolveApiKey` + `checkRateLimit` for auth, mock
 * `depthSearch` for the depth branch, and mock `prisma.$queryRaw` /
 * `prisma.page.findMany` for the legacy branch (the route calls these
 * directly — there is no intermediate lib to mock for that branch). This
 * avoids the FTS `search_vector` trigger / seed requirements entirely.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  depthSearchHappyPathResult,
  legacySearchHappyPathRow,
} from "../../../fixtures/agent-routes/search.fixture";

const mockResolveApiKey = vi.fn();
vi.mock("@/lib/apiAuth", () => ({
  resolveApiKey: (...a: unknown[]) => mockResolveApiKey(...a),
}));

vi.mock("@/lib/agent/ratelimit", () => ({
  checkRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 99,
    resetAt: Date.now() + 60_000,
  })),
}));

const mockDepthSearch = vi.fn();
vi.mock("@/lib/search/depthSearch", () => ({
  depthSearch: (...a: unknown[]) => mockDepthSearch(...a),
}));

const mockQueryRaw = vi.fn();
const mockPageFindMany = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: (...a: unknown[]) => mockQueryRaw(...a),
    page: {
      findMany: (...a: unknown[]) => mockPageFindMany(...a),
    },
  },
}));

vi.mock("@/lib/agent/pageTree", () => ({
  generatePagePath: vi.fn(() => "/Chemicals/Sodium Hydroxide"),
}));

const { GET } = await import("@/app/api/agent/search/route");

// ── Helpers ──────────────────────────────────────────────────────────────────

const FULL_ACCESS_CTX = {
  tenantId: "tenant-a",
  userId: "user-1",
  apiKeyId: "key-1",
  scopes: ["read", "write"],
};

function getRequest(query: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`http://localhost:3000/api/agent/search${query}`, {
    method: "GET",
    headers: { Authorization: "Bearer skb_live_validkey", ...headers },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveApiKey.mockResolvedValue(FULL_ACCESS_CTX);
});

describe("GET /api/agent/search — depth branch", () => {
  test("returns depthSearch's result shape with no pagination", async () => {
    mockDepthSearch.mockResolvedValue(depthSearchHappyPathResult);

    const res = await GET(getRequest("?q=sodium+hydroxide&depth=medium&scope=team"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body.data.results)).toBe(true);
    expect(body.data.results.length).toBeGreaterThan(0);
    expect(body.data).toMatchObject({
      totalCount: expect.any(Number),
      depth: "medium",
      scope: "team",
    });
    // searchTimeMs is non-deterministic in a live response — assert type only.
    expect(typeof body.data.searchTimeMs).toBe("number");

    // No pagination fields on the depth branch.
    expect(body.meta.total).toBeUndefined();
    expect(body.meta.limit).toBeUndefined();
    expect(body.meta.offset).toBeUndefined();
    expect(typeof body.meta.timestamp).toBe("string");

    expect(mockDepthSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-a",
        query: "sodium hydroxide",
        depth: "medium",
        scope: "team",
      })
    );
  });

  test("missing q on the depth branch => 400 VALIDATION_ERROR", async () => {
    const res = await GET(getRequest("?depth=medium"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockDepthSearch).not.toHaveBeenCalled();
  });

  test("invalid depth value => 400 VALIDATION_ERROR", async () => {
    const res = await GET(getRequest("?q=test&depth=bogus"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockDepthSearch).not.toHaveBeenCalled();
  });
});

describe("GET /api/agent/search — legacy branch (no depth param)", () => {
  test("returns non-empty formatted results with pagination meta", async () => {
    mockQueryRaw
      .mockResolvedValueOnce([legacySearchHappyPathRow])
      .mockResolvedValueOnce([{ count: 1 }]);
    mockPageFindMany.mockResolvedValue([
      { id: "page-naoh-1", title: "Sodium Hydroxide", parentId: null },
    ]);

    const res = await GET(getRequest("?q=sodium&limit=10&offset=0"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    const row = body.data[0];
    expect(row).toMatchObject({
      page_id: "page-naoh-1",
      title: "Sodium Hydroxide",
      icon: "🧪",
      oneLiner: "Strong base, corrosive.",
      path: expect.any(String),
      matchContext: expect.any(String),
    });
    expect(typeof row.score).toBe("number");

    expect(body.meta).toMatchObject({ total: 1, limit: 10, offset: 0 });
    expect(typeof body.meta.timestamp).toBe("string");
  });

  test("limit above 100 is rejected (legacy branch pagination bound)", async () => {
    const res = await GET(getRequest("?q=sodium&limit=200"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  test("missing q on the legacy branch => 400 typed errorResponse", async () => {
    const res = await GET(getRequest(""));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });
});

describe("GET /api/agent/search — auth", () => {
  test("missing Authorization header => 401", async () => {
    const res = await GET(
      new NextRequest("http://localhost:3000/api/agent/search?q=test", {
        method: "GET",
      })
    );
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(mockDepthSearch).not.toHaveBeenCalled();
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  test("write-only key on this GET route => 403 (read scope required)", async () => {
    mockResolveApiKey.mockResolvedValue({ ...FULL_ACCESS_CTX, scopes: ["write"] });

    const res = await GET(getRequest("?q=test"));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });
});
