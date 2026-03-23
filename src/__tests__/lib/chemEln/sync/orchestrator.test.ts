import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  BatchOrchestrator,
  formatIngestionReport,
  type IngestionData,
} from "@/lib/chemEln/sync/orchestrator";
import type { UpsertResult } from "@/lib/chemEln/sync/types";
import type {
  ChemicalData,
  ExperimentData,
  ReactionTypeAggregation,
  ResearcherProfileData,
  SubstrateClassAggregation,
} from "@/lib/chemEln/types";

function makeChemical(overrides: Partial<ChemicalData> = {}): ChemicalData {
  return {
    id: "chem-1",
    name: "Acetone",
    casNumber: "67-64-1",
    molecularFormula: "C3H6O",
    ...overrides,
  };
}

function makeReactionType(
  overrides: Partial<ReactionTypeAggregation> = {}
): ReactionTypeAggregation {
  return {
    name: "Suzuki Coupling",
    experimentCount: 5,
    avgYield: 78.5,
    researcherCount: 2,
    experiments: [],
    keyLearnings: [],
    commonPitfalls: [],
    topResearchers: [],
    ...overrides,
  };
}

function makeResearcher(
  overrides: Partial<ResearcherProfileData> = {}
): ResearcherProfileData {
  return {
    name: "Jane Doe",
    totalExperiments: 10,
    topReactionTypes: [],
    recentExperiments: [],
    keyContributions: [],
    ...overrides,
  };
}

function makeSubstrateClass(
  overrides: Partial<SubstrateClassAggregation> = {}
): SubstrateClassAggregation {
  return {
    name: "Aryl Halides",
    challenges: [],
    whatWorked: [],
    researchers: [],
    ...overrides,
  };
}

function makeExperiment(
  overrides: Partial<ExperimentData> = {}
): ExperimentData {
  return {
    id: "EXP-2026-0001",
    title: "Test Experiment",
    experimentType: "Suzuki Coupling",
    status: "completed",
    createdBy: "user-1",
    createdAt: "2026-01-15T10:00:00Z",
    actualProcedure: null,
    procedureMetadata: null,
    reagents: [],
    products: [],
    ...overrides,
  };
}

function createMockWriter() {
  return {
    searchPages: vi.fn().mockResolvedValue([]),
    getPage: vi.fn().mockResolvedValue(null),
    createPage: vi.fn().mockResolvedValue({ id: "p1", title: "Test" }),
    updatePage: vi.fn().mockResolvedValue({ id: "p1", title: "Test" }),
    upsertPage: vi
      .fn()
      .mockResolvedValue({
        action: "created",
        pageId: "p1",
        title: "Test",
        contentHash: "abc123",
      } satisfies UpsertResult),
    computeHash: vi.fn().mockReturnValue("hash-abc"),
    healthCheck: vi.fn(),
  };
}

function createMockResolver() {
  return {
    resolveResearcher: vi.fn().mockReturnValue("Jane Doe"),
    getChemicalUsages: vi.fn().mockReturnValue([]),
    resolveWikilink: vi.fn().mockReturnValue(null),
    findUnresolvedLinks: vi.fn().mockReturnValue([]),
    buildLookupMap: vi.fn(),
    createStubPage: vi.fn().mockReturnValue("# Stub"),
    setResearcherMapping: vi.fn(),
    trackUsage: vi.fn(),
    registerUsage: vi.fn(),
    getUsages: vi.fn().mockReturnValue([]),
    getUnresolvedCount: vi.fn().mockReturnValue(0),
    getAllStubs: vi.fn().mockReturnValue([]),
  };
}

describe("BatchOrchestrator", () => {
  let mockWriter: ReturnType<typeof createMockWriter>;
  let mockResolver: ReturnType<typeof createMockResolver>;

  beforeEach(() => {
    mockWriter = createMockWriter();
    mockResolver = createMockResolver();
    vi.restoreAllMocks();
  });

  describe("three-pass ordering", () => {
    it("should execute passes in order: entities, experiments, aggregation", async () => {
      const passOrder: string[] = [];
      const orchestrator = new BatchOrchestrator(
        mockWriter as any,
        mockResolver as any,
        {
          onProgress: (_cur, _tot, passName) => {
            if (!passOrder.includes(passName)) passOrder.push(passName);
          },
        }
      );

      const data: IngestionData = {
        chemicals: [makeChemical()],
        reactionTypes: [makeReactionType()],
        researchers: [makeResearcher()],
        substrateClasses: [makeSubstrateClass()],
        experiments: [makeExperiment()],
      };

      await orchestrator.run(data);

      expect(passOrder).toEqual([
        "Pass 1: Entities",
        "Pass 2: Experiments",
        "Pass 3: Aggregation",
      ]);
    });

    it("should call upsertPage for entities before experiments", async () => {
      const callLog: string[] = [];
      mockWriter.upsertPage.mockImplementation(
        async (_md: string, tag: string) => {
          callLog.push(tag);
          return {
            action: "created" as const,
            pageId: "p1",
            title: "T",
            contentHash: "h",
          };
        }
      );

      const orchestrator = new BatchOrchestrator(
        mockWriter as any,
        mockResolver as any
      );

      await orchestrator.run({
        chemicals: [makeChemical({ casNumber: "67-64-1" })],
        reactionTypes: [],
        researchers: [],
        substrateClasses: [],
        experiments: [makeExperiment({ id: "EXP-001" })],
      });

      const chemIdx = callLog.indexOf("cas:67-64-1");
      const expIdx = callLog.indexOf("eln:EXP-001");
      expect(chemIdx).toBeLessThan(expIdx);
    });

    it("should return three PassResult entries in the report", async () => {
      const orchestrator = new BatchOrchestrator(
        mockWriter as any,
        mockResolver as any
      );

      const report = await orchestrator.run({
        chemicals: [],
        reactionTypes: [],
        researchers: [],
        substrateClasses: [],
        experiments: [],
      });

      expect(report.passes).toHaveLength(3);
      expect(report.passes[0].passName).toBe("Pass 1: Entities");
      expect(report.passes[1].passName).toBe("Pass 2: Experiments");
      expect(report.passes[2].passName).toBe("Pass 3: Aggregation");
    });
  });

  describe("upsert logic", () => {
    it("should count created pages", async () => {
      mockWriter.upsertPage.mockResolvedValue({
        action: "created",
        pageId: "p1",
        title: "Acetone",
        contentHash: "abc",
      });

      const orchestrator = new BatchOrchestrator(
        mockWriter as any,
        mockResolver as any
      );

      const report = await orchestrator.run({
        chemicals: [makeChemical()],
        reactionTypes: [],
        researchers: [],
        substrateClasses: [],
        experiments: [],
      });

      // Pass 1 creates entity, Pass 3 re-processes the same chemical
      expect(report.totalCreated).toBe(2);
    });

    it("should count updated pages", async () => {
      mockWriter.upsertPage.mockResolvedValue({
        action: "updated",
        pageId: "p1",
        title: "Acetone",
        contentHash: "def",
      });

      const orchestrator = new BatchOrchestrator(
        mockWriter as any,
        mockResolver as any
      );

      const report = await orchestrator.run({
        chemicals: [makeChemical()],
        reactionTypes: [],
        researchers: [],
        substrateClasses: [],
        experiments: [],
      });

      expect(report.totalUpdated).toBe(2);
    });

    it("should count skipped pages", async () => {
      mockWriter.upsertPage.mockResolvedValue({
        action: "skipped",
        pageId: "p1",
        title: "Acetone",
        contentHash: "same",
      });

      const orchestrator = new BatchOrchestrator(
        mockWriter as any,
        mockResolver as any
      );

      const report = await orchestrator.run({
        chemicals: [makeChemical()],
        reactionTypes: [],
        researchers: [],
        substrateClasses: [],
        experiments: [],
      });

      expect(report.totalSkipped).toBe(2);
    });

    it("should pass the correct match tag for each entity type", async () => {
      const tags: string[] = [];
      mockWriter.upsertPage.mockImplementation(
        async (_md: string, tag: string) => {
          tags.push(tag);
          return {
            action: "created" as const,
            pageId: "p1",
            title: "T",
            contentHash: "h",
          };
        }
      );

      const orchestrator = new BatchOrchestrator(
        mockWriter as any,
        mockResolver as any
      );

      await orchestrator.run({
        chemicals: [makeChemical({ casNumber: "123-45-6" })],
        reactionTypes: [makeReactionType({ name: "Grignard Reaction" })],
        researchers: [makeResearcher({ name: "Alice Smith" })],
        substrateClasses: [makeSubstrateClass({ name: "Vinyl Boronic Acids" })],
        experiments: [],
      });

      expect(tags).toContain("cas:123-45-6");
      expect(tags).toContain("reaction:grignard-reaction");
      expect(tags).toContain("researcher:alice-smith");
      expect(tags).toContain("substrate-class:vinyl-boronic-acids");
    });
  });

  describe("error isolation", () => {
    it("should continue processing after a page fails", async () => {
      let callCount = 0;
      mockWriter.upsertPage.mockImplementation(async () => {
        callCount++;
        if (callCount === 2) throw new Error("API timeout");
        return {
          action: "created" as const,
          pageId: `p${callCount}`,
          title: "T",
          contentHash: "h",
        };
      });

      const orchestrator = new BatchOrchestrator(
        mockWriter as any,
        mockResolver as any
      );

      const report = await orchestrator.run({
        chemicals: [
          makeChemical({ id: "c1", casNumber: "1" }),
          makeChemical({ id: "c2", casNumber: "2" }),
          makeChemical({ id: "c3", casNumber: "3" }),
        ],
        reactionTypes: [],
        researchers: [],
        substrateClasses: [],
        experiments: [],
      });

      expect(report.totalFailed).toBeGreaterThan(0);
      // All 3 chemicals processed in pass 1 + 3 in pass 3 = 6 total calls
      expect(report.totalCreated + report.totalFailed).toBeGreaterThanOrEqual(3);
    });

    it("should record error details in the report", async () => {
      mockWriter.upsertPage.mockRejectedValueOnce(
        new Error("Connection refused")
      );
      mockWriter.upsertPage.mockResolvedValue({
        action: "created",
        pageId: "p2",
        title: "T",
        contentHash: "h",
      });

      const orchestrator = new BatchOrchestrator(
        mockWriter as any,
        mockResolver as any
      );

      const report = await orchestrator.run({
        chemicals: [makeChemical({ id: "c1", casNumber: "1" })],
        reactionTypes: [],
        researchers: [],
        substrateClasses: [],
        experiments: [],
      });

      const allErrors = report.passes.flatMap((p) => p.errors);
      expect(allErrors).toHaveLength(1);
      expect(allErrors[0].id).toBe("cas:1");
      expect(allErrors[0].error).toBe("Connection refused");
    });

    it("should not throw even if all pages fail", async () => {
      mockWriter.upsertPage.mockRejectedValue(new Error("Total failure"));

      const orchestrator = new BatchOrchestrator(
        mockWriter as any,
        mockResolver as any
      );

      const report = await orchestrator.run({
        chemicals: [makeChemical()],
        reactionTypes: [],
        researchers: [],
        substrateClasses: [],
        experiments: [makeExperiment()],
      });

      expect(report.totalFailed).toBeGreaterThan(0);
      expect(report.totalCreated).toBe(0);
    });
  });

  describe("progress tracking", () => {
    it("should invoke onProgress for each page in each pass", async () => {
      const progressCalls: Array<{
        current: number;
        total: number;
        passName: string;
        pageName: string;
      }> = [];

      const orchestrator = new BatchOrchestrator(
        mockWriter as any,
        mockResolver as any,
        {
          onProgress: (current, total, passName, pageName) =>
            progressCalls.push({ current, total, passName, pageName }),
        }
      );

      await orchestrator.run({
        chemicals: [
          makeChemical({ id: "c1", casNumber: "1" }),
          makeChemical({ id: "c2", casNumber: "2" }),
        ],
        reactionTypes: [],
        researchers: [],
        substrateClasses: [],
        experiments: [],
      });

      // Pass 1: 2 chemicals, Pass 2: 0 experiments, Pass 3: 2 chemicals = 4 calls
      expect(progressCalls).toHaveLength(4);

      // Check pass 1 progress
      const pass1Calls = progressCalls.filter(
        (c) => c.passName === "Pass 1: Entities"
      );
      expect(pass1Calls).toHaveLength(2);
      expect(pass1Calls[0].current).toBe(1);
      expect(pass1Calls[0].total).toBe(2);
      expect(pass1Calls[1].current).toBe(2);
      expect(pass1Calls[1].total).toBe(2);
    });

    it("should report duration in milliseconds", async () => {
      const orchestrator = new BatchOrchestrator(
        mockWriter as any,
        mockResolver as any
      );

      const report = await orchestrator.run({
        chemicals: [makeChemical()],
        reactionTypes: [],
        researchers: [],
        substrateClasses: [],
        experiments: [],
      });

      expect(report.totalDuration).toBeGreaterThanOrEqual(0);
      for (const pass of report.passes) {
        expect(pass.duration).toBeGreaterThanOrEqual(0);
      }
    });

    it("should calculate pages per minute", async () => {
      const orchestrator = new BatchOrchestrator(
        mockWriter as any,
        mockResolver as any
      );

      const report = await orchestrator.run({
        chemicals: [makeChemical()],
        reactionTypes: [],
        researchers: [],
        substrateClasses: [],
        experiments: [],
      });

      expect(report.pagesPerMinute).toBeGreaterThanOrEqual(0);
      expect(typeof report.pagesPerMinute).toBe("number");
      expect(Number.isFinite(report.pagesPerMinute)).toBe(true);
    });
  });

  describe("dry-run mode", () => {
    it("should not call upsertPage when dryRun is true", async () => {
      const orchestrator = new BatchOrchestrator(
        mockWriter as any,
        mockResolver as any,
        { dryRun: true }
      );

      await orchestrator.run({
        chemicals: [makeChemical()],
        reactionTypes: [],
        researchers: [],
        substrateClasses: [],
        experiments: [],
      });

      expect(mockWriter.upsertPage).not.toHaveBeenCalled();
    });

    it("should report what would be created in dry-run mode", async () => {
      mockWriter.searchPages.mockResolvedValue([]);

      const orchestrator = new BatchOrchestrator(
        mockWriter as any,
        mockResolver as any,
        { dryRun: true }
      );

      const report = await orchestrator.run({
        chemicals: [makeChemical()],
        reactionTypes: [],
        researchers: [],
        substrateClasses: [],
        experiments: [],
      });

      // No existing pages found, so these would be "created"
      expect(report.totalCreated).toBe(2); // pass 1 + pass 3
      expect(report.totalUpdated).toBe(0);
    });

    it("should report what would be updated in dry-run when page exists with different hash", async () => {
      mockWriter.searchPages.mockResolvedValue([
        { id: "existing-1", title: "Acetone" },
      ]);
      mockWriter.getPage.mockResolvedValue({
        id: "existing-1",
        title: "Acetone",
        markdown: "old content",
      });
      mockWriter.computeHash
        .mockReturnValueOnce("new-hash")
        .mockReturnValueOnce("old-hash")
        .mockReturnValueOnce("new-hash-2")
        .mockReturnValueOnce("old-hash-2");

      const orchestrator = new BatchOrchestrator(
        mockWriter as any,
        mockResolver as any,
        { dryRun: true }
      );

      const report = await orchestrator.run({
        chemicals: [makeChemical()],
        reactionTypes: [],
        researchers: [],
        substrateClasses: [],
        experiments: [],
      });

      expect(report.totalUpdated).toBe(2);
    });

    it("should report skipped in dry-run when page exists with same hash", async () => {
      mockWriter.searchPages.mockResolvedValue([
        { id: "existing-1", title: "Acetone" },
      ]);
      mockWriter.getPage.mockResolvedValue({
        id: "existing-1",
        title: "Acetone",
        markdown: "same content",
      });
      mockWriter.computeHash.mockReturnValue("same-hash");

      const orchestrator = new BatchOrchestrator(
        mockWriter as any,
        mockResolver as any,
        { dryRun: true }
      );

      const report = await orchestrator.run({
        chemicals: [makeChemical()],
        reactionTypes: [],
        researchers: [],
        substrateClasses: [],
        experiments: [],
      });

      expect(report.totalSkipped).toBe(2);
    });
  });

  describe("realistic data", () => {
    it("should handle a full dataset with all entity types", async () => {
      const orchestrator = new BatchOrchestrator(
        mockWriter as any,
        mockResolver as any
      );

      const data: IngestionData = {
        chemicals: [
          makeChemical({ id: "c1", name: "Acetone", casNumber: "67-64-1" }),
          makeChemical({ id: "c2", name: "Toluene", casNumber: "108-88-3" }),
        ],
        reactionTypes: [
          makeReactionType({ name: "Suzuki Coupling" }),
          makeReactionType({ name: "Grignard Reaction" }),
        ],
        researchers: [
          makeResearcher({ name: "Jane Doe" }),
          makeResearcher({ name: "John Smith" }),
        ],
        substrateClasses: [makeSubstrateClass({ name: "Aryl Halides" })],
        experiments: [
          makeExperiment({ id: "EXP-001" }),
          makeExperiment({ id: "EXP-002" }),
          makeExperiment({ id: "EXP-003" }),
        ],
      };

      const report = await orchestrator.run(data);

      // Pass 1: 2 chemicals + 2 reaction types + 2 researchers + 1 substrate = 7
      // Pass 2: 3 experiments
      // Pass 3: 2 chemicals (aggregation)
      // Total = 12
      expect(report.totalCreated).toBe(12);
      expect(report.totalFailed).toBe(0);
      expect(report.passes).toHaveLength(3);
    });

    it("should resolve researcher names via the resolver for experiments", async () => {
      mockResolver.resolveResearcher.mockReturnValue("Dr. Alice");

      const orchestrator = new BatchOrchestrator(
        mockWriter as any,
        mockResolver as any
      );

      await orchestrator.run({
        chemicals: [],
        reactionTypes: [],
        researchers: [],
        substrateClasses: [],
        experiments: [makeExperiment({ createdBy: "user-alice" })],
      });

      expect(mockResolver.resolveResearcher).toHaveBeenCalledWith(
        "user-alice"
      );
    });

    it("should fetch chemical usages from resolver in pass 3", async () => {
      mockResolver.getChemicalUsages.mockReturnValue([
        {
          experimentId: "EXP-001",
          experimentTitle: "Test",
          role: "reagent",
          amount: 10,
          unit: "mL",
        },
      ]);

      const orchestrator = new BatchOrchestrator(
        mockWriter as any,
        mockResolver as any
      );

      await orchestrator.run({
        chemicals: [makeChemical({ id: "chem-1" })],
        reactionTypes: [],
        researchers: [],
        substrateClasses: [],
        experiments: [],
      });

      expect(mockResolver.getChemicalUsages).toHaveBeenCalledWith("chem-1");
    });
  });

  describe("parentIds configuration", () => {
    it("should pass parentId to upsertPage for chemicals", async () => {
      const orchestrator = new BatchOrchestrator(
        mockWriter as any,
        mockResolver as any,
        { parentIds: { chemicals: "parent-chem-page" } }
      );

      await orchestrator.run({
        chemicals: [makeChemical()],
        reactionTypes: [],
        researchers: [],
        substrateClasses: [],
        experiments: [],
      });

      expect(mockWriter.upsertPage).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ parentId: "parent-chem-page" })
      );
    });
  });

  describe("formatIngestionReport", () => {
    it("should produce a human-readable summary", () => {
      const report = {
        passes: [
          {
            passName: "Pass 1: Entities",
            created: 5,
            updated: 2,
            skipped: 1,
            failed: 0,
            errors: [],
            duration: 1200,
          },
          {
            passName: "Pass 2: Experiments",
            created: 10,
            updated: 0,
            skipped: 0,
            failed: 1,
            errors: [{ id: "eln:EXP-999", error: "Invalid data" }],
            duration: 3500,
          },
          {
            passName: "Pass 3: Aggregation",
            created: 0,
            updated: 5,
            skipped: 1,
            failed: 0,
            errors: [],
            duration: 800,
          },
        ],
        totalCreated: 15,
        totalUpdated: 7,
        totalSkipped: 2,
        totalFailed: 1,
        totalDuration: 5500,
        pagesPerMinute: 261,
      };

      const output = formatIngestionReport(report);

      expect(output).toContain("ChemELN -> SKB Ingestion Report");
      expect(output).toContain("Pass 1: Entities");
      expect(output).toContain("Pass 2: Experiments");
      expect(output).toContain("Pass 3: Aggregation");
      expect(output).toContain("Total Created:  15");
      expect(output).toContain("Total Failed:   1");
      expect(output).toContain("eln:EXP-999: Invalid data");
    });
  });
});
