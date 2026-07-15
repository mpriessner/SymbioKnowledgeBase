/**
 * Handler-level tests for the AOK asset routes (POST /assets, GET/PATCH
 * /assets/:id). Mocks the service layer (`@/lib/aok/assets`) — that has its
 * own DB-backed coverage in tests/api/aokTenantIsolation.test.ts — so this
 * file is purely about route wiring: zod .strict() validation, auth/scope,
 * the AOK dual envelope, Cache-Control, and audit-call args.
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

const mockLogAgentAction = vi.fn();
vi.mock("@/lib/agent/audit", () => ({
  // Real logAgentAction always returns Promise<void> (routes call
  // `void logAgentAction(...).catch(...)`) — the mock must too.
  logAgentAction: async (...a: unknown[]) => {
    mockLogAgentAction(...a);
  },
  logAuthEvent: vi.fn(async () => {}),
  clientIpFromHeaders: () => undefined,
}));

const mockCreateAsset = vi.fn();
const mockGetAssetCard = vi.fn();
const mockPatchAsset = vi.fn();
vi.mock("@/lib/aok/assets", () => ({
  createAsset: (...a: unknown[]) => mockCreateAsset(...a),
  getAssetCard: (...a: unknown[]) => mockGetAssetCard(...a),
  patchAsset: (...a: unknown[]) => mockPatchAsset(...a),
}));

const { POST: createAssetPOST } = await import("@/app/api/agent/aok/assets/route");
const { GET: assetGET, PATCH: assetPATCH } = await import(
  "@/app/api/agent/aok/assets/[id]/route"
);

const FULL_ACCESS_CTX = {
  tenantId: "tenant-a",
  userId: "user-1",
  apiKeyId: "key-1",
  scopes: ["read", "write"],
};

const ASSET_ID = "cjld2cyuq0000t3rmniod1foy";

function req(method: string, url: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost:3000${url}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer skb_live_validkey",
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

function routeCtx(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveApiKey.mockResolvedValue(FULL_ACCESS_CTX);
});

describe("POST /api/agent/aok/assets", () => {
  test("happy path: creates an asset and returns the dual envelope", async () => {
    mockCreateAsset.mockResolvedValue({ id: ASSET_ID, name: "Main shut-off valve" });

    const res = await createAssetPOST(
      req("POST", "/api/agent/aok/assets", { name: "Main shut-off valve", category: "valve" })
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toEqual({ ok: true, asset: { id: ASSET_ID, name: "Main shut-off valve" } });
    expect(mockCreateAsset).toHaveBeenCalledWith(
      "tenant-a",
      expect.objectContaining({ name: "Main shut-off valve", category: "valve" })
    );
    expect(mockLogAgentAction).toHaveBeenCalledWith(
      FULL_ACCESS_CTX,
      "aok.asset.create",
      "aok_asset",
      ASSET_ID
    );
  });

  test("validation-reject: missing category => 400 speakable {ok:false}", async () => {
    const res = await createAssetPOST(
      req("POST", "/api/agent/aok/assets", { name: "Main shut-off valve" })
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(typeof body.error).toBe("string");
    expect(mockCreateAsset).not.toHaveBeenCalled();
  });

  test("validation-reject: unknown field rejected by .strict()", async () => {
    const res = await createAssetPOST(
      req("POST", "/api/agent/aok/assets", {
        name: "Valve",
        category: "valve",
        not_a_real_field: true,
      })
    );
    expect(res.status).toBe(400);
    expect(mockCreateAsset).not.toHaveBeenCalled();
  });

  test("malformed JSON body => 400 speakable, not a 500", async () => {
    const badReq = new NextRequest("http://localhost:3000/api/agent/aok/assets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer skb_live_validkey",
      },
      body: "{not valid json",
    });
    const res = await createAssetPOST(badReq);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
  });

  test("read-only key on this write route => 403 repo-standard envelope (HOC untouched)", async () => {
    mockResolveApiKey.mockResolvedValue({ ...FULL_ACCESS_CTX, scopes: ["read"] });

    const res = await createAssetPOST(
      req("POST", "/api/agent/aok/assets", { name: "Valve", category: "valve" })
    );
    const body = await res.json();

    expect(res.status).toBe(403);
    // Auth/scope failures keep the repo-standard {error:{code,message}} envelope.
    expect(body.error.code).toBe("FORBIDDEN");
    expect(mockCreateAsset).not.toHaveBeenCalled();
  });

  test("AokServiceError from the service layer maps to its own status + speakable message", async () => {
    const { AokServiceError } = await import("@/lib/aok/errors");
    mockCreateAsset.mockRejectedValue(new AokServiceError(404, "That site could not be found."));

    const res = await createAssetPOST(
      req("POST", "/api/agent/aok/assets", { name: "Valve", category: "valve", site_id: ASSET_ID })
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ ok: false, error: "That site could not be found." });
  });
});

describe("GET /api/agent/aok/assets/:id", () => {
  test("happy path: returns the asset card with Cache-Control: no-store", async () => {
    mockGetAssetCard.mockResolvedValue({
      asset: { id: ASSET_ID },
      knowledge: [],
      last_visits: [],
      anchors: [],
    });

    const res = await assetGET(req("GET", `/api/agent/aok/assets/${ASSET_ID}`), routeCtx(ASSET_ID));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.asset.id).toBe(ASSET_ID);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  test("invalid id shape => 404 speakable, service layer never called", async () => {
    const res = await assetGET(
      req("GET", "/api/agent/aok/assets/bad"),
      routeCtx("bad")
    );
    expect(res.status).toBe(404);
    expect(mockGetAssetCard).not.toHaveBeenCalled();
  });

  test("not found => 404 speakable", async () => {
    const { notFoundError } = await import("@/lib/aok/errors");
    mockGetAssetCard.mockRejectedValue(notFoundError("object"));

    const res = await assetGET(
      req("GET", `/api/agent/aok/assets/${ASSET_ID}`),
      routeCtx(ASSET_ID)
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ ok: false, error: "That object could not be found." });
  });
});

describe("PATCH /api/agent/aok/assets/:id", () => {
  test("happy path: shallow-merge patch returns the updated asset", async () => {
    mockPatchAsset.mockResolvedValue({ id: ASSET_ID, status: "retired" });

    const res = await assetPATCH(
      req("PATCH", `/api/agent/aok/assets/${ASSET_ID}`, { status: "retired" }),
      routeCtx(ASSET_ID)
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, asset: { id: ASSET_ID, status: "retired" } });
    expect(mockPatchAsset).toHaveBeenCalledWith("tenant-a", ASSET_ID, { status: "retired" });
    expect(mockLogAgentAction).toHaveBeenCalledWith(
      FULL_ACCESS_CTX,
      "aok.asset.update",
      "aok_asset",
      ASSET_ID
    );
  });

  test("validation-reject: invalid status enum value => 400", async () => {
    const res = await assetPATCH(
      req("PATCH", `/api/agent/aok/assets/${ASSET_ID}`, { status: "not-a-real-status" }),
      routeCtx(ASSET_ID)
    );
    expect(res.status).toBe(400);
    expect(mockPatchAsset).not.toHaveBeenCalled();
  });
});
