import { describe, test, expect, vi, beforeEach } from "vitest";

const mockFindUnique = vi.fn();
const mockCreate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    ingestLedgerEntry: {
      findUnique: (...a: unknown[]) => mockFindUnique(...a),
      create: (...a: unknown[]) => mockCreate(...a),
    },
  },
}));

const { computeContentHash, findLedgerEntry, writeLedgerEntry } = await import(
  "@/lib/agent/enrichment/ingestLedger"
);
const { enrich } = await import("@/lib/agent/enrichment/enrich");

const CTX = { tenantId: "t1", userId: "u1", scopes: ["read", "write"] };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("computeContentHash", () => {
  test("is deterministic and byte-sensitive", () => {
    expect(computeContentHash("hello")).toBe(computeContentHash("hello"));
    expect(computeContentHash("hello")).not.toBe(computeContentHash("hello ")); // whitespace differs
    expect(computeContentHash("hello")).toHaveLength(64);
  });
});

describe("findLedgerEntry", () => {
  test("looks up by composite (tenantId, contentHash)", async () => {
    mockFindUnique.mockResolvedValueOnce({ id: "led-1" });
    const entry = await findLedgerEntry("t1", "abc");
    expect(entry).toEqual({ id: "led-1" });
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { tenantId_contentHash: { tenantId: "t1", contentHash: "abc" } },
    });
  });
});

describe("writeLedgerEntry P2002 collapse", () => {
  test("swallows a concurrent duplicate and returns the existing row", async () => {
    mockCreate.mockRejectedValueOnce({ code: "P2002" });
    mockFindUnique.mockResolvedValueOnce({ id: "led-existing" });
    const entry = await writeLedgerEntry({
      tenantId: "t1",
      contentHash: "abc",
      sourceName: "s",
      planSummary: null,
      actionCount: 0,
    });
    expect(entry).toEqual({ id: "led-existing" });
  });
});

describe("enrich ledger short-circuit (AC6)", () => {
  test("byte-identical re-submit returns early WITHOUT calling the LLM", async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: "led-prior",
      tenantId: "t1",
      contentHash: computeContentHash("same text"),
      sourceName: "prev.txt",
      planSummary: null,
      actionCount: 2,
      ingestedAt: new Date(),
    });
    const backend = vi.fn(async () => "SHOULD NOT BE CALLED");

    const result = await enrich(CTX, {
      rawText: "same text",
      sourceName: "again.txt",
      backend,
    });

    expect(result.alreadyIngested).toBe(true);
    expect(result.ledgerEntry?.id).toBe("led-prior");
    expect(backend).not.toHaveBeenCalled();
  });
});
