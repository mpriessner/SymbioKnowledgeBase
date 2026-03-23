import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  AggregationRefresher,
  deduplicateAffectedEntities,
} from "@/lib/chemEln/sync/aggregationRefresher";
import type { RefreshResult } from "@/lib/chemEln/sync/aggregationRefresher";
import type { AffectedEntities } from "@/lib/chemEln/sync/updatePropagator";
import { CrossReferenceResolver } from "@/lib/chemEln/sync/resolver";
import type { ExperimentData } from "@/lib/chemEln/types";
import type { ExpertiseProfile } from "@/lib/chemEln/enrichment/types";

function createMockWriter() {
  return {
    upsertPage: vi.fn().mockResolvedValue({
      action: "updated" as const,
      pageId: "page-123",
      title: "Test Page",
      contentHash: "abc123",
    }),
    updatePage: vi.fn().mockResolvedValue({
      id: "page-123",
      title: "Test Page",
      updatedAt: "2026-03-21T12:00:00.000Z",
    }),
    searchPages: vi.fn().mockResolvedValue([]),
    getPage: vi.fn().mockResolvedValue(null),
    createPage: vi.fn().mockResolvedValue({
      id: "page-123",
      title: "Test Page",
      createdAt: "2026-03-21T12:00:00.000Z",
    }),
    computeHash: vi.fn().mockReturnValue("hash-new"),
  };
}

function makeExperiment(
  overrides: Partial<ExperimentData> = {},
): ExperimentData {
  return {
    id: "EXP-001",
    title: "Test Experiment",
    experimentType: "Suzuki-Coupling",
    status: "completed",
    createdBy: "user-1",
    createdAt: "2026-03-21T10:00:00.000Z",
    actualProcedure: null,
    procedureMetadata: null,
    reagents: [
      {
        id: "r1",
        chemical: {
          id: "chem-1",
          name: "Pd(PPh3)4",
          casNumber: "14221-01-3",
          molecularFormula: null,
        },
        role: "catalyst",
        amount: 0.5,
        unit: "mmol",
      },
    ],
    products: [
      {
        id: "p1",
        chemical: {
          id: "chem-2",
          name: "Biphenyl",
          casNumber: "92-52-4",
          molecularFormula: null,
        },
        yield: 85,
        unit: "mg",
      },
    ],
    ...overrides,
  };
}

function makeExpertiseProfile(
  overrides: Partial<ExpertiseProfile> = {},
): ExpertiseProfile {
  return {
    researcherId: "user-1",
    researcherName: "Dr. Mueller",
    totalExperiments: 5,
    primaryExpertise: [
      {
        reactionType: "Suzuki-Coupling",
        experimentCount: 3,
        avgQualityScore: 4.0,
        avgYield: 82,
        highQualityCount: 2,
        firstExperimentDate: new Date("2025-01-01"),
        lastExperimentDate: new Date("2026-03-01"),
        weightedExpertiseScore: 12.0,
      },
    ],
    allExpertise: [
      {
        reactionType: "Suzuki-Coupling",
        experimentCount: 3,
        avgQualityScore: 4.0,
        avgYield: 82,
        highQualityCount: 2,
        firstExperimentDate: new Date("2025-01-01"),
        lastExperimentDate: new Date("2026-03-01"),
        weightedExpertiseScore: 12.0,
      },
    ],
    contributionScore: 80,
    activityStatus: "active",
    topContributions: [
      {
        title: "Optimized Suzuki conditions",
        experimentId: "EXP-001",
        experimentTitle: "Test Experiment",
        date: new Date("2026-03-01"),
        qualityScore: 4.5,
        reactionType: "Suzuki-Coupling",
      },
    ],
    ...overrides,
  };
}

describe("AggregationRefresher", () => {
  let mockWriter: ReturnType<typeof createMockWriter>;
  let resolver: CrossReferenceResolver;
  let refresher: AggregationRefresher;

  beforeEach(() => {
    mockWriter = createMockWriter();
    resolver = new CrossReferenceResolver();
    resolver.setResearcherMapping("user-1", "Dr. Mueller");
    resolver.setResearcherMapping("user-2", "Dr. Schmidt");
    refresher = new AggregationRefresher(
      mockWriter as any,
      resolver,
    );
  });

  describe("chemical page refresh", () => {
    it("should refresh chemical page with updated usages", async () => {
      const experiments = [
        makeExperiment({ id: "EXP-001", title: "Experiment 1" }),
        makeExperiment({
          id: "EXP-002",
          title: "Experiment 2",
          reagents: [
            {
              id: "r2",
              chemical: {
                id: "chem-1",
                name: "Pd(PPh3)4",
                casNumber: "14221-01-3",
                molecularFormula: null,
              },
              role: "catalyst",
              amount: 1.0,
              unit: "mmol",
            },
          ],
          products: [
            {
              id: "p2",
              chemical: {
                id: "chem-3",
                name: "Stilbene",
                casNumber: "588-59-0",
                molecularFormula: null,
              },
              yield: 72,
              unit: "mg",
            },
          ],
        }),
      ];

      const affected: AffectedEntities = {
        chemicals: ["14221-01-3"],
        reactionTypes: [],
        researchers: [],
      };

      const result = await refresher.refreshAffectedEntities(
        affected,
        experiments,
        [],
      );

      expect(result.refreshed.chemicals).toContain("14221-01-3");
      expect(mockWriter.upsertPage).toHaveBeenCalledTimes(1);
      const callArgs = mockWriter.upsertPage.mock.calls[0];
      expect(callArgs[0]).toContain("Pd(PPh3)4");
      expect(callArgs[1]).toBe("cas:14221-01-3");
    });

    it("should skip chemical refresh when content unchanged", async () => {
      mockWriter.upsertPage.mockResolvedValue({
        action: "skipped",
        pageId: "page-123",
        title: "Test",
        contentHash: "same",
      });

      const affected: AffectedEntities = {
        chemicals: ["14221-01-3"],
        reactionTypes: [],
        researchers: [],
      };

      const result = await refresher.refreshAffectedEntities(
        affected,
        [makeExperiment()],
        [],
      );

      expect(result.skipped).toContain("chemical:14221-01-3");
      expect(result.refreshed.chemicals).toHaveLength(0);
    });
  });

  describe("reaction type page refresh", () => {
    it("should refresh reaction type page with new key learnings", async () => {
      const experiments = [
        makeExperiment({
          id: "EXP-001",
          title: "Suzuki Experiment 1",
          products: [
            {
              id: "p1",
              chemical: {
                id: "chem-2",
                name: "Biphenyl",
                casNumber: "92-52-4",
                molecularFormula: null,
              },
              yield: 80,
              unit: "mg",
            },
          ],
        }),
        makeExperiment({
          id: "EXP-002",
          title: "Suzuki Experiment 2",
          createdBy: "user-2",
          products: [
            {
              id: "p2",
              chemical: {
                id: "chem-2",
                name: "Biphenyl",
                casNumber: "92-52-4",
                molecularFormula: null,
              },
              yield: 90,
              unit: "mg",
            },
          ],
        }),
        makeExperiment({
          id: "EXP-003",
          title: "Grignard Experiment",
          experimentType: "Grignard",
          products: [
            {
              id: "p3",
              chemical: {
                id: "chem-4",
                name: "Alcohol",
                casNumber: null,
                molecularFormula: null,
              },
              yield: 60,
              unit: "mg",
            },
          ],
        }),
      ];

      const profiles = [makeExpertiseProfile()];

      const affected: AffectedEntities = {
        chemicals: [],
        reactionTypes: ["Suzuki-Coupling"],
        researchers: [],
      };

      const result = await refresher.refreshAffectedEntities(
        affected,
        experiments,
        profiles,
      );

      expect(result.refreshed.reactionTypes).toContain("Suzuki-Coupling");
      const callArgs = mockWriter.upsertPage.mock.calls[0];
      expect(callArgs[0]).toContain("Suzuki-Coupling");
      expect(callArgs[0]).toContain("2 experiments");
      expect(callArgs[1]).toBe("reaction:suzuki-coupling");
    });

    it("should compute correct avg yield for reaction type", async () => {
      const experiments = [
        makeExperiment({
          id: "EXP-001",
          products: [
            {
              id: "p1",
              chemical: {
                id: "c1",
                name: "Product",
                casNumber: null,
                molecularFormula: null,
              },
              yield: 80,
              unit: "mg",
            },
          ],
        }),
        makeExperiment({
          id: "EXP-002",
          products: [
            {
              id: "p2",
              chemical: {
                id: "c2",
                name: "Product",
                casNumber: null,
                molecularFormula: null,
              },
              yield: 90,
              unit: "mg",
            },
          ],
        }),
      ];

      const affected: AffectedEntities = {
        chemicals: [],
        reactionTypes: ["Suzuki-Coupling"],
        researchers: [],
      };

      await refresher.refreshAffectedEntities(affected, experiments, []);

      const markdown = mockWriter.upsertPage.mock.calls[0][0] as string;
      expect(markdown).toContain("85.0%");
    });
  });

  describe("researcher page refresh", () => {
    it("should refresh researcher page with updated expertise", async () => {
      const experiments = [
        makeExperiment({
          id: "EXP-001",
          title: "Suzuki 1",
          createdBy: "user-1",
        }),
        makeExperiment({
          id: "EXP-002",
          title: "Suzuki 2",
          createdBy: "user-1",
          createdAt: "2026-03-20T10:00:00.000Z",
        }),
        makeExperiment({
          id: "EXP-003",
          title: "Other Researcher Exp",
          createdBy: "user-2",
        }),
      ];

      const profiles = [makeExpertiseProfile()];

      const affected: AffectedEntities = {
        chemicals: [],
        reactionTypes: [],
        researchers: ["user-1"],
      };

      const result = await refresher.refreshAffectedEntities(
        affected,
        experiments,
        profiles,
      );

      expect(result.refreshed.researchers).toContain("user-1");
      const callArgs = mockWriter.upsertPage.mock.calls[0];
      expect(callArgs[0]).toContain("Dr. Mueller");
      expect(callArgs[0]).toContain("2 experiments");
      expect(callArgs[1]).toBe("researcher:dr.-mueller");
    });

    it("should include key contributions from existing profile", async () => {
      const experiments = [
        makeExperiment({ createdBy: "user-1" }),
      ];
      const profiles = [
        makeExpertiseProfile({
          topContributions: [
            {
              title: "Novel Suzuki optimization",
              experimentId: "EXP-001",
              experimentTitle: "Test Experiment",
              date: new Date("2026-03-01"),
              qualityScore: 5,
              reactionType: "Suzuki-Coupling",
            },
          ],
        }),
      ];

      const affected: AffectedEntities = {
        chemicals: [],
        reactionTypes: [],
        researchers: ["user-1"],
      };

      await refresher.refreshAffectedEntities(affected, experiments, profiles);

      const markdown = mockWriter.upsertPage.mock.calls[0][0] as string;
      expect(markdown).toContain("Novel Suzuki optimization");
    });
  });

  describe("deduplication", () => {
    it("should deduplicate affected entities", () => {
      const affected: AffectedEntities = {
        chemicals: ["14221-01-3", "92-52-4", "14221-01-3"],
        reactionTypes: ["Suzuki-Coupling", "Suzuki-Coupling"],
        researchers: ["user-1", "user-2", "user-1"],
      };

      const result = deduplicateAffectedEntities(affected);

      expect(result.chemicals).toEqual(["14221-01-3", "92-52-4"]);
      expect(result.reactionTypes).toEqual(["Suzuki-Coupling"]);
      expect(result.researchers).toEqual(["user-1", "user-2"]);
    });

    it("should only call writer once per deduplicated entity", async () => {
      const experiments = [makeExperiment()];

      const affected: AffectedEntities = {
        chemicals: ["14221-01-3", "14221-01-3", "14221-01-3"],
        reactionTypes: [],
        researchers: [],
      };

      await refresher.refreshAffectedEntities(affected, experiments, []);

      expect(mockWriter.upsertPage).toHaveBeenCalledTimes(1);
    });
  });

  describe("error isolation", () => {
    it("should isolate errors per entity and continue processing", async () => {
      let callCount = 0;
      mockWriter.upsertPage.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error("API error for first chemical");
        }
        return {
          action: "updated" as const,
          pageId: "page-456",
          title: "Test",
          contentHash: "def456",
        };
      });

      const experiments = [
        makeExperiment({
          reagents: [
            {
              id: "r1",
              chemical: {
                id: "chem-1",
                name: "Pd(PPh3)4",
                casNumber: "14221-01-3",
                molecularFormula: null,
              },
              role: "catalyst",
              amount: 0.5,
              unit: "mmol",
            },
            {
              id: "r2",
              chemical: {
                id: "chem-5",
                name: "Boronic Acid",
                casNumber: "98-80-6",
                molecularFormula: null,
              },
              amount: 1.0,
              unit: "mmol",
            },
          ],
        }),
      ];

      const affected: AffectedEntities = {
        chemicals: ["14221-01-3", "98-80-6"],
        reactionTypes: [],
        researchers: [],
      };

      const result = await refresher.refreshAffectedEntities(
        affected,
        experiments,
        [],
      );

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].entityName).toBe("14221-01-3");
      expect(result.errors[0].entityType).toBe("chemical");
      expect(result.errors[0].message).toBe("API error for first chemical");
      expect(result.refreshed.chemicals).toContain("98-80-6");
    });

    it("should isolate errors across entity types", async () => {
      let callCount = 0;
      mockWriter.upsertPage.mockImplementation(async () => {
        callCount++;
        if (callCount === 2) {
          throw new Error("Reaction type API failure");
        }
        return {
          action: "updated" as const,
          pageId: `page-${callCount}`,
          title: "Test",
          contentHash: `hash-${callCount}`,
        };
      });

      const experiments = [makeExperiment()];
      const profiles = [makeExpertiseProfile()];

      const affected: AffectedEntities = {
        chemicals: ["14221-01-3"],
        reactionTypes: ["Suzuki-Coupling"],
        researchers: ["user-1"],
      };

      const result = await refresher.refreshAffectedEntities(
        affected,
        experiments,
        profiles,
      );

      expect(result.refreshed.chemicals).toContain("14221-01-3");
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].entityType).toBe("reaction-type");
      expect(result.refreshed.researchers).toContain("user-1");
    });
  });

  describe("processing order", () => {
    it("should process chemicals before reaction types before researchers", async () => {
      const callOrder: string[] = [];
      mockWriter.upsertPage.mockImplementation(
        async (markdown: string, matchTag: string) => {
          if (matchTag.startsWith("cas:")) callOrder.push("chemical");
          else if (matchTag.startsWith("reaction:"))
            callOrder.push("reactionType");
          else if (matchTag.startsWith("researcher:"))
            callOrder.push("researcher");
          return {
            action: "updated" as const,
            pageId: "p1",
            title: "T",
            contentHash: "h",
          };
        },
      );

      const experiments = [makeExperiment()];
      const profiles = [makeExpertiseProfile()];

      const affected: AffectedEntities = {
        chemicals: ["14221-01-3"],
        reactionTypes: ["Suzuki-Coupling"],
        researchers: ["user-1"],
      };

      await refresher.refreshAffectedEntities(affected, experiments, profiles);

      expect(callOrder).toEqual(["chemical", "reactionType", "researcher"]);
    });
  });

  describe("skip when no changes detected", () => {
    it("should report skipped for all entity types when unchanged", async () => {
      mockWriter.upsertPage.mockResolvedValue({
        action: "skipped" as const,
        pageId: "page-123",
        title: "Test",
        contentHash: "same-hash",
      });

      const experiments = [makeExperiment()];
      const profiles = [makeExpertiseProfile()];

      const affected: AffectedEntities = {
        chemicals: ["14221-01-3"],
        reactionTypes: ["Suzuki-Coupling"],
        researchers: ["user-1"],
      };

      const result = await refresher.refreshAffectedEntities(
        affected,
        experiments,
        profiles,
      );

      expect(result.refreshed.chemicals).toHaveLength(0);
      expect(result.refreshed.reactionTypes).toHaveLength(0);
      expect(result.refreshed.researchers).toHaveLength(0);
      expect(result.skipped).toHaveLength(3);
      expect(result.skipped).toContain("chemical:14221-01-3");
      expect(result.skipped).toContain("reaction-type:Suzuki-Coupling");
      expect(result.skipped).toContain("researcher:user-1");
    });
  });

  describe("empty aggregations", () => {
    it("should handle chemical with no experiment usages", async () => {
      const affected: AffectedEntities = {
        chemicals: ["999-99-9"],
        reactionTypes: [],
        researchers: [],
      };

      const result = await refresher.refreshAffectedEntities(
        affected,
        [],
        [],
      );

      expect(mockWriter.upsertPage).toHaveBeenCalledTimes(1);
      const markdown = mockWriter.upsertPage.mock.calls[0][0] as string;
      expect(markdown).toContain("999-99-9");
    });

    it("should handle reaction type with no experiments", async () => {
      const affected: AffectedEntities = {
        chemicals: [],
        reactionTypes: ["Unknown-Reaction"],
        researchers: [],
      };

      const result = await refresher.refreshAffectedEntities(
        affected,
        [],
        [],
      );

      expect(mockWriter.upsertPage).toHaveBeenCalledTimes(1);
      const markdown = mockWriter.upsertPage.mock.calls[0][0] as string;
      expect(markdown).toContain("Unknown-Reaction");
      expect(markdown).toContain("0 experiments");
    });

    it("should handle researcher with no experiments", async () => {
      const affected: AffectedEntities = {
        chemicals: [],
        reactionTypes: [],
        researchers: ["user-999"],
      };

      const result = await refresher.refreshAffectedEntities(
        affected,
        [],
        [],
      );

      expect(mockWriter.upsertPage).toHaveBeenCalledTimes(1);
      const markdown = mockWriter.upsertPage.mock.calls[0][0] as string;
      expect(markdown).toContain("0 experiments");
    });
  });
});
