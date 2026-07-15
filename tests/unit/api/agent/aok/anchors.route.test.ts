/**
 * Handler-level tests for the AOK anchor routes: mint, bind, resolve.
 * Mocks the service layer (`@/lib/aok/anchors`) and the QR renderer
 * (`@/lib/aok/qr`) — real QR rendering + DB-backed lifecycle coverage lives
 * in tests/api/aokTenantIsolation.test.ts.
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
  logAgentAction: async (...a: unknown[]) => {
    mockLogAgentAction(...a);
  },
  logAuthEvent: vi.fn(async () => {}),
  clientIpFromHeaders: () => undefined,
}));

const mockMintAnchor = vi.fn();
const mockBindAnchor = vi.fn();
const mockResolveAnchor = vi.fn();
vi.mock("@/lib/aok/anchors", () => ({
  mintAnchor: (...a: unknown[]) => mockMintAnchor(...a),
  bindAnchor: (...a: unknown[]) => mockBindAnchor(...a),
  resolveAnchor: (...a: unknown[]) => mockResolveAnchor(...a),
}));

const mockRenderQr = vi.fn();
vi.mock("@/lib/aok/qr", () => ({
  renderQrPngBase64: (...a: unknown[]) => mockRenderQr(...a),
}));

const { POST: mintPOST } = await import("@/app/api/agent/aok/anchors/route");
const { POST: bindPOST } = await import("@/app/api/agent/aok/anchors/[id]/bind/route");
const { GET: resolveGET } = await import("@/app/api/agent/aok/anchors/resolve/route");

const FULL_ACCESS_CTX = {
  tenantId: "tenant-a",
  userId: "user-1",
  apiKeyId: "key-1",
  scopes: ["read", "write"],
};

const ANCHOR_ID = "11111111-1111-4111-8111-111111111111";
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

describe("POST /api/agent/aok/anchors (mint)", () => {
  test("mints an unbound anchor when asset_id is omitted, includes the QR PNG", async () => {
    mockMintAnchor.mockResolvedValue({
      id: ANCHOR_ID,
      payload: `scs://a/${ANCHOR_ID}`,
      status: "active",
      asset_id: null,
    });
    mockRenderQr.mockResolvedValue("base64png");

    const res = await mintPOST(req("POST", "/api/agent/aok/anchors", {}));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.ok).toBe(true);
    expect(body.anchor.asset_id).toBeNull();
    expect(body.qr_png_base64).toBe("base64png");
    expect(mockMintAnchor).toHaveBeenCalledWith("tenant-a", {});
    expect(mockRenderQr).toHaveBeenCalledWith(`scs://a/${ANCHOR_ID}`);
    expect(mockLogAgentAction).toHaveBeenCalledWith(
      FULL_ACCESS_CTX,
      "aok.anchor.mint",
      "aok_anchor",
      ANCHOR_ID
    );
  });

  test("empty request body (no Content-Length) is treated as {} rather than a 400", async () => {
    mockMintAnchor.mockResolvedValue({
      id: ANCHOR_ID,
      payload: `scs://a/${ANCHOR_ID}`,
      status: "active",
      asset_id: null,
    });
    mockRenderQr.mockResolvedValue("base64png");

    const emptyReq = new NextRequest("http://localhost:3000/api/agent/aok/anchors", {
      method: "POST",
      headers: { Authorization: "Bearer skb_live_validkey" },
    });
    const res = await mintPOST(emptyReq);
    expect(res.status).toBe(201);
  });

  test("mint bound directly with asset_id passes it through", async () => {
    mockMintAnchor.mockResolvedValue({
      id: ANCHOR_ID,
      payload: `scs://a/${ANCHOR_ID}`,
      status: "active",
      asset_id: ASSET_ID,
    });
    mockRenderQr.mockResolvedValue("base64png");

    const res = await mintPOST(req("POST", "/api/agent/aok/anchors", { asset_id: ASSET_ID }));
    expect(res.status).toBe(201);
    expect(mockMintAnchor).toHaveBeenCalledWith("tenant-a", { asset_id: ASSET_ID });
  });

  test("retired-asset rejection from the service layer => 409 speakable", async () => {
    const { retiredAssetError } = await import("@/lib/aok/errors");
    mockMintAnchor.mockRejectedValue(retiredAssetError());

    const res = await mintPOST(req("POST", "/api/agent/aok/anchors", { asset_id: ASSET_ID }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body).toEqual({ ok: false, error: "That object is retired." });
    expect(mockRenderQr).not.toHaveBeenCalled();
  });
});

describe("POST /api/agent/aok/anchors/:id/bind", () => {
  test("happy path: binds and returns the updated anchor", async () => {
    mockBindAnchor.mockResolvedValue({
      id: ANCHOR_ID,
      payload: `scs://a/${ANCHOR_ID}`,
      status: "active",
      asset_id: ASSET_ID,
    });

    const res = await bindPOST(
      req("POST", `/api/agent/aok/anchors/${ANCHOR_ID}/bind`, { asset_id: ASSET_ID }),
      routeCtx(ANCHOR_ID)
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.anchor.asset_id).toBe(ASSET_ID);
    expect(mockBindAnchor).toHaveBeenCalledWith("tenant-a", ANCHOR_ID, ASSET_ID);
  });

  test("validation-reject: missing asset_id => 400", async () => {
    const res = await bindPOST(
      req("POST", `/api/agent/aok/anchors/${ANCHOR_ID}/bind`, {}),
      routeCtx(ANCHOR_ID)
    );
    expect(res.status).toBe(400);
    expect(mockBindAnchor).not.toHaveBeenCalled();
  });

  test("binding to a non-active asset => 409 speakable", async () => {
    const { retiredAssetError } = await import("@/lib/aok/errors");
    mockBindAnchor.mockRejectedValue(retiredAssetError());

    const res = await bindPOST(
      req("POST", `/api/agent/aok/anchors/${ANCHOR_ID}/bind`, { asset_id: ASSET_ID }),
      routeCtx(ANCHOR_ID)
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe("That object is retired.");
  });
});

describe("GET /api/agent/aok/anchors/resolve", () => {
  function resolveReq(payload: string) {
    return req("GET", `/api/agent/aok/anchors/resolve?payload=${encodeURIComponent(payload)}`);
  }

  test("unbound anchor => 200 {ok:true, bound:false}", async () => {
    mockResolveAnchor.mockResolvedValue({ ok: true, bound: false, anchor_id: ANCHOR_ID });

    const res = await resolveGET(resolveReq(`scs://a/${ANCHOR_ID}`));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, bound: false, anchor_id: ANCHOR_ID });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  test("bound anchor => 200 {ok:true, bound:true, ...card fields}", async () => {
    mockResolveAnchor.mockResolvedValue({
      ok: true,
      bound: true,
      anchor_id: ANCHOR_ID,
      asset: { id: ASSET_ID },
      knowledge: [],
      last_visits: [],
      anchors: [],
    });

    const res = await resolveGET(resolveReq(`scs://a/${ANCHOR_ID}`));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.bound).toBe(true);
    expect(body.asset.id).toBe(ASSET_ID);
  });

  test("unknown payload => 404 speakable", async () => {
    mockResolveAnchor.mockResolvedValue({
      ok: false,
      error: "This code is not bound to any object.",
      status: 404,
    });

    const res = await resolveGET(resolveReq("scs://a/does-not-exist"));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ ok: false, error: "This code is not bound to any object." });
  });

  // Codex/GLM-critical asymmetry: a retired *target* is HTTP 200 with
  // ok:false — the anchor itself resolved fine.
  test("retired target => HTTP 200 with ok:false (asymmetric from unknown-payload's 404)", async () => {
    mockResolveAnchor.mockResolvedValue({
      ok: false,
      error: "This object was retired.",
      status: 200,
    });

    const res = await resolveGET(resolveReq(`scs://a/${ANCHOR_ID}`));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: false, error: "This object was retired." });
  });

  test("missing payload query param => 400 speakable", async () => {
    const res = await resolveGET(req("GET", "/api/agent/aok/anchors/resolve"));
    expect(res.status).toBe(400);
    expect(mockResolveAnchor).not.toHaveBeenCalled();
  });
});
