import { describe, test, expect, vi, beforeEach } from "vitest";

/**
 * Route-level discriminator (Codex R1): dryRun → synchronous {mode:'sync', ...};
 * a real run → durable async {mode:'async', jobId, status}. A caller branches on
 * `mode` before parsing, never guesses between two shapes on one route.
 */

const mockEnrich = vi.fn();
const mockCreateJob = vi.fn();
const mockRunJob = vi.fn();

// withAgentAuth → pass-through injecting a fixed ctx (auth is exercised elsewhere).
vi.mock("@/lib/agent/auth", () => ({
  withAgentAuth:
    (handler: (req: unknown, ctx: unknown, rc: unknown) => unknown) =>
    (req: unknown, rc: unknown) =>
      handler(req, { tenantId: "t1", userId: "u1", apiKeyId: "k1", scopes: ["read", "write"] }, rc),
}));
vi.mock("@/lib/agent/enrichment/enrich", () => ({
  enrich: (...a: unknown[]) => mockEnrich(...a),
  EnrichmentError: class extends Error {
    status = 400;
  },
  MAX_RAW_TEXT_CHARS: 50000,
}));
vi.mock("@/lib/agent/enrichment/enrichJob", () => ({
  createEnrichJob: (...a: unknown[]) => mockCreateJob(...a),
}));
vi.mock("@/lib/agent/enrichment/enrichJobRunner", () => ({
  runEnrichJob: (...a: unknown[]) => mockRunJob(...a),
}));

const { POST } = await import("@/app/api/agent/pages/enrich/route");

function req(body: unknown) {
  return { json: async () => body } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRunJob.mockResolvedValue(undefined);
});

describe("POST /api/agent/pages/enrich discriminator", () => {
  test("dryRun:true → mode 'sync' with the plan, persists nothing", async () => {
    mockEnrich.mockResolvedValue({
      plan: { reasoning: "r", actions: [] },
      applied: [],
      warnings: ["w"],
      dryRun: true,
    });
    const res = (await POST(req({ rawText: "x", sourceName: "s", dryRun: true }), undefined as never)) as Response;
    const json = await res.json();
    expect(json.data.mode).toBe("sync");
    expect(json.data.plan).toEqual({ reasoning: "r", actions: [] });
    expect(json.data.applied).toEqual([]);
    // dryRun goes through enrich(), never creates a job.
    expect(mockEnrich).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ dryRun: true })
    );
    expect(mockCreateJob).not.toHaveBeenCalled();
  });

  test("real run → mode 'async' with a durable jobId, kicks the runner", async () => {
    mockCreateJob.mockResolvedValue({ id: "job-9", status: "QUEUED" });
    const res = (await POST(req({ rawText: "x", sourceName: "s" }), undefined as never)) as Response;
    const json = await res.json();
    expect(json.data.mode).toBe("async");
    expect(json.data.jobId).toBe("job-9");
    expect(json.data.status).toBe("QUEUED");
    expect(mockCreateJob).toHaveBeenCalledTimes(1);
    expect(mockRunJob).toHaveBeenCalledTimes(1);
    // The synchronous enrich() body path is NOT used for a real run.
    expect(mockEnrich).not.toHaveBeenCalled();
  });

  test("invalid body → 400 validation error (no job, no enrich)", async () => {
    const res = (await POST(req({ sourceName: "s" }), undefined as never)) as Response;
    expect(res.status).toBe(400);
    expect(mockCreateJob).not.toHaveBeenCalled();
  });
});
