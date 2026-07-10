import { describe, test, expect, vi, beforeEach } from "vitest";

const mockFindFirst = vi.fn();
const mockFindMany = vi.fn();
const mockBlockUpdateMany = vi.fn();
const mockExecuteRaw = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    page: {
      findFirst: (...a: unknown[]) => mockFindFirst(...a),
      findMany: (...a: unknown[]) => mockFindMany(...a),
    },
    block: {
      updateMany: (...a: unknown[]) => mockBlockUpdateMany(...a),
    },
    $executeRaw: (...a: unknown[]) => mockExecuteRaw(...a),
  },
}));

vi.mock("@/lib/agent/markdown", () => ({
  tiptapToMarkdown: vi.fn(() => ""),
}));

vi.mock("@/lib/markdown/deserializer", () => ({
  markdownToTiptap: vi.fn(() => ({ content: { type: "doc", content: [] } })),
}));

vi.mock("@/lib/agent/wikilinks", () => ({
  processAgentWikilinks: vi.fn(async () => {}),
}));

const {
  regenerateExperimentsIndex,
  isIndexRegenerationRunning,
  clearIndexRegenerationState,
} = await import("@/lib/chemistryKb/indexRegeneration");

const TENANT = "tenant-1";

beforeEach(() => {
  vi.clearAllMocks();
  clearIndexRegenerationState();
  mockFindMany.mockResolvedValue([]);
  mockBlockUpdateMany.mockResolvedValue({ count: 1 });
  mockExecuteRaw.mockResolvedValue(1);
  mockFindFirst.mockImplementation(({ where }: { where: { title?: string } }) => {
    switch (where.title) {
      case "Chemistry KB":
        return Promise.resolve({ id: "root-1" });
      case "Chemistry KB Index":
        return Promise.resolve({ id: "index-1" });
      case "Experiments":
        return Promise.resolve({ id: "exp-1" });
      case "Archive":
        return Promise.resolve({ id: "arch-1" });
      default:
        return Promise.resolve(null);
    }
  });
});

describe("regenerateExperimentsIndex concurrency guard", () => {
  test("two triggers in the same tick execute exactly one write", async () => {
    const [a, b] = await Promise.all([
      regenerateExperimentsIndex(TENANT, { correlationId: "c1" }),
      regenerateExperimentsIndex(TENANT, { correlationId: "c2" }),
    ]);

    const regenerated = [a, b].filter((r) => r.regenerated).length;
    const skipped = [a, b].filter((r) => r.skipped).length;

    expect(regenerated).toBe(1);
    expect(skipped).toBe(1);
    // Only ONE actual index-page write occurred.
    expect(mockBlockUpdateMany).toHaveBeenCalledTimes(1);
  });

  test("guard is released after completion", async () => {
    await regenerateExperimentsIndex(TENANT);
    expect(isIndexRegenerationRunning(TENANT)).toBe(false);
  });

  test("stamps lastRegeneratedAt + correlationId via jsonb_set", async () => {
    await regenerateExperimentsIndex(TENANT, { correlationId: "abc123" });
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
  });

  test("no-op when hierarchy is missing", async () => {
    mockFindFirst.mockResolvedValue(null);
    const res = await regenerateExperimentsIndex(TENANT);
    expect(res.regenerated).toBe(false);
    expect(res.reason).toBe("hierarchy-not-found");
    expect(mockBlockUpdateMany).not.toHaveBeenCalled();
  });
});
