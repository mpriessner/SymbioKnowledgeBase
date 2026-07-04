import { describe, test, expect, vi, beforeEach } from "vitest";

// ─── Prisma mock ──────────────────────────────────────────────────────────────
// Top-level (non-transaction) client methods.
const mockDvFindFirst = vi.fn();
const mockDvCount = vi.fn();
const mockBlockFindFirst = vi.fn();

// Transaction client methods (passed to the $transaction callback).
const mockTxDvFindFirst = vi.fn();
const mockTxDvCreate = vi.fn();
const mockTxDvFindMany = vi.fn();
const mockTxDvDeleteMany = vi.fn();
const mockTxBlockUpdateMany = vi.fn();

const txClient = {
  documentVersion: {
    findFirst: mockTxDvFindFirst,
    create: mockTxDvCreate,
    findMany: mockTxDvFindMany,
    deleteMany: mockTxDvDeleteMany,
  },
  block: {
    updateMany: mockTxBlockUpdateMany,
  },
};

const mockTransaction = vi.fn(
  (fn: (tx: typeof txClient) => unknown) => fn(txClient)
);

vi.mock("@/lib/db", () => ({
  prisma: {
    documentVersion: {
      findFirst: mockDvFindFirst,
      count: mockDvCount,
    },
    block: {
      findFirst: mockBlockFindFirst,
    },
    $transaction: (fn: (tx: typeof txClient) => unknown) => mockTransaction(fn),
  },
}));

// Side-effect fan-out — mocked to no-ops so restore doesn't touch real infra.
const mockUpdatePageLinks = vi.fn(async () => {});
const mockUpdateSearchIndex = vi.fn(async () => {});
const mockSyncPageToFilesystem = vi.fn(async () => {});

vi.mock("@/lib/wikilinks/indexer", () => ({
  updatePageLinks: mockUpdatePageLinks,
}));
vi.mock("@/lib/search/indexer", () => ({
  updateSearchIndex: mockUpdateSearchIndex,
}));
vi.mock("@/lib/sync/SyncService", () => ({
  syncPageToFilesystem: mockSyncPageToFilesystem,
}));

const {
  createDocumentVersion,
  snapshotOnSave,
  restoreDocumentVersion,
} = await import("@/lib/livingDocs/versioning");

const PAGE = "page-1";
const TENANT = "tenant-1";
const USER = "user-1";

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no prune candidates unless a test overrides.
  mockTxDvFindMany.mockResolvedValue([]);
  mockTxDvDeleteMany.mockResolvedValue({ count: 0 });
});

// ─── Coalescing ───────────────────────────────────────────────────────────────

describe("snapshotOnSave — coalescing", () => {
  test("skips a new version for a rapid same-user edit within the window", async () => {
    mockDvFindFirst.mockResolvedValue({
      version: 3,
      plainText: "hello world",
      changeType: "MANUAL",
      changeSource: USER,
      createdAt: new Date(), // just now → within window
    });

    await snapshotOnSave({
      pageId: PAGE,
      tenantId: TENANT,
      content: { type: "doc" },
      plainText: "hello world foo", // small delta
      userId: USER,
    });

    // Coalesced → no insert.
    expect(mockTxDvCreate).not.toHaveBeenCalled();
  });

  test("plainText is compared from the passed (content-derived) text, not the stored block", async () => {
    // Latest stored plainText is identical to what we derived from the saved
    // content → treated as a no-op even though a naive block.plainText might differ.
    mockDvFindFirst.mockResolvedValue({
      version: 3,
      plainText: "same text",
      changeType: "MANUAL",
      changeSource: USER,
      createdAt: new Date(),
    });

    await snapshotOnSave({
      pageId: PAGE,
      tenantId: TENANT,
      content: { type: "doc" },
      plainText: "same text",
      userId: USER,
    });

    expect(mockTxDvCreate).not.toHaveBeenCalled();
  });

  test("bypasses coalescing on a large plainText delta", async () => {
    mockDvFindFirst.mockResolvedValue({
      version: 3,
      plainText: "",
      changeType: "MANUAL",
      changeSource: USER,
      createdAt: new Date(),
    });
    mockTxDvFindFirst.mockResolvedValue({ version: 3, plainText: "" });
    mockTxDvCreate.mockResolvedValue({ id: "v4", version: 4 });

    const big = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ");
    await snapshotOnSave({
      pageId: PAGE,
      tenantId: TENANT,
      content: { type: "doc" },
      plainText: big,
      userId: USER,
    });

    expect(mockTxDvCreate).toHaveBeenCalledTimes(1);
  });

  test("bypasses coalescing when the latest version is from a different user", async () => {
    mockDvFindFirst.mockResolvedValue({
      version: 3,
      plainText: "hello world",
      changeType: "MANUAL",
      changeSource: "someone-else",
      createdAt: new Date(),
    });
    mockTxDvFindFirst.mockResolvedValue({ version: 3, plainText: "hello world" });
    mockTxDvCreate.mockResolvedValue({ id: "v4", version: 4 });

    await snapshotOnSave({
      pageId: PAGE,
      tenantId: TENANT,
      content: { type: "doc" },
      plainText: "hello world foo",
      userId: USER,
    });

    expect(mockTxDvCreate).toHaveBeenCalledTimes(1);
  });
});

// ─── First-edit baseline ──────────────────────────────────────────────────────

describe("snapshotOnSave — first-edit baseline", () => {
  test("captures the previous content as a baseline before the new version", async () => {
    mockDvFindFirst.mockResolvedValue(null); // no versions yet
    // createDocumentVersion runs twice (baseline + new); latest lookup null → v1, v2.
    mockTxDvFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ version: 1, plainText: "old text" });
    mockTxDvCreate
      .mockResolvedValueOnce({ id: "v1", version: 1 })
      .mockResolvedValueOnce({ id: "v2", version: 2 });

    await snapshotOnSave({
      pageId: PAGE,
      tenantId: TENANT,
      content: { type: "doc", marker: "new" },
      plainText: "new text",
      userId: USER,
      previousContent: { type: "doc", marker: "old" },
      previousPlainText: "old text",
    });

    expect(mockTxDvCreate).toHaveBeenCalledTimes(2);
    const firstArg = mockTxDvCreate.mock.calls[0][0] as {
      data: { plainText: string; changeNotes: string | null };
    };
    expect(firstArg.data.plainText).toBe("old text");
    expect(firstArg.data.changeNotes).toBe("Baseline before first edit");
  });

  test("skips the baseline when there was no previous content", async () => {
    mockDvFindFirst.mockResolvedValue(null);
    mockTxDvFindFirst.mockResolvedValue(null);
    mockTxDvCreate.mockResolvedValue({ id: "v1", version: 1 });

    await snapshotOnSave({
      pageId: PAGE,
      tenantId: TENANT,
      content: { type: "doc" },
      plainText: "first ever content",
      userId: USER,
      previousContent: null,
      previousPlainText: "",
    });

    // Only the new version, no baseline.
    expect(mockTxDvCreate).toHaveBeenCalledTimes(1);
  });
});

// ─── P2002 retry ──────────────────────────────────────────────────────────────

describe("createDocumentVersion — unique-constraint race", () => {
  test("retries once on P2002 and succeeds", async () => {
    mockTxDvFindFirst.mockResolvedValue({ version: 4, plainText: "" });
    mockTxDvCreate
      .mockRejectedValueOnce(Object.assign(new Error("unique"), { code: "P2002" }))
      .mockResolvedValueOnce({ id: "v5", version: 5 });

    const result = await createDocumentVersion({
      pageId: PAGE,
      tenantId: TENANT,
      content: { type: "doc" },
      plainText: "text",
      changeType: "MANUAL",
      changeSource: USER,
    });

    expect(mockTxDvCreate).toHaveBeenCalledTimes(2);
    expect(mockTransaction).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ id: "v5", version: 5 });
  });

  test("rethrows a non-P2002 error without retrying", async () => {
    mockTxDvFindFirst.mockResolvedValue({ version: 4, plainText: "" });
    mockTxDvCreate.mockRejectedValue(new Error("db down"));

    await expect(
      createDocumentVersion({
        pageId: PAGE,
        tenantId: TENANT,
        content: { type: "doc" },
        plainText: "text",
        changeType: "MANUAL",
      })
    ).rejects.toThrow("db down");
    expect(mockTxDvCreate).toHaveBeenCalledTimes(1);
  });
});

// ─── Retention pruning ────────────────────────────────────────────────────────

describe("createDocumentVersion — retention", () => {
  test("prunes versions beyond the retention limit inside the transaction", async () => {
    mockTxDvFindFirst.mockResolvedValue({ version: 100, plainText: "" });
    mockTxDvCreate.mockResolvedValue({ id: "v101", version: 101 });
    mockTxDvFindMany.mockResolvedValue([{ id: "old-a" }, { id: "old-b" }]);

    await createDocumentVersion({
      pageId: PAGE,
      tenantId: TENANT,
      content: { type: "doc" },
      plainText: "text",
      changeType: "MANUAL",
    });

    // findMany skips the retained window; deleteMany removes the overflow.
    const findManyArg = mockTxDvFindMany.mock.calls[0][0] as { skip: number };
    expect(findManyArg.skip).toBe(100);
    expect(mockTxDvDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["old-a", "old-b"] } },
    });
  });
});

// ─── Restore write-back ───────────────────────────────────────────────────────

describe("restoreDocumentVersion — write-back", () => {
  test("writes content back to the DOCUMENT block in place and bumps its version", async () => {
    // Target version to restore.
    mockDvFindFirst.mockResolvedValue({
      id: "ver-2",
      version: 2,
      content: { type: "doc", marker: "restored" },
      plainText: "restored text",
      changeType: "MANUAL",
      changeSource: USER,
      createdAt: new Date(),
    });
    // Current DOCUMENT block sits at version 5.
    mockBlockFindFirst.mockResolvedValue({ id: "blk-1", version: 5 });
    mockTxBlockUpdateMany.mockResolvedValue({ count: 1 });
    // Snapshot insert (createDocumentVersion) inside restore.
    mockTxDvFindFirst.mockResolvedValue({ version: 2, plainText: "prev" });
    mockTxDvCreate.mockResolvedValue({
      id: "snap-1",
      version: 3,
      changeType: "MANUAL",
      changeNotes: "Restored from version 2",
      createdAt: new Date(),
    });

    const result = await restoreDocumentVersion(PAGE, TENANT, 2, USER);

    expect(result).not.toBeNull();
    // Token bumped: 5 → 6.
    expect(result?.blockVersion).toBe(6);
    // Version-checked, in-place write on the SAME block row.
    const updateArg = mockTxBlockUpdateMany.mock.calls[0][0] as {
      where: { id: string; version: number };
      data: { version: { increment: number } };
    };
    expect(updateArg.where).toMatchObject({ id: "blk-1", version: 5 });
    expect(updateArg.data.version.increment).toBe(1);
    // Fan-out reproduced.
    expect(mockUpdatePageLinks).toHaveBeenCalledTimes(1);
    expect(mockUpdateSearchIndex).toHaveBeenCalledWith("blk-1", {
      type: "doc",
      marker: "restored",
    });
    // Restore snapshot recorded.
    expect(mockTxDvCreate).toHaveBeenCalledTimes(1);
  });

  test("retries on a mid-restore version conflict, then wins", async () => {
    mockDvFindFirst.mockResolvedValue({
      id: "ver-2",
      version: 2,
      content: { type: "doc" },
      plainText: "restored text",
      createdAt: new Date(),
    });
    // Re-read returns a bumped version after the first conflict.
    mockBlockFindFirst
      .mockResolvedValueOnce({ id: "blk-1", version: 5 })
      .mockResolvedValueOnce({ id: "blk-1", version: 6 });
    mockTxBlockUpdateMany
      .mockResolvedValueOnce({ count: 0 }) // conflict
      .mockResolvedValueOnce({ count: 1 }); // wins
    mockTxDvFindFirst.mockResolvedValue({ version: 2, plainText: "prev" });
    mockTxDvCreate.mockResolvedValue({
      id: "snap-1",
      version: 3,
      changeType: "MANUAL",
      changeNotes: "Restored from version 2",
      createdAt: new Date(),
    });

    const result = await restoreDocumentVersion(PAGE, TENANT, 2, USER);

    expect(mockTxBlockUpdateMany).toHaveBeenCalledTimes(2);
    expect(result?.blockVersion).toBe(7);
  });

  test("returns null when the version does not exist", async () => {
    mockDvFindFirst.mockResolvedValue(null);
    const result = await restoreDocumentVersion(PAGE, TENANT, 99, USER);
    expect(result).toBeNull();
    expect(mockTxBlockUpdateMany).not.toHaveBeenCalled();
  });
});
