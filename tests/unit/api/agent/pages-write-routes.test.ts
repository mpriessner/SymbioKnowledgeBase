/**
 * Handler-level tests for the agent/pages/* mutation routes.
 *
 * Each in-scope route (promote, capture-learning, refresh-aggregation,
 * conflicts POST, experiment-context/bulk) gets one happy-path test and one
 * validation-reject (400 VALIDATION_ERROR) test, mocking the underlying
 * chemistryKb service call — those libs already have their own dedicated unit
 * tests; this file is about route wiring (zod validation, auth/scope,
 * response envelope), matching the story's "thin" scope.
 *
 * `experiment-context/route.ts` (non-bulk, GET) is a read endpoint, not a
 * mutation, and is out of scope per the story.
 *
 * `extract-knowledge` uses `withTenant` (session auth), NOT `withAgentAuth` —
 * it is tested separately below under its real wrapper, per the story's
 * "only if tested under its real withTenant wrapper" guidance. No
 * API-key/scope assertions are made on it.
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

const mockPromotePage = vi.fn();
const mockCaptureLearning = vi.fn();
vi.mock("@/lib/chemistryKb/promotionService", () => ({
  promotePage: (...a: unknown[]) => mockPromotePage(...a),
  captureLearning: (...a: unknown[]) => mockCaptureLearning(...a),
}));

const mockImmediateRefresh = vi.fn();
vi.mock("@/lib/chemistryKb/aggregationRefresh", () => ({
  immediateRefresh: (...a: unknown[]) => mockImmediateRefresh(...a),
}));

const mockDetectConflicts = vi.fn();
const mockScanCategoryConflicts = vi.fn();
vi.mock("@/lib/chemistryKb/conflictDetection", () => ({
  detectConflicts: (...a: unknown[]) => mockDetectConflicts(...a),
  scanCategoryConflicts: (...a: unknown[]) => mockScanCategoryConflicts(...a),
}));

const mockAssembleBulkContext = vi.fn();
vi.mock("@/lib/chemistryKb/bulkExperimentContext", () => ({
  assembleBulkContext: (...a: unknown[]) => mockAssembleBulkContext(...a),
}));

const { POST: promotePOST } = await import("@/app/api/agent/pages/promote/route");
const { POST: captureLearningPOST } = await import(
  "@/app/api/agent/pages/capture-learning/route"
);
const { POST: refreshAggregationPOST } = await import(
  "@/app/api/agent/pages/refresh-aggregation/route"
);
const { POST: conflictsPOST } = await import("@/app/api/agent/pages/conflicts/route");
const { POST: bulkContextPOST } = await import(
  "@/app/api/agent/pages/experiment-context/bulk/route"
);

// ── Helpers ──────────────────────────────────────────────────────────────────

const FULL_ACCESS_CTX = {
  tenantId: "tenant-a",
  userId: "user-1",
  apiKeyId: "key-1",
  scopes: ["read", "write"],
};

// Valid RFC 4122 v4-shaped UUIDs — zod's `.uuid()` requires the variant
// nibble (4th group, first hex digit) to be 8/9/a/b; an all-same-digit
// placeholder like "1111-1111-..." fails validation and silently turns a
// "happy path" test into the validation-reject path (caught while writing
// this file — see Story Revision History).
const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

function postRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost:3000${url}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer skb_live_validkey",
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveApiKey.mockResolvedValue(FULL_ACCESS_CTX);
});

describe("POST /api/agent/pages/promote", () => {
  test("happy path: valid body promotes and returns the service result", async () => {
    mockPromotePage.mockResolvedValue({ pageId: UUID_B, promoted: true });

    const res = await promotePOST(
      postRequest("/api/agent/pages/promote", {
        sourcePageId: UUID_A,
        targetCategoryId: UUID_B,
        promotionType: "copy",
        sections: ["procedure"],
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual({ pageId: UUID_B, promoted: true });
    expect(mockPromotePage).toHaveBeenCalledWith(
      "tenant-a",
      "user-1",
      expect.objectContaining({ sourcePageId: UUID_A, promotionType: "copy" })
    );
  });

  test("validation-reject: non-UUID sourcePageId => 400 VALIDATION_ERROR", async () => {
    const res = await promotePOST(
      postRequest("/api/agent/pages/promote", {
        sourcePageId: "not-a-uuid",
        targetCategoryId: UUID_B,
        promotionType: "copy",
        sections: ["procedure"],
      })
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockPromotePage).not.toHaveBeenCalled();
  });
});

describe("POST /api/agent/pages/capture-learning", () => {
  test("happy path: valid body captures learnings", async () => {
    mockCaptureLearning.mockResolvedValue({ saved: 1, promoted: 0 });

    const res = await captureLearningPOST(
      postRequest("/api/agent/pages/capture-learning", {
        experimentId: "exp-1",
        learnings: [
          { type: "pitfall", content: "Overheating causes side reaction.", confidence: "high" },
        ],
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual({ saved: 1, promoted: 0 });
    expect(mockCaptureLearning).toHaveBeenCalledWith(
      "tenant-a",
      "user-1",
      expect.objectContaining({ experimentId: "exp-1" })
    );
  });

  test("validation-reject: empty learnings array => 400 VALIDATION_ERROR", async () => {
    const res = await captureLearningPOST(
      postRequest("/api/agent/pages/capture-learning", {
        experimentId: "exp-1",
        learnings: [],
      })
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockCaptureLearning).not.toHaveBeenCalled();
  });
});

describe("POST /api/agent/pages/refresh-aggregation", () => {
  test("happy path: valid pageIds triggers a refresh", async () => {
    mockImmediateRefresh.mockResolvedValue({ refreshed: [UUID_A] });

    const res = await refreshAggregationPOST(
      postRequest("/api/agent/pages/refresh-aggregation", {
        pageIds: [UUID_A],
        trigger: "manual",
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual({ refreshed: [UUID_A] });
    expect(mockImmediateRefresh).toHaveBeenCalledWith("tenant-a", [UUID_A], "manual");
  });

  test("validation-reject: non-UUID pageId => 400 VALIDATION_ERROR", async () => {
    const res = await refreshAggregationPOST(
      postRequest("/api/agent/pages/refresh-aggregation", {
        pageIds: ["not-a-uuid"],
      })
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockImmediateRefresh).not.toHaveBeenCalled();
  });
});

describe("POST /api/agent/pages/conflicts", () => {
  test("happy path: valid pageId + categoryId returns the conflict report", async () => {
    mockDetectConflicts.mockResolvedValue({ conflicts: [] });

    const res = await conflictsPOST(
      postRequest("/api/agent/pages/conflicts", {
        pageId: UUID_A,
        categoryId: UUID_B,
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual({ conflicts: [] });
    expect(mockDetectConflicts).toHaveBeenCalledWith("tenant-a", UUID_A, UUID_B);
  });

  test("validation-reject: missing categoryId => 400 VALIDATION_ERROR", async () => {
    const res = await conflictsPOST(
      postRequest("/api/agent/pages/conflicts", { pageId: UUID_A })
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockDetectConflicts).not.toHaveBeenCalled();
  });
});

describe("POST /api/agent/pages/experiment-context/bulk", () => {
  test("happy path: 1-5 experiments returns assembled context", async () => {
    mockAssembleBulkContext.mockResolvedValue({ experiments: [{ experimentId: "exp-1" }] });

    const res = await bulkContextPOST(
      postRequest("/api/agent/pages/experiment-context/bulk", {
        experiments: [{ experimentId: "exp-1", depth: "default" }],
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual({ experiments: [{ experimentId: "exp-1" }] });
    expect(mockAssembleBulkContext).toHaveBeenCalledWith(
      "tenant-a",
      [expect.objectContaining({ experimentId: "exp-1" })],
      45000
    );
  });

  test("validation-reject: empty experiments array => 400 VALIDATION_ERROR", async () => {
    const res = await bulkContextPOST(
      postRequest("/api/agent/pages/experiment-context/bulk", { experiments: [] })
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockAssembleBulkContext).not.toHaveBeenCalled();
  });
});

describe("POST /api/agent/pages/promote — auth (shared withAgentAuth wrapper)", () => {
  test("read-only key on this write route => 403", async () => {
    mockResolveApiKey.mockResolvedValue({ ...FULL_ACCESS_CTX, scopes: ["read"] });

    const res = await promotePOST(
      postRequest("/api/agent/pages/promote", {
        sourcePageId: UUID_A,
        targetCategoryId: UUID_B,
        promotionType: "copy",
        sections: ["procedure"],
      })
    );
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(mockPromotePage).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// extract-knowledge — uses withTenant (session auth), NOT withAgentAuth.
// Tested under its real wrapper, mocked the same way the existing
// `tests/unit/api/search/route.test.ts` mocks `withTenant`. No API-key/scope
// assertions here — that would not match this route's actual auth.
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth/withTenant", () => ({
  withTenant: (
    handler: (
      req: NextRequest,
      tenant: { tenantId: string; userId: string; role: string },
      ctx: { params: Promise<Record<string, string>> }
    ) => unknown
  ) => {
    return (req: NextRequest) =>
      handler(
        req,
        { tenantId: "tenant-a", userId: "user-1", role: "owner" },
        { params: Promise.resolve({}) }
      );
  },
}));

const mockExtractKnowledgeForExperiment = vi.fn();
const mockExtractKnowledgeBulk = vi.fn();
vi.mock("@/lib/chemistryKb/knowledgeExtractor", () => ({
  extractKnowledgeForExperiment: (...a: unknown[]) =>
    mockExtractKnowledgeForExperiment(...a),
  extractKnowledgeBulk: (...a: unknown[]) => mockExtractKnowledgeBulk(...a),
}));

const { POST: extractKnowledgePOST } = await import(
  "@/app/api/agent/pages/extract-knowledge/route"
);

function tenantPostRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/agent/pages/extract-knowledge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/agent/pages/extract-knowledge (withTenant)", () => {
  test("happy path: single-experiment extraction", async () => {
    mockExtractKnowledgeForExperiment.mockResolvedValue({ extracted: 2 });

    const res = await extractKnowledgePOST(
      tenantPostRequest({
        pageId: "page-1",
        sources: [{ type: "conversation", data: { text: "notes" } }],
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual({ extracted: 2 });
    expect(mockExtractKnowledgeForExperiment).toHaveBeenCalledWith(
      "tenant-a",
      "page-1",
      expect.any(Array),
      expect.objectContaining({})
    );
  });

  test("validation-reject: empty sources array => 400 VALIDATION_ERROR", async () => {
    const res = await extractKnowledgePOST(
      tenantPostRequest({ pageId: "page-1", sources: [] })
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockExtractKnowledgeForExperiment).not.toHaveBeenCalled();
  });
});
