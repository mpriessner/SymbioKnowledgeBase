import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  UpdatePropagator,
  getAffectedEntities,
} from "@/lib/chemEln/sync/updatePropagator";
import type { ChangeSet } from "@/lib/chemEln/sync/changeDetector";
import { EnhancedSyncStateManager } from "@/lib/chemEln/sync/enhancedSyncState";
import { CrossReferenceResolver } from "@/lib/chemEln/sync/resolver";
import type { ExperimentData } from "@/lib/chemEln/types";

function createMockWriter() {
  return {
    upsertPage: vi.fn().mockResolvedValue({
      action: "created" as const,
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

function makeExperiment(overrides: Partial<ExperimentData> = {}): ExperimentData {
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

function makeChangeSet(overrides: Partial<ChangeSet> = {}): ChangeSet {
  return {
    new: [],
    updated: [],
    deleted: [],
    unchanged: [],
    ...overrides,
  };
}

describe("UpdatePropagator", () => {
  let mockWriter: ReturnType<typeof createMockWriter>;
  let resolver: CrossReferenceResolver;
  let stateManager: EnhancedSyncStateManager;
  let propagator: UpdatePropagator;

  beforeEach(() => {
    mockWriter = createMockWriter();
    resolver = new CrossReferenceResolver();
    resolver.setResearcherMapping("user-1", "Dr. Mueller");
    resolver.setResearcherMapping("user-2", "Dr. Schmidt");
    stateManager = new EnhancedSyncStateManager("/tmp/test-sync-state.json");
    propagator = new UpdatePropagator(
      mockWriter as any,
      resolver,
      stateManager,
    );
  });

  describe("new experiment propagation", () => {
    it("should create experiment page via writer", async () => {
      const experiment = makeExperiment();
      const changeSet = makeChangeSet({
        new: [
          { id: "EXP-001", contentHash: "hash-a", updatedAt: "2026-03-21T13:00:00.000Z" },
        ],
      });

      const result = await propagator.propagateChanges(changeSet, [experiment]);

      expect(result.experimentsCreated).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(mockWriter.upsertPage).toHaveBeenCalledTimes(1);
      const [markdown, tag] = mockWriter.upsertPage.mock.calls[0];
      expect(tag).toBe("eln:EXP-001");
      expect(markdown).toContain("EXP-001");
    });

    it("should update sync state with new entry", async () => {
      const experiment = makeExperiment();
      const changeSet = makeChangeSet({
        new: [
          { id: "EXP-001", contentHash: "hash-a", updatedAt: "2026-03-21T13:00:00.000Z" },
        ],
      });

      await propagator.propagateChanges(changeSet, [experiment]);

      const entry = stateManager.getExperimentEntry("EXP-001");
      expect(entry).not.toBeNull();
      expect(entry!.contentHash).toBe("hash-a");
      expect(entry!.reactionType).toBe("Suzuki-Coupling");
      expect(entry!.researcher).toBe("Dr. Mueller");
      expect(entry!.skbPageId).toBe("page-123");
    });

    it("should track affected entities for new experiment", async () => {
      const experiment = makeExperiment();
      const changeSet = makeChangeSet({
        new: [
          { id: "EXP-001", contentHash: "hash-a", updatedAt: "2026-03-21T13:00:00.000Z" },
        ],
      });

      const result = await propagator.propagateChanges(changeSet, [experiment]);

      expect(result.affectedEntities.chemicals).toContain("14221-01-3");
      expect(result.affectedEntities.chemicals).toContain("92-52-4");
      expect(result.affectedEntities.reactionTypes).toContain("Suzuki-Coupling");
      expect(result.affectedEntities.researchers).toContain("user-1");
    });
  });

  describe("updated experiment propagation", () => {
    it("should update experiment page via writer", async () => {
      stateManager.setExperimentEntry("EXP-001", {
        contentHash: "hash-old",
        lastUpdated: "2026-03-21T10:00:00.000Z",
        reactionType: "Suzuki-Coupling",
        researcher: "Dr. Mueller",
        skbPageId: "page-existing",
      });

      const experiment = makeExperiment({ title: "Updated Title" });
      const changeSet = makeChangeSet({
        updated: [
          { id: "EXP-001", contentHash: "hash-b", updatedAt: "2026-03-21T14:00:00.000Z" },
        ],
      });

      const result = await propagator.propagateChanges(changeSet, [experiment]);

      expect(result.experimentsUpdated).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(mockWriter.upsertPage).toHaveBeenCalledTimes(1);
    });

    it("should update sync state after update", async () => {
      stateManager.setExperimentEntry("EXP-001", {
        contentHash: "hash-old",
        lastUpdated: "2026-03-21T10:00:00.000Z",
        reactionType: "Suzuki-Coupling",
        researcher: "Dr. Mueller",
        skbPageId: "page-existing",
      });

      const experiment = makeExperiment();
      const changeSet = makeChangeSet({
        updated: [
          { id: "EXP-001", contentHash: "hash-b", updatedAt: "2026-03-21T14:00:00.000Z" },
        ],
      });

      await propagator.propagateChanges(changeSet, [experiment]);

      const entry = stateManager.getExperimentEntry("EXP-001");
      expect(entry).not.toBeNull();
      expect(entry!.contentHash).toBe("hash-b");
      expect(entry!.lastUpdated).toBe("2026-03-21T14:00:00.000Z");
    });

    it("should track old and new reaction type when reaction type changes", async () => {
      stateManager.setExperimentEntry("EXP-001", {
        contentHash: "hash-old",
        lastUpdated: "2026-03-21T10:00:00.000Z",
        reactionType: "Heck-Coupling",
        researcher: "Dr. Mueller",
        skbPageId: "page-existing",
      });

      const experiment = makeExperiment({ experimentType: "Suzuki-Coupling" });
      const changeSet = makeChangeSet({
        updated: [
          { id: "EXP-001", contentHash: "hash-b", updatedAt: "2026-03-21T14:00:00.000Z" },
        ],
      });

      const result = await propagator.propagateChanges(changeSet, [experiment]);

      expect(result.affectedEntities.reactionTypes).toContain("Suzuki-Coupling");
      expect(result.affectedEntities.reactionTypes).toContain("Heck-Coupling");
    });

    it("should track old and new researcher when researcher changes", async () => {
      stateManager.setExperimentEntry("EXP-001", {
        contentHash: "hash-old",
        lastUpdated: "2026-03-21T10:00:00.000Z",
        reactionType: "Suzuki-Coupling",
        researcher: "Dr. Schmidt",
        skbPageId: "page-existing",
      });

      const experiment = makeExperiment({ createdBy: "user-1" });
      const changeSet = makeChangeSet({
        updated: [
          { id: "EXP-001", contentHash: "hash-b", updatedAt: "2026-03-21T14:00:00.000Z" },
        ],
      });

      const result = await propagator.propagateChanges(changeSet, [experiment]);

      expect(result.affectedEntities.researchers).toContain("user-1");
    });
  });

  describe("deleted experiment archival", () => {
    it("should archive experiment page with archived tag", async () => {
      stateManager.setExperimentEntry("EXP-001", {
        contentHash: "hash-old",
        lastUpdated: "2026-03-21T10:00:00.000Z",
        reactionType: "Suzuki-Coupling",
        researcher: "Dr. Mueller",
        skbPageId: "page-existing",
      });

      mockWriter.searchPages.mockResolvedValue([
        {
          id: "page-existing",
          title: "EXP-001",
          icon: null,
          parent_id: null,
          created_at: "2026-03-21",
          updated_at: "2026-03-21",
        },
      ]);
      mockWriter.getPage.mockResolvedValue({
        id: "page-existing",
        title: "EXP-001",
        icon: null,
        parent_id: null,
        created_at: "2026-03-21",
        updated_at: "2026-03-21",
        markdown:
          "---\ntitle: EXP-001\ntags: [eln:EXP-001, reaction:suzuki-coupling]\n---\n# EXP-001",
      });

      const changeSet = makeChangeSet({ deleted: ["EXP-001"] });

      const result = await propagator.propagateChanges(changeSet, []);

      expect(result.experimentsArchived).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(mockWriter.updatePage).toHaveBeenCalledTimes(1);

      const [, archivedMarkdown] = mockWriter.updatePage.mock.calls[0];
      expect(archivedMarkdown).toContain("archived");
    });

    it("should remove from sync state after archiving", async () => {
      stateManager.setExperimentEntry("EXP-001", {
        contentHash: "hash-old",
        lastUpdated: "2026-03-21T10:00:00.000Z",
        reactionType: "Suzuki-Coupling",
        researcher: "Dr. Mueller",
        skbPageId: "page-existing",
      });

      mockWriter.searchPages.mockResolvedValue([]);

      const changeSet = makeChangeSet({ deleted: ["EXP-001"] });

      await propagator.propagateChanges(changeSet, []);

      const entry = stateManager.getExperimentEntry("EXP-001");
      expect(entry).toBeNull();
    });

    it("should track affected entities from deleted experiment", async () => {
      stateManager.setExperimentEntry("EXP-001", {
        contentHash: "hash-old",
        lastUpdated: "2026-03-21T10:00:00.000Z",
        reactionType: "Suzuki-Coupling",
        researcher: "Dr. Mueller",
        skbPageId: "page-existing",
      });

      mockWriter.searchPages.mockResolvedValue([]);

      const changeSet = makeChangeSet({ deleted: ["EXP-001"] });

      const result = await propagator.propagateChanges(changeSet, []);

      expect(result.affectedEntities.reactionTypes).toContain("Suzuki-Coupling");
      expect(result.affectedEntities.researchers).toContain("Dr. Mueller");
    });
  });

  describe("affected entity tracking", () => {
    it("should extract chemicals from reagents", () => {
      const experiment = makeExperiment();
      const affected = getAffectedEntities(experiment);

      expect(affected.chemicals).toContain("14221-01-3");
    });

    it("should extract chemicals from products", () => {
      const experiment = makeExperiment();
      const affected = getAffectedEntities(experiment);

      expect(affected.chemicals).toContain("92-52-4");
    });

    it("should fall back to chemical name when CAS number is null", () => {
      const experiment = makeExperiment({
        reagents: [
          {
            id: "r1",
            chemical: {
              id: "chem-1",
              name: "Custom Ligand",
              casNumber: null,
              molecularFormula: null,
            },
            role: "ligand",
            amount: 1,
            unit: "mmol",
          },
        ],
      });

      const affected = getAffectedEntities(experiment);

      expect(affected.chemicals).toContain("Custom Ligand");
    });

    it("should extract reaction type", () => {
      const experiment = makeExperiment();
      const affected = getAffectedEntities(experiment);

      expect(affected.reactionTypes).toEqual(["Suzuki-Coupling"]);
    });

    it("should extract researcher", () => {
      const experiment = makeExperiment();
      const affected = getAffectedEntities(experiment);

      expect(affected.researchers).toEqual(["user-1"]);
    });

    it("should deduplicate chemicals", () => {
      const experiment = makeExperiment({
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
              id: "chem-1",
              name: "Pd(PPh3)4",
              casNumber: "14221-01-3",
              molecularFormula: null,
            },
            yield: null,
            unit: "mg",
          },
        ],
      });

      const affected = getAffectedEntities(experiment);

      expect(affected.chemicals).toEqual(["14221-01-3"]);
    });
  });

  describe("error handling", () => {
    it("should continue processing when a single experiment fails", async () => {
      const exp1 = makeExperiment({ id: "EXP-001" });
      const exp2 = makeExperiment({ id: "EXP-002", title: "Second Experiment" });

      mockWriter.upsertPage
        .mockRejectedValueOnce(new Error("API error for EXP-001"))
        .mockResolvedValueOnce({
          action: "created",
          pageId: "page-456",
          title: "Second",
          contentHash: "hash-2",
        });

      const changeSet = makeChangeSet({
        new: [
          { id: "EXP-001", contentHash: "hash-a", updatedAt: "2026-03-21T13:00:00.000Z" },
          { id: "EXP-002", contentHash: "hash-b", updatedAt: "2026-03-21T13:00:00.000Z" },
        ],
      });

      const result = await propagator.propagateChanges(changeSet, [exp1, exp2]);

      expect(result.experimentsCreated).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].experimentId).toBe("EXP-001");
      expect(result.errors[0].operation).toBe("create");
      expect(result.errors[0].message).toBe("API error for EXP-001");
    });

    it("should record error when experiment data is missing from rawExperiments", async () => {
      const changeSet = makeChangeSet({
        new: [
          { id: "EXP-MISSING", contentHash: "hash-a", updatedAt: "2026-03-21T13:00:00.000Z" },
        ],
      });

      const result = await propagator.propagateChanges(changeSet, []);

      expect(result.experimentsCreated).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].experimentId).toBe("EXP-MISSING");
    });

    it("should handle mixed operations with partial failures", async () => {
      stateManager.setExperimentEntry("EXP-002", {
        contentHash: "hash-old",
        lastUpdated: "2026-03-21T10:00:00.000Z",
        reactionType: "Suzuki-Coupling",
        researcher: "Dr. Mueller",
        skbPageId: "page-existing",
      });
      stateManager.setExperimentEntry("EXP-003", {
        contentHash: "hash-old-3",
        lastUpdated: "2026-03-21T10:00:00.000Z",
        reactionType: "Negishi-Coupling",
        researcher: "Dr. Schmidt",
        skbPageId: "page-existing-3",
      });

      const newExp = makeExperiment({ id: "EXP-001" });
      const updatedExp = makeExperiment({ id: "EXP-002", title: "Updated" });

      mockWriter.upsertPage
        .mockResolvedValueOnce({
          action: "created",
          pageId: "page-new",
          title: "New",
          contentHash: "hash-new",
        })
        .mockRejectedValueOnce(new Error("Update failed"));

      mockWriter.searchPages.mockResolvedValue([]);

      const changeSet = makeChangeSet({
        new: [
          { id: "EXP-001", contentHash: "hash-a", updatedAt: "2026-03-21T13:00:00.000Z" },
        ],
        updated: [
          { id: "EXP-002", contentHash: "hash-b", updatedAt: "2026-03-21T14:00:00.000Z" },
        ],
        deleted: ["EXP-003"],
      });

      const result = await propagator.propagateChanges(
        changeSet,
        [newExp, updatedExp],
      );

      expect(result.experimentsCreated).toBe(1);
      expect(result.experimentsUpdated).toBe(0);
      expect(result.experimentsArchived).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].experimentId).toBe("EXP-002");
      expect(result.errors[0].operation).toBe("update");
    });
  });

  describe("sync state updates", () => {
    it("should persist pageId from writer response in sync state", async () => {
      mockWriter.upsertPage.mockResolvedValue({
        action: "created",
        pageId: "page-xyz-789",
        title: "Test",
        contentHash: "hash-computed",
      });

      const experiment = makeExperiment();
      const changeSet = makeChangeSet({
        new: [
          { id: "EXP-001", contentHash: "hash-a", updatedAt: "2026-03-21T13:00:00.000Z" },
        ],
      });

      await propagator.propagateChanges(changeSet, [experiment]);

      const entry = stateManager.getExperimentEntry("EXP-001");
      expect(entry!.skbPageId).toBe("page-xyz-789");
    });

    it("should update existing entry on update", async () => {
      stateManager.setExperimentEntry("EXP-001", {
        contentHash: "hash-old",
        lastUpdated: "2026-03-21T10:00:00.000Z",
        reactionType: "Heck-Coupling",
        researcher: "Dr. Schmidt",
        skbPageId: "page-existing",
      });

      mockWriter.upsertPage.mockResolvedValue({
        action: "updated",
        pageId: "page-existing",
        title: "Updated",
        contentHash: "hash-new",
      });

      const experiment = makeExperiment({
        experimentType: "Suzuki-Coupling",
        createdBy: "user-1",
      });
      const changeSet = makeChangeSet({
        updated: [
          { id: "EXP-001", contentHash: "hash-b", updatedAt: "2026-03-21T14:00:00.000Z" },
        ],
      });

      await propagator.propagateChanges(changeSet, [experiment]);

      const entry = stateManager.getExperimentEntry("EXP-001");
      expect(entry!.contentHash).toBe("hash-b");
      expect(entry!.reactionType).toBe("Suzuki-Coupling");
      expect(entry!.researcher).toBe("Dr. Mueller");
    });
  });
});
