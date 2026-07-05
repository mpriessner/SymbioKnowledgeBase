/**
 * Route test for POST /api/agent/kb-query — the voice-agent KB query endpoint.
 *
 * Strategy (mock-first, per docs/stories/2026-07-04-test-agent-query-routes.md):
 *   - Mock `resolveApiKey` (@/lib/apiAuth) and `checkRateLimit`
 *     (@/lib/agent/ratelimit) so the wrapper (`withAgentAuth`) receives a known
 *     `AgentContext` without touching Postgres or the module-singleton rate
 *     limiter.
 *   - Mock `executeKbQuery` (@/lib/agent/kbQuery) entirely. This route test is
 *     about ROUTE WIRING (JSON parsing, zod validation, response envelope,
 *     auth/scope enforcement, tenant plumbing) — the query engine itself
 *     (intent classification, entity extraction, the LRU query cache, the
 *     depth search) is exercised by its own unit tests. Mocking at this
 *     boundary also sidesteps the real-DB seed requirements called out in the
 *     story (exact category-root pages, `spaceType: "TEAM"`, `plainText` for
 *     the search_vector trigger) and the "real-DB tenant isolation can't
 *     construct a catchable leak" trap — the only version of that assertion
 *     that can fail is asserting the tenantId passed INTO executeKbQuery,
 *     which is what the tenant-isolation test below does.
 *   - The handler's own success/error envelopes are hand-built
 *     (`{ success, data }` / `{ success: false, error, data }`), NOT
 *     `apiResponse` helpers; the 401/403 from the `withAgentAuth` wrapper use
 *     the *other* envelope (`errorResponse` -> `{ error: { code, message },
 *     meta }`). Both are asserted below, distinctly.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { KbQueryResult } from "@/lib/agent/kbQuery";
import {
  kbQueryHappyPathResult,
  kbQueryEmptyResult,
} from "../../../fixtures/agent-routes/kb-query.fixture";

const mockResolveApiKey = vi.fn();
vi.mock("@/lib/apiAuth", () => ({
  resolveApiKey: (...a: unknown[]) => mockResolveApiKey(...a),
}));

// Always-allow: avoids the module-singleton rate-limit counter bleeding
// across tests and avoids depending on ratelimit.ts's internal timing.
vi.mock("@/lib/agent/ratelimit", () => ({
  checkRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 99,
    resetAt: Date.now() + 60_000,
  })),
}));

const mockExecuteKbQuery = vi.fn();
vi.mock("@/lib/agent/kbQuery", () => ({
  executeKbQuery: (...a: unknown[]) => mockExecuteKbQuery(...a),
}));

const { POST } = await import("@/app/api/agent/kb-query/route");

// ── Helpers ──────────────────────────────────────────────────────────────────

const FULL_ACCESS_CTX = {
  tenantId: "tenant-a",
  userId: "user-1",
  apiKeyId: "key-1",
  scopes: ["read", "write"],
};

function postRequest(rawBody: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost:3000/api/agent/kb-query", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer skb_live_validkey",
      ...headers,
    },
    body: rawBody,
  });
}

/** Strip the non-deterministic `elapsed_ms` field before asserting shape. */
function stripElapsed(result: KbQueryResult): Omit<KbQueryResult, "query_metadata"> & {
  query_metadata: Omit<KbQueryResult["query_metadata"], "elapsed_ms">;
} {
  const { elapsed_ms: _elapsed_ms, ...restMetadata } = result.query_metadata;
  return { ...result, query_metadata: restMetadata };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveApiKey.mockResolvedValue(FULL_ACCESS_CTX);
});

describe("POST /api/agent/kb-query — happy path", () => {
  test("returns the stable KbQueryResult fields the voice clients read", async () => {
    mockExecuteKbQuery.mockResolvedValue(kbQueryHappyPathResult);

    const res = await POST(
      postRequest(JSON.stringify({ query: "Is ethanol safe to handle?" }))
    );

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(typeof body.data.answer).toBe("string");
    expect(body.data.answer.length).toBeGreaterThan(0);

    // context_blocks must be non-empty and shaped per ContextBlock — asserting
    // only `Array.isArray` would pass vacuously against the empty-KB fallback.
    expect(Array.isArray(body.data.context_blocks)).toBe(true);
    expect(body.data.context_blocks.length).toBeGreaterThan(0);
    const block = body.data.context_blocks[0];
    expect(block).toMatchObject({
      type: expect.any(String),
      entity: expect.any(String),
      entity_id: expect.any(String),
      content: expect.any(String),
      source_page: expect.any(String),
    });
    expect(typeof block.relevance).toBe("number");
    expect(typeof block.char_count).toBe("number");

    // query_metadata: pin the stable keys, normalize elapsed_ms (non-deterministic).
    expect(stripElapsed(body.data)).toEqual(stripElapsed(kbQueryHappyPathResult));
    expect(typeof body.data.query_metadata.elapsed_ms).toBe("number");
    expect(body.data.query_metadata).toMatchObject({
      intent: expect.any(String),
      search_depth: expect.any(String),
      search_strategy: expect.any(String),
      pages_searched: expect.any(Number),
      graph_hops: expect.any(Number),
    });
  });

  test("tenant isolation: the authed tenantId is passed into executeKbQuery", async () => {
    mockResolveApiKey.mockResolvedValue({ ...FULL_ACCESS_CTX, tenantId: "tenant-A-only" });
    mockExecuteKbQuery.mockResolvedValue(kbQueryHappyPathResult);

    await POST(postRequest(JSON.stringify({ query: "What is NaOH used for?" })));

    expect(mockExecuteKbQuery).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant-A-only" })
    );
  });

  test("empty-result path still returns a well-formed (fallback) answer", async () => {
    mockExecuteKbQuery.mockResolvedValue(kbQueryEmptyResult);

    const res = await POST(
      postRequest(JSON.stringify({ query: "Some totally unrelated question" }))
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.context_blocks).toEqual([]);
    expect(typeof body.data.answer).toBe("string");
    expect(body.data.answer.length).toBeGreaterThan(0);
  });
});

describe("POST /api/agent/kb-query — malformed / invalid input", () => {
  test("malformed JSON body => 400 { success: false, error }", async () => {
    const res = await POST(postRequest("{not valid json"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(typeof body.error).toBe("string");
    expect(body.data).toBeDefined();
    expect(mockExecuteKbQuery).not.toHaveBeenCalled();
  });

  test("schema-invalid body (missing query) => 400", async () => {
    const res = await POST(postRequest(JSON.stringify({ experiment_id: "exp-1" })));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toContain("Validation error");
    expect(mockExecuteKbQuery).not.toHaveBeenCalled();
  });

  test("schema-invalid body (empty query string) => 400", async () => {
    const res = await POST(postRequest(JSON.stringify({ query: "" })));
    expect(res.status).toBe(400);
    expect(mockExecuteKbQuery).not.toHaveBeenCalled();
  });
});

describe("POST /api/agent/kb-query — auth (wrapper envelope)", () => {
  test("missing Authorization header => 401", async () => {
    const res = await POST(
      new NextRequest("http://localhost:3000/api/agent/kb-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "test" }),
      })
    );
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(mockExecuteKbQuery).not.toHaveBeenCalled();
  });

  test("resolveApiKey returns null (invalid/revoked key) => 401", async () => {
    mockResolveApiKey.mockResolvedValue(null);

    const res = await POST(postRequest(JSON.stringify({ query: "test" })));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(mockExecuteKbQuery).not.toHaveBeenCalled();
  });

  test("read-only key on this POST route => 403 (write scope required)", async () => {
    // Explicit partial scopes array — an empty array would be normalized to
    // full access by resolveApiKey's own normalizeScopes, so a real 403 test
    // must supply an explicit non-empty-but-restricted scope set.
    mockResolveApiKey.mockResolvedValue({ ...FULL_ACCESS_CTX, scopes: ["read"] });

    const res = await POST(postRequest(JSON.stringify({ query: "test" })));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(mockExecuteKbQuery).not.toHaveBeenCalled();
  });
});
