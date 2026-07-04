import { describe, it, expect, vi, beforeEach } from "vitest";

const TENANT_ID = "tenant-test-123";
const RESTORED_ID = "restored-page-1";

vi.mock("@/lib/db", () => ({
  prisma: {
    block: {
      findMany: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

import { relinkIncomingWikilinks } from "@/lib/wikilinks/renameUpdater";
import { prisma } from "@/lib/db";

function wikilinkDoc(pageId: string | null, pageName: string) {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "wikilink",
            attrs: { pageId, pageName, displayText: null },
          },
        ],
      },
    ],
  };
}

describe("relinkIncomingWikilinks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("re-points broken (pageId null) wikilinks whose pageName matches the restored title", async () => {
    vi.mocked(prisma.block.findMany).mockResolvedValueOnce([
      { id: "b1", pageId: "src-1", content: wikilinkDoc(null, "My Page") },
      // Non-matching pageName is left alone.
      { id: "b2", pageId: "src-2", content: wikilinkDoc(null, "Other Page") },
      // Already-resolved link to a different page untouched.
      { id: "b3", pageId: "src-3", content: wikilinkDoc("some-id", "My Page") },
    ] as never);

    const result = await relinkIncomingWikilinks(
      RESTORED_ID,
      "My Page",
      TENANT_ID
    );

    expect(result.relinkedBlockCount).toBe(1);
    expect(result.affectedPageIds).toEqual(["src-1"]);

    // Only the matching block was written back, with pageId re-pointed.
    expect(prisma.block.update).toHaveBeenCalledTimes(1);
    const updateArgs = vi.mocked(prisma.block.update).mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: "b1" });
    const written = updateArgs.data.content as ReturnType<typeof wikilinkDoc>;
    expect(written.content[0].content[0].attrs.pageId).toBe(RESTORED_ID);

    // The scan is tenant-scoped.
    expect(vi.mocked(prisma.block.findMany).mock.calls[0][0]!.where).toMatchObject(
      { tenantId: TENANT_ID }
    );
  });

  it("returns empty when nothing matches", async () => {
    vi.mocked(prisma.block.findMany).mockResolvedValueOnce([
      { id: "b1", pageId: "src-1", content: wikilinkDoc(null, "Unrelated") },
    ] as never);

    const result = await relinkIncomingWikilinks(
      RESTORED_ID,
      "My Page",
      TENANT_ID
    );

    expect(result.relinkedBlockCount).toBe(0);
    expect(result.affectedPageIds).toEqual([]);
    expect(prisma.block.update).not.toHaveBeenCalled();
  });
});
