import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mockSetupHierarchy = vi.fn();
const mockFindActiveExperiment = vi.fn();
const mockFindArchivedExperiment = vi.fn();
const mockFindExperimentByElnId = vi.fn();
const mockRegenerateExperimentsIndex = vi.fn();

vi.mock("@/lib/chemistryKb/setupHierarchy", () => ({
  setupChemistryKbHierarchy: (...args: unknown[]) => mockSetupHierarchy(...args),
}));

vi.mock("@/lib/chemistryKb/experimentLookup", () => ({
  findExperimentByElnId: (...args: unknown[]) => mockFindExperimentByElnId(...args),
  findActiveExperiment: (...args: unknown[]) => mockFindActiveExperiment(...args),
  findArchivedExperiment: (...args: unknown[]) => mockFindArchivedExperiment(...args),
}));

vi.mock("@/lib/chemistryKb/indexRegeneration", () => ({
  regenerateExperimentsIndex: (...args: unknown[]) =>
    mockRegenerateExperimentsIndex(...args),
}));

vi.mock("@/lib/markdown/deserializer", () => ({
  markdownToTiptap: vi.fn(() => ({ content: { type: "doc", content: [] } })),
}));

vi.mock("@/lib/agent/wikilinks", () => ({
  processAgentWikilinks: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    page: { aggregate: vi.fn().mockResolvedValue({ _max: { position: null } }) },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) =>
      fn({
        page: { create: vi.fn().mockResolvedValue({ id: "new-page-id" }) },
        block: { create: vi.fn().mockResolvedValue({ id: "new-block-id" }) },
      })
    ),
  },
}));

const { runReconciliation } = await import(
  "@/lib/chemistryKb/reconciliationSync"
);

const TENANT_ID = "tenant-recon";
const HIERARCHY = {
  rootId: "root-id",
  indexId: "index-id",
  experimentsId: "experiments-id",
  archiveId: "archive-id",
  reactionTypesId: "rt-id",
  chemicalsId: "chem-id",
  researchersId: "researcher-id",
  substrateClassesId: "substrate-id",
};

const originalFetch = global.fetch;

beforeEach(() => {
  vi.clearAllMocks();
  mockSetupHierarchy.mockResolvedValue(HIERARCHY);
  mockFindActiveExperiment.mockResolvedValue(null);
  mockFindArchivedExperiment.mockResolvedValue(null);
  mockRegenerateExperimentsIndex.mockResolvedValue({
    regenerated: true,
    skipped: false,
  });
  process.env.EXPTUBE_API_URL = "http://exptube.test";
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: [] }),
  }) as unknown as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe("runReconciliation index regeneration", () => {
  test("regenerates once with explicit tenant and correlation id", async () => {
    const result = await runReconciliation(TENANT_ID);

    expect(result.status).toBe("completed");
    expect(mockRegenerateExperimentsIndex).toHaveBeenCalledTimes(1);
    expect(mockRegenerateExperimentsIndex).toHaveBeenCalledWith(TENANT_ID, {
      correlationId: result.syncId,
    });
  });

  test("does not regenerate during a dry run", async () => {
    await runReconciliation(TENANT_ID, { dryRun: true });
    expect(mockRegenerateExperimentsIndex).not.toHaveBeenCalled();
  });

  test("treats regeneration failure as non-fatal", async () => {
    mockRegenerateExperimentsIndex.mockRejectedValueOnce(new Error("boom"));
    const result = await runReconciliation(TENANT_ID);
    expect(result.status).toBe("completed");
  });
});
