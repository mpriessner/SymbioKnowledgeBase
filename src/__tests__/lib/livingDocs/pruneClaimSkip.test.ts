import { describe, test, expect, vi, beforeEach } from "vitest";

// versioning.ts pulls in side-effect-y deps at import; keep them inert.
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/wikilinks/indexer", () => ({ updatePageLinks: vi.fn() }));
vi.mock("@/lib/search/indexer", () => ({ updateSearchIndex: vi.fn() }));
vi.mock("@/lib/sync/SyncService", () => ({ syncPageToFilesystem: vi.fn() }));

const { pruneOldVersions } = await import("@/lib/livingDocs/versioning");

function makeTx(stale: string[], claimRefs: string[]) {
  return {
    documentVersion: {
      findMany: vi.fn().mockResolvedValue(stale.map((id) => ({ id }))),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    claim: {
      findMany: vi
        .fn()
        .mockResolvedValue(claimRefs.map((documentVersionId) => ({ documentVersionId }))),
    },
  };
}

beforeEach(() => vi.clearAllMocks());

describe("pruneOldVersions — skips claim-referenced versions (W81-A2)", () => {
  test("a version pinned by a Claim is NOT deleted (onDelete:Restrict safety)", async () => {
    const tx = makeTx(["v-old-1", "v-old-2", "v-old-3"], ["v-old-2"]);
    await pruneOldVersions(tx as never, "page-1", "t1");

    expect(tx.documentVersion.deleteMany).toHaveBeenCalledTimes(1);
    const deleted = tx.documentVersion.deleteMany.mock.calls[0][0].where.id.in;
    expect(deleted).toEqual(["v-old-1", "v-old-3"]);
    expect(deleted).not.toContain("v-old-2");
  });

  test("all stale versions pinned → no delete issued", async () => {
    const tx = makeTx(["v-a", "v-b"], ["v-a", "v-b"]);
    await pruneOldVersions(tx as never, "page-1", "t1");
    expect(tx.documentVersion.deleteMany).not.toHaveBeenCalled();
  });

  test("nothing stale → no claim lookup, no delete", async () => {
    const tx = makeTx([], []);
    await pruneOldVersions(tx as never, "page-1", "t1");
    expect(tx.claim.findMany).not.toHaveBeenCalled();
    expect(tx.documentVersion.deleteMany).not.toHaveBeenCalled();
  });
});
