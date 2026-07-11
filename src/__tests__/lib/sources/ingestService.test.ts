import { describe, test, expect, vi, beforeEach } from "vitest";

// ─── Mock the Prisma client ────────────────────────────────────────────────
const mockSourceFindUnique = vi.fn();
const mockSourceChunkCount = vi.fn();
const mockSourceOriginCreate = vi.fn();
const mockPageFindFirst = vi.fn();
const mockFileFindFirst = vi.fn();
const mockTransaction = vi.fn();

// tx-scoped mocks (inside $transaction)
const txSourceCreate = vi.fn();
const txSourceChunkCreateMany = vi.fn();
const txSourceOriginCreate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    source: {
      findUnique: (...a: unknown[]) => mockSourceFindUnique(...a),
    },
    sourceChunk: {
      count: (...a: unknown[]) => mockSourceChunkCount(...a),
    },
    sourceOrigin: {
      create: (...a: unknown[]) => mockSourceOriginCreate(...a),
    },
    page: {
      findFirst: (...a: unknown[]) => mockPageFindFirst(...a),
    },
    fileAttachment: {
      findFirst: (...a: unknown[]) => mockFileFindFirst(...a),
    },
    $transaction: (...a: unknown[]) => mockTransaction(...a),
  },
}));

const { ingestSource, IngestError } = await import(
  "@/lib/sources/ingestService"
);

const CTX = { tenantId: "t1", userId: "u1", scopes: ["read", "write"] };
const RAW = "First paragraph here.\n\nSecond paragraph body.";

beforeEach(() => {
  vi.clearAllMocks();
  // Default interactive-transaction impl: invoke the callback with a tx facade.
  mockTransaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb({
      source: { create: (...a: unknown[]) => txSourceCreate(...a) },
      sourceChunk: {
        createMany: (...a: unknown[]) => txSourceChunkCreateMany(...a),
      },
      sourceOrigin: { create: (...a: unknown[]) => txSourceOriginCreate(...a) },
    })
  );
});

describe("dryRun persists nothing (A1.11)", () => {
  test("returns in-memory chunks and writes zero rows", async () => {
    const res = await ingestSource(CTX, {
      kind: "NOTE",
      title: "t",
      rawText: RAW,
      dryRun: true,
    });
    expect(res.dryRun).toBe(true);
    expect(res.sourceId).toBeNull();
    expect(res.chunks.length).toBeGreaterThan(0);
    expect(mockSourceFindUnique).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockSourceOriginCreate).not.toHaveBeenCalled();
  });
});

describe("fresh ingest atomicity (GLM R2)", () => {
  test("Source + all chunks + first origin created in ONE $transaction", async () => {
    mockSourceFindUnique.mockResolvedValueOnce(null);
    txSourceCreate.mockResolvedValueOnce({ id: "src-new" });

    const res = await ingestSource(CTX, {
      kind: "NOTE",
      title: "My Source",
      rawText: RAW,
    });

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(txSourceCreate).toHaveBeenCalledTimes(1);
    expect(txSourceChunkCreateMany).toHaveBeenCalledTimes(1);
    expect(txSourceOriginCreate).toHaveBeenCalledTimes(1);
    // Chunk rows carry tenantId + sourceId scalars for the composite FK.
    const createManyArg = txSourceChunkCreateMany.mock.calls[0][0] as {
      data: Array<{ tenantId: string; sourceId: string; chunkIndex: number }>;
    };
    expect(createManyArg.data.length).toBe(res.chunks.length);
    expect(createManyArg.data[0].tenantId).toBe("t1");
    expect(createManyArg.data[0].sourceId).toBe("src-new");
    expect(res.sourceId).toBe("src-new");
    expect(res.deduped).toBe(false);
  });
});

describe("dedup no-op (AC1, A1.8)", () => {
  test("byte-identical re-ingest reuses Source, records a provenance occurrence, no new Source/chunks", async () => {
    mockSourceFindUnique.mockResolvedValueOnce({ id: "src-existing" });
    mockSourceOriginCreate.mockResolvedValueOnce({ id: "orig-2" });
    mockSourceChunkCount.mockResolvedValueOnce(2);

    const res = await ingestSource(CTX, {
      kind: "NOTE",
      title: "again",
      rawText: RAW,
    });

    expect(res.deduped).toBe(true);
    expect(res.sourceId).toBe("src-existing");
    expect(res.chunkCount).toBe(2);
    // No new Source/chunks — only a provenance occurrence.
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockSourceOriginCreate).toHaveBeenCalledTimes(1);
  });

  test("duplicate provenance (same originRef) collapses on P2002 without throwing", async () => {
    mockSourceFindUnique.mockResolvedValueOnce({ id: "src-existing" });
    mockSourceOriginCreate.mockRejectedValueOnce({ code: "P2002" });
    mockSourceChunkCount.mockResolvedValueOnce(2);
    // URL kind → no ownership lookup
    const res = await ingestSource(CTX, {
      kind: "URL",
      title: "again",
      rawText: RAW,
      originRef: "https://example.com/x",
    });
    expect(res.deduped).toBe(true);
  });
});

describe("originRef ownership validation (Codex R1)", () => {
  test("EXPERIMENT_SYNC originRef not in tenant → 403", async () => {
    mockPageFindFirst.mockResolvedValueOnce(null);
    await expect(
      ingestSource(CTX, {
        kind: "EXPERIMENT_SYNC",
        title: "x",
        rawText: RAW,
        originRef: "page-other-tenant",
      })
    ).rejects.toMatchObject({ status: 403 });
    expect(mockPageFindFirst).toHaveBeenCalled();
    // Rejected before any write.
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  test("DOCUMENT originRef not in tenant → 403", async () => {
    mockFileFindFirst.mockResolvedValueOnce(null);
    await expect(
      ingestSource(CTX, {
        kind: "DOCUMENT",
        title: "x",
        rawText: RAW,
        originRef: "file-other-tenant",
      })
    ).rejects.toBeInstanceOf(IngestError);
  });

  test("empty rawText → 400", async () => {
    await expect(
      ingestSource(CTX, { kind: "NOTE", title: "x", rawText: "" })
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe("concurrent-ingest dedup race (Codex R1)", () => {
  test("P2002 on the dedup unique reuses the concurrent winner's Source", async () => {
    mockSourceFindUnique
      .mockResolvedValueOnce(null) // dedup miss
      .mockResolvedValueOnce({ id: "src-winner" }); // re-lookup after P2002
    mockTransaction.mockRejectedValueOnce({ code: "P2002" });
    mockSourceChunkCount.mockResolvedValueOnce(3);

    const res = await ingestSource(CTX, {
      kind: "NOTE",
      title: "race",
      rawText: RAW,
    });
    expect(res.deduped).toBe(true);
    expect(res.sourceId).toBe("src-winner");
  });
});
