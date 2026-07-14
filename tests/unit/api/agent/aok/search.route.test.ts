/**
 * Handler-level tests for GET /api/agent/aok/assets/search. Mocks the
 * service layer (`@/lib/aok/search`) — the actual ranking/normalization
 * logic has its own unit coverage plus a live DB-backed AC-4 check
 * ("shut off" finds "Main shut-off valve") in
 * tests/api/aokTenantIsolation.test.ts.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

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

vi.mock("@/lib/agent/audit", () => ({
  logAgentAction: vi.fn(async () => {}),
  logAuthEvent: vi.fn(async () => {}),
  clientIpFromHeaders: () => undefined,
}));

const mockSearchAssets = vi.fn();
vi.mock("@/lib/aok/search", () => ({
  searchAssets: (...a: unknown[]) => mockSearchAssets(...a),
}));

const { GET: searchGET } = await import("@/app/api/agent/aok/assets/search/route");

const FULL_ACCESS_CTX = {
  tenantId: "tenant-a",
  userId: "user-1",
  apiKeyId: "key-1",
  scopes: ["read", "write"],
};

function req(url: string): NextRequest {
  return new NextRequest(`http://localhost:3000${url}`, {
    headers: { Authorization: "Bearer skb_live_validkey" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveApiKey.mockResolvedValue(FULL_ACCESS_CTX);
});

describe("GET /api/agent/aok/assets/search", () => {
  test("happy path: passes q/site_id/limit through and returns results", async () => {
    mockSearchAssets.mockResolvedValue([
      { asset: { id: "a1", name: "Main shut-off valve" }, space_path: ["Lab"], directions_text: null },
    ]);

    const res = await searchGET(req("/api/agent/aok/assets/search?q=shut+off&limit=3"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.results).toHaveLength(1);
    expect(mockSearchAssets).toHaveBeenCalledWith("tenant-a", "shut off", {
      siteId: undefined,
      limit: 3,
    });
  });

  test("empty result set is {ok:true, results:[]}, not an error", async () => {
    mockSearchAssets.mockResolvedValue([]);

    const res = await searchGET(req("/api/agent/aok/assets/search?q=nonexistent"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, results: [] });
  });

  test("default limit is 5 when omitted", async () => {
    mockSearchAssets.mockResolvedValue([]);
    await searchGET(req("/api/agent/aok/assets/search?q=valve"));
    expect(mockSearchAssets).toHaveBeenCalledWith("tenant-a", "valve", {
      siteId: undefined,
      limit: 5,
    });
  });

  test("validation-reject: missing q => 400 speakable", async () => {
    const res = await searchGET(req("/api/agent/aok/assets/search"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(mockSearchAssets).not.toHaveBeenCalled();
  });

  test("site_id is threaded through when supplied", async () => {
    mockSearchAssets.mockResolvedValue([]);
    await searchGET(
      req("/api/agent/aok/assets/search?q=valve&site_id=cjld2cyuq0000t3rmniod1foy")
    );
    expect(mockSearchAssets).toHaveBeenCalledWith("tenant-a", "valve", {
      siteId: "cjld2cyuq0000t3rmniod1foy",
      limit: 5,
    });
  });
});
