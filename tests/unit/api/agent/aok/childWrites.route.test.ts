/**
 * Handler-level tests for the AOK child-write routes: knowledge, counts,
 * visits — POST under an asset, DELETE by their own id. Mocks the service
 * layer; DB-backed non-active-asset rejection is covered end-to-end in
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

const mockLogAgentAction = vi.fn();
vi.mock("@/lib/agent/audit", () => ({
  logAgentAction: async (...a: unknown[]) => {
    mockLogAgentAction(...a);
  },
  logAuthEvent: vi.fn(async () => {}),
  clientIpFromHeaders: () => undefined,
}));

const mockAddKnowledge = vi.fn();
const mockDeleteKnowledge = vi.fn();
vi.mock("@/lib/aok/knowledge", () => ({
  addKnowledge: (...a: unknown[]) => mockAddKnowledge(...a),
  deleteKnowledge: (...a: unknown[]) => mockDeleteKnowledge(...a),
}));

const mockAddCount = vi.fn();
const mockDeleteCountLine = vi.fn();
vi.mock("@/lib/aok/counts", () => ({
  addCount: (...a: unknown[]) => mockAddCount(...a),
  deleteCountLine: (...a: unknown[]) => mockDeleteCountLine(...a),
}));

const mockAddVisit = vi.fn();
const mockDeleteVisit = vi.fn();
vi.mock("@/lib/aok/visits", () => ({
  addVisit: (...a: unknown[]) => mockAddVisit(...a),
  deleteVisit: (...a: unknown[]) => mockDeleteVisit(...a),
}));

const { POST: knowledgePOST } = await import("@/app/api/agent/aok/assets/[id]/knowledge/route");
const { POST: countsPOST } = await import("@/app/api/agent/aok/assets/[id]/counts/route");
const { POST: visitsPOST } = await import("@/app/api/agent/aok/assets/[id]/visits/route");
const { DELETE: knowledgeDELETE } = await import("@/app/api/agent/aok/knowledge/[id]/route");
const { DELETE: countsDELETE } = await import("@/app/api/agent/aok/counts/[id]/route");
const { DELETE: visitsDELETE } = await import("@/app/api/agent/aok/visits/[id]/route");

const FULL_ACCESS_CTX = {
  tenantId: "tenant-a",
  userId: "user-1",
  apiKeyId: "key-1",
  scopes: ["read", "write"],
};

const ASSET_ID = "cjld2cyuq0000t3rmniod1foy";
const CHILD_ID = "cjld2cyuq0001t3rmniod1foz";

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

describe("POST /api/agent/aok/assets/:id/knowledge", () => {
  test("happy path: default kind is applied by the service, audit ids-only", async () => {
    mockAddKnowledge.mockResolvedValue({ id: CHILD_ID, kind: "gotcha", text: "Careful, hot." });

    const res = await knowledgePOST(
      req("POST", `/api/agent/aok/assets/${ASSET_ID}/knowledge`, { text: "Careful, hot." }),
      routeCtx(ASSET_ID)
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.ok).toBe(true);
    expect(mockAddKnowledge).toHaveBeenCalledWith("tenant-a", ASSET_ID, { text: "Careful, hot." });
    // Audit call carries ids only — never the note text.
    expect(mockLogAgentAction).toHaveBeenCalledWith(
      FULL_ACCESS_CTX,
      "aok.knowledge.create",
      "aok_knowledge",
      CHILD_ID
    );
    const auditArgs = mockLogAgentAction.mock.calls[0];
    expect(JSON.stringify(auditArgs)).not.toContain("Careful, hot.");
  });

  test("rejected against a non-active asset => 409 speakable", async () => {
    const { retiredAssetError } = await import("@/lib/aok/errors");
    mockAddKnowledge.mockRejectedValue(retiredAssetError());

    const res = await knowledgePOST(
      req("POST", `/api/agent/aok/assets/${ASSET_ID}/knowledge`, { text: "Careful." }),
      routeCtx(ASSET_ID)
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe("That object is retired.");
  });

  test("validation-reject: empty text => 400", async () => {
    const res = await knowledgePOST(
      req("POST", `/api/agent/aok/assets/${ASSET_ID}/knowledge`, { text: "" }),
      routeCtx(ASSET_ID)
    );
    expect(res.status).toBe(400);
    expect(mockAddKnowledge).not.toHaveBeenCalled();
  });
});

describe("POST /api/agent/aok/assets/:id/counts", () => {
  test("happy path: numeric delta round-trips as JSON numbers, not strings", async () => {
    mockAddCount.mockResolvedValue({
      id: CHILD_ID,
      counted_qty: 7,
      expected_qty: 10,
      delta: -3,
    });

    const res = await countsPOST(
      req("POST", `/api/agent/aok/assets/${ASSET_ID}/counts`, { qty: 7 }),
      routeCtx(ASSET_ID)
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.expected_qty).toBe(10);
    expect(body.delta).toBe(-3);
    expect(typeof body.delta).toBe("number");
    expect(mockAddCount).toHaveBeenCalledWith("tenant-a", ASSET_ID, { qty: 7 });
  });

  test("nulls when no expected_qty is set on the asset", async () => {
    mockAddCount.mockResolvedValue({
      id: CHILD_ID,
      counted_qty: 7,
      expected_qty: null,
      delta: null,
    });

    const res = await countsPOST(
      req("POST", `/api/agent/aok/assets/${ASSET_ID}/counts`, { qty: 7 }),
      routeCtx(ASSET_ID)
    );
    const body = await res.json();

    expect(body.expected_qty).toBeNull();
    expect(body.delta).toBeNull();
  });

  test("validation-reject: non-numeric qty => 400", async () => {
    const res = await countsPOST(
      req("POST", `/api/agent/aok/assets/${ASSET_ID}/counts`, { qty: "seven" }),
      routeCtx(ASSET_ID)
    );
    expect(res.status).toBe(400);
    expect(mockAddCount).not.toHaveBeenCalled();
  });
});

describe("POST /api/agent/aok/assets/:id/visits", () => {
  test("happy path", async () => {
    mockAddVisit.mockResolvedValue({ id: CHILD_ID, reason: "check", outcome: "ok" });

    const res = await visitsPOST(
      req("POST", `/api/agent/aok/assets/${ASSET_ID}/visits`, {
        reason: "check",
        outcome: "ok",
      }),
      routeCtx(ASSET_ID)
    );
    expect(res.status).toBe(201);
    expect(mockAddVisit).toHaveBeenCalledWith("tenant-a", ASSET_ID, {
      reason: "check",
      outcome: "ok",
    });
  });

  test("validation-reject: missing outcome => 400", async () => {
    const res = await visitsPOST(
      req("POST", `/api/agent/aok/assets/${ASSET_ID}/visits`, { reason: "check" }),
      routeCtx(ASSET_ID)
    );
    expect(res.status).toBe(400);
    expect(mockAddVisit).not.toHaveBeenCalled();
  });
});

describe("DELETE routes (undo support)", () => {
  test("DELETE /knowledge/:id — happy path", async () => {
    mockDeleteKnowledge.mockResolvedValue(undefined);
    const res = await knowledgeDELETE(req("DELETE", `/api/agent/aok/knowledge/${CHILD_ID}`), routeCtx(CHILD_ID));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(mockDeleteKnowledge).toHaveBeenCalledWith("tenant-a", CHILD_ID);
    expect(mockLogAgentAction).toHaveBeenCalledWith(
      FULL_ACCESS_CTX,
      "aok.knowledge.delete",
      "aok_knowledge",
      CHILD_ID
    );
  });

  test("DELETE /knowledge/:id — not found => 404 speakable", async () => {
    const { notFoundError } = await import("@/lib/aok/errors");
    mockDeleteKnowledge.mockRejectedValue(notFoundError("note"));

    const res = await knowledgeDELETE(req("DELETE", `/api/agent/aok/knowledge/${CHILD_ID}`), routeCtx(CHILD_ID));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ ok: false, error: "That note could not be found." });
  });

  test("DELETE /counts/:id — happy path", async () => {
    mockDeleteCountLine.mockResolvedValue(undefined);
    const res = await countsDELETE(req("DELETE", `/api/agent/aok/counts/${CHILD_ID}`), routeCtx(CHILD_ID));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(mockDeleteCountLine).toHaveBeenCalledWith("tenant-a", CHILD_ID);
  });

  test("DELETE /visits/:id — happy path", async () => {
    mockDeleteVisit.mockResolvedValue(undefined);
    const res = await visitsDELETE(req("DELETE", `/api/agent/aok/visits/${CHILD_ID}`), routeCtx(CHILD_ID));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(mockDeleteVisit).toHaveBeenCalledWith("tenant-a", CHILD_ID);
  });

  test("invalid id shape on delete => 404, service never called", async () => {
    const res = await visitsDELETE(req("DELETE", "/api/agent/aok/visits/bad"), routeCtx("bad"));
    expect(res.status).toBe(404);
    expect(mockDeleteVisit).not.toHaveBeenCalled();
  });
});
