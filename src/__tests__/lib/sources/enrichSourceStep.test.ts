import { describe, test, expect, vi, beforeEach } from "vitest";

/**
 * A1.10 — Source existence is NEVER an enrichment short-circuit; the a71-13
 * LEDGER stays the short-circuit. Even when the Source already exists (dedup),
 * enrichment still runs and the ledger is written once. Also proves the pre-step
 * runs on a real apply but NOT on dryRun (A1.11 at the enrich layer).
 */

const mockIngestSource = vi.fn();
const mockFindLedger = vi.fn();
const mockWriteLedger = vi.fn();
const mockProposePlan = vi.fn();
const mockApplyPlan = vi.fn();

vi.mock("@/lib/sources/ingestService", () => ({
  ingestSource: (...a: unknown[]) => mockIngestSource(...a),
  IngestError: class extends Error {},
}));
vi.mock("@/lib/agent/enrichment/ingestLedger", async () => {
  const crypto = await import("crypto");
  return {
    computeContentHash: (t: string) =>
      crypto.createHash("sha256").update(t, "utf8").digest("hex"),
    findLedgerEntry: (...a: unknown[]) => mockFindLedger(...a),
    writeLedgerEntry: (...a: unknown[]) => mockWriteLedger(...a),
  };
});
vi.mock("@/lib/agent/enrichment/conceptsIndex", () => ({
  resolveConceptsCategory: async () => "concepts-cat",
  gatherConceptPages: async () => [],
  buildConceptContext: () => ({ index: [], bodies: [] }),
  scheduleConceptsIndexRegeneration: vi.fn(),
}));
vi.mock("@/lib/agent/enrichment/enrichmentAgent", () => ({
  proposePlan: (...a: unknown[]) => mockProposePlan(...a),
}));
vi.mock("@/lib/agent/enrichment/applyPlan", () => ({
  applyPlan: (...a: unknown[]) => mockApplyPlan(...a),
}));
vi.mock("@/lib/chemistryKb/aggregationRefresh", () => ({
  scheduleAggregationRefresh: vi.fn(),
}));
// isWithinSubtree only runs when a targetCategoryId is supplied — not here.
vi.mock("@/lib/db", () => ({ prisma: {} }));

const { enrich } = await import("@/lib/agent/enrichment/enrich");

const CTX = { tenantId: "t1", userId: "u1", scopes: ["read", "write"] };

beforeEach(() => {
  vi.clearAllMocks();
  mockProposePlan.mockResolvedValue({ actions: [], reasoning: "none" });
  mockApplyPlan.mockResolvedValue({
    applied: [],
    warnings: [],
    affectedPageIds: [],
  });
  mockWriteLedger.mockResolvedValue({ id: "led-1" });
});

test("no prior ledger + Source dedups → enrichment STILL runs, ledger written once", async () => {
  mockFindLedger.mockResolvedValue(null); // no ledger short-circuit
  mockIngestSource.mockResolvedValue({
    sourceId: "src-existing",
    deduped: true, // Source already exists — must NOT short-circuit
    chunkCount: 3,
    chunks: [],
    dryRun: false,
  });

  const res = await enrich(CTX, { rawText: "hello world", sourceName: "s.txt" });

  expect(mockIngestSource).toHaveBeenCalledTimes(1);
  expect(mockProposePlan).toHaveBeenCalledTimes(1); // enrichment ran
  expect(mockWriteLedger).toHaveBeenCalledTimes(1); // ledger written once
  expect(res.sourceId).toBe("src-existing");
  expect(res.alreadyIngested).toBeUndefined();
});

test("dryRun does NOT persist a Source (pre-step skipped)", async () => {
  mockFindLedger.mockResolvedValue(null);

  const res = await enrich(CTX, {
    rawText: "hello world",
    sourceName: "s.txt",
    dryRun: true,
  });

  expect(res.dryRun).toBe(true);
  expect(mockIngestSource).not.toHaveBeenCalled(); // zero writes on dryRun
  expect(mockWriteLedger).not.toHaveBeenCalled();
});

test("a failed Source pre-step does not block enrichment (best-effort)", async () => {
  mockFindLedger.mockResolvedValue(null);
  mockIngestSource.mockRejectedValue(new Error("db down"));

  const res = await enrich(CTX, { rawText: "hello world", sourceName: "s.txt" });

  expect(mockProposePlan).toHaveBeenCalledTimes(1); // enrichment still ran
  expect(res.warnings.some((w) => w.includes("source persist skipped"))).toBe(
    true
  );
});

describe("guard", () => {
  test("suite loaded", () => {
    expect(enrich).toBeTypeOf("function");
  });
});
