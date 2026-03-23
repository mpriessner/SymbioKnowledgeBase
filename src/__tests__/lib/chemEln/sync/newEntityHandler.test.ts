import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  NewEntityHandler,
  checkEntityExists,
  createEntityPage,
} from "@/lib/chemEln/sync/newEntityHandler";
import type {
  NewEntity,
  EntityHandlerResult,
} from "@/lib/chemEln/sync/newEntityHandler";
import { CrossReferenceResolver } from "@/lib/chemEln/sync/resolver";
import type { AffectedEntities } from "@/lib/chemEln/sync/updatePropagator";

function createMockWriter() {
  return {
    upsertPage: vi.fn().mockResolvedValue({
      action: "created" as const,
      pageId: "page-new-1",
      title: "New Page",
      contentHash: "hash-1",
    }),
    updatePage: vi.fn().mockResolvedValue({
      id: "page-new-1",
      title: "New Page",
      updatedAt: "2026-03-21T12:00:00.000Z",
    }),
    searchPages: vi.fn().mockResolvedValue([]),
    getPage: vi.fn().mockResolvedValue(null),
    createPage: vi.fn().mockResolvedValue({
      id: "page-new-1",
      title: "New Page",
      createdAt: "2026-03-21T12:00:00.000Z",
    }),
    computeHash: vi.fn().mockReturnValue("hash-1"),
  };
}

function createResolverWithEntities(
  entities: Array<{
    name: string;
    type: "chemical" | "reaction-type" | "researcher" | "substrate-class";
    casNumber?: string;
  }>,
): CrossReferenceResolver {
  const resolver = new CrossReferenceResolver();
  const chemicals = entities
    .filter((e) => e.type === "chemical")
    .map((e) => ({
      id: e.name.toLowerCase().replace(/\s+/g, "-"),
      name: e.name,
      casNumber: e.casNumber ?? null,
      molecularFormula: null,
    }));
  const reactionTypes = entities
    .filter((e) => e.type === "reaction-type")
    .map((e) => ({
      name: e.name,
      experimentCount: 1,
      avgYield: null,
      researcherCount: 1,
      experiments: [],
      keyLearnings: [],
      commonPitfalls: [],
      topResearchers: [],
    }));
  const researchers = entities
    .filter((e) => e.type === "researcher")
    .map((e) => ({
      name: e.name,
      totalExperiments: 1,
      topReactionTypes: [],
      recentExperiments: [],
      keyContributions: [],
    }));
  const substrateClasses = entities
    .filter((e) => e.type === "substrate-class")
    .map((e) => ({
      name: e.name,
      experimentCount: 1,
    }));

  resolver.buildLookupMap({
    chemicals,
    reactionTypes,
    researchers,
    substrateClasses,
  });
  return resolver;
}

// ---------------------------------------------------------------------------
// checkEntityExists
// ---------------------------------------------------------------------------

describe("checkEntityExists", () => {
  it("returns true when entity exists with matching type", () => {
    const resolver = createResolverWithEntities([
      { name: "Palladium Acetate", type: "chemical", casNumber: "3375-31-3" },
    ]);
    expect(checkEntityExists("Palladium Acetate", "chemical", resolver)).toBe(
      true,
    );
  });

  it("returns false when entity does not exist", () => {
    const resolver = createResolverWithEntities([]);
    expect(checkEntityExists("Unknown Chemical", "chemical", resolver)).toBe(
      false,
    );
  });

  it("returns false when entity exists with different type", () => {
    const resolver = createResolverWithEntities([
      { name: "Suzuki", type: "reaction-type" },
    ]);
    expect(checkEntityExists("Suzuki", "chemical", resolver)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createEntityPage
// ---------------------------------------------------------------------------

describe("createEntityPage", () => {
  it("creates a chemical page with CAS number (full page)", async () => {
    const writer = createMockWriter();
    const entity: NewEntity = {
      name: "Palladium Acetate",
      type: "chemical",
      casNumber: "3375-31-3",
      experimentId: "EXP-001",
      experimentTitle: "Suzuki Coupling Test",
    };

    const result = await createEntityPage(entity, writer as any, {
      chemicals: "parent-chem",
    });

    expect(result.id).toBe("page-new-1");
    expect(writer.upsertPage).toHaveBeenCalledTimes(1);
    const [markdown, matchTag, options] = writer.upsertPage.mock.calls[0];
    expect(matchTag).toBe("cas:3375-31-3");
    expect(options.parentId).toBe("parent-chem");
    expect(markdown).toContain("Palladium Acetate");
    expect(markdown).toContain("3375-31-3");
  });

  it("creates a chemical stub when no CAS number", async () => {
    const writer = createMockWriter();
    const entity: NewEntity = {
      name: "Mystery Compound",
      type: "chemical",
    };

    const result = await createEntityPage(entity, writer as any, {});

    expect(result.id).toBe("page-new-1");
    expect(writer.upsertPage).toHaveBeenCalledTimes(1);
    const [markdown, matchTag] = writer.upsertPage.mock.calls[0];
    expect(matchTag).toBe("chemical:mystery-compound");
    expect(markdown).toContain("needs-enrichment");
  });

  it("creates a reaction type page", async () => {
    const writer = createMockWriter();
    const entity: NewEntity = {
      name: "Suzuki Coupling",
      type: "reaction-type",
      experimentId: "EXP-001",
      researcherName: "Dr. Mueller",
      yield: 85,
    };

    await createEntityPage(entity, writer as any, {
      "reaction-types": "parent-rt",
    });

    expect(writer.upsertPage).toHaveBeenCalledTimes(1);
    const [markdown, matchTag, options] = writer.upsertPage.mock.calls[0];
    expect(matchTag).toBe("reaction:suzuki-coupling");
    expect(options.parentId).toBe("parent-rt");
    expect(markdown).toContain("Suzuki Coupling");
  });

  it("creates a researcher page", async () => {
    const writer = createMockWriter();
    const entity: NewEntity = {
      name: "Dr. Mueller",
      type: "researcher",
      experimentId: "EXP-001",
      reactionType: "Suzuki",
      yield: 85,
    };

    await createEntityPage(entity, writer as any, {
      researchers: "parent-res",
    });

    expect(writer.upsertPage).toHaveBeenCalledTimes(1);
    const [markdown, matchTag, options] = writer.upsertPage.mock.calls[0];
    expect(matchTag).toBe("researcher:dr.-mueller");
    expect(options.parentId).toBe("parent-res");
    expect(markdown).toContain("Dr. Mueller");
  });

  it("sets correct parent page ID for each entity type", async () => {
    const writer = createMockWriter();
    const parentIds = {
      chemicals: "chem-parent",
      "reaction-types": "rt-parent",
      researchers: "res-parent",
      "substrate-classes": "sc-parent",
    };

    await createEntityPage(
      { name: "Ethanol", type: "chemical", casNumber: "64-17-5" },
      writer as any,
      parentIds,
    );
    expect(writer.upsertPage.mock.calls[0][2].parentId).toBe("chem-parent");

    writer.upsertPage.mockClear();
    await createEntityPage(
      { name: "Heck", type: "reaction-type" },
      writer as any,
      parentIds,
    );
    expect(writer.upsertPage.mock.calls[0][2].parentId).toBe("rt-parent");

    writer.upsertPage.mockClear();
    await createEntityPage(
      { name: "Dr. Smith", type: "researcher" },
      writer as any,
      parentIds,
    );
    expect(writer.upsertPage.mock.calls[0][2].parentId).toBe("res-parent");

    writer.upsertPage.mockClear();
    await createEntityPage(
      { name: "Aryl Halides", type: "substrate-class" },
      writer as any,
      parentIds,
    );
    expect(writer.upsertPage.mock.calls[0][2].parentId).toBe("sc-parent");
  });
});

// ---------------------------------------------------------------------------
// NewEntityHandler
// ---------------------------------------------------------------------------

describe("NewEntityHandler", () => {
  let writer: ReturnType<typeof createMockWriter>;

  beforeEach(() => {
    writer = createMockWriter();
  });

  it("creates a new chemical page when CAS number is detected", async () => {
    const resolver = createResolverWithEntities([]);
    const handler = new NewEntityHandler(writer as any, resolver, {
      parentIds: { chemicals: "chem-parent" },
    });

    const affected: AffectedEntities = {
      chemicals: ["3375-31-3"],
      reactionTypes: [],
      researchers: [],
    };

    const result = await handler.handleNewEntities(affected);

    expect(result.created).toHaveLength(1);
    expect(result.created[0].name).toBe("3375-31-3");
    expect(result.created[0].type).toBe("chemical");
    expect(result.created[0].pageId).toBe("page-new-1");
    expect(result.stubbed).toHaveLength(0);
    expect(result.updated).toHaveLength(0);
  });

  it("creates a stub for new chemical without CAS number", async () => {
    const resolver = createResolverWithEntities([]);
    const handler = new NewEntityHandler(writer as any, resolver);

    const affected: AffectedEntities = {
      chemicals: ["Some Organic Compound"],
      reactionTypes: [],
      researchers: [],
    };

    const result = await handler.handleNewEntities(affected);

    expect(result.stubbed).toHaveLength(1);
    expect(result.stubbed[0].name).toBe("Some Organic Compound");
    expect(result.stubbed[0].type).toBe("chemical");
    expect(result.created).toHaveLength(0);
  });

  it("creates a reaction type stub with needs-enrichment tag", async () => {
    const resolver = createResolverWithEntities([]);
    const handler = new NewEntityHandler(writer as any, resolver);

    const affected: AffectedEntities = {
      chemicals: [],
      reactionTypes: ["Buchwald-Hartwig"],
      researchers: [],
    };

    const result = await handler.handleNewEntities(affected);

    expect(result.stubbed).toHaveLength(1);
    expect(result.stubbed[0].name).toBe("Buchwald-Hartwig");
    expect(result.stubbed[0].type).toBe("reaction-type");

    const [markdown] = writer.upsertPage.mock.calls[0];
    expect(markdown).toContain("Buchwald-Hartwig");
  });

  it("marks existing entity for update instead of creating", async () => {
    const resolver = createResolverWithEntities([
      { name: "Palladium Acetate", type: "chemical", casNumber: "3375-31-3" },
      { name: "Suzuki", type: "reaction-type" },
    ]);
    const handler = new NewEntityHandler(writer as any, resolver);

    const affected: AffectedEntities = {
      chemicals: ["Palladium Acetate"],
      reactionTypes: ["Suzuki"],
      researchers: [],
    };

    const result = await handler.handleNewEntities(affected);

    expect(result.updated).toHaveLength(2);
    expect(result.updated[0].name).toBe("Palladium Acetate");
    expect(result.updated[1].name).toBe("Suzuki");
    expect(result.created).toHaveLength(0);
    expect(result.stubbed).toHaveLength(0);
    expect(writer.upsertPage).not.toHaveBeenCalled();
  });

  it("handles mixed new and existing entities", async () => {
    const resolver = createResolverWithEntities([
      { name: "Palladium Acetate", type: "chemical", casNumber: "3375-31-3" },
    ]);

    let callCount = 0;
    writer.upsertPage.mockImplementation(() => {
      callCount++;
      return Promise.resolve({
        action: "created" as const,
        pageId: `page-${callCount}`,
        title: `Page ${callCount}`,
        contentHash: `hash-${callCount}`,
      });
    });

    const handler = new NewEntityHandler(writer as any, resolver, {
      parentIds: {
        chemicals: "chem-parent",
        "reaction-types": "rt-parent",
        researchers: "res-parent",
      },
    });

    const affected: AffectedEntities = {
      chemicals: ["Palladium Acetate", "64-17-5"],
      reactionTypes: ["Negishi"],
      researchers: ["Dr. Schmidt"],
    };

    const result = await handler.handleNewEntities(affected);

    expect(result.updated).toHaveLength(1);
    expect(result.updated[0].name).toBe("Palladium Acetate");

    expect(result.created).toHaveLength(2);
    expect(result.created.some((e) => e.name === "64-17-5")).toBe(true);
    expect(result.created.some((e) => e.name === "Dr. Schmidt")).toBe(true);

    expect(result.stubbed).toHaveLength(1);
    expect(result.stubbed[0].name).toBe("Negishi");

    expect(result.errors).toHaveLength(0);
  });

  it("isolates errors per entity and continues processing", async () => {
    const resolver = createResolverWithEntities([]);

    let callIndex = 0;
    writer.upsertPage.mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) {
        return Promise.reject(new Error("API timeout on first call"));
      }
      return Promise.resolve({
        action: "created" as const,
        pageId: `page-${callIndex}`,
        title: `Page ${callIndex}`,
        contentHash: `hash-${callIndex}`,
      });
    });

    const handler = new NewEntityHandler(writer as any, resolver);

    const affected: AffectedEntities = {
      chemicals: ["Unknown Chemical A"],
      reactionTypes: ["Grignard"],
      researchers: ["Dr. Weber"],
    };

    const result = await handler.handleNewEntities(affected);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].entityName).toBe("Unknown Chemical A");
    expect(result.errors[0].entityType).toBe("chemical");
    expect(result.errors[0].message).toBe("API timeout on first call");

    expect(result.stubbed.length + result.created.length).toBe(2);
  });

  it("creates researcher page from available experiment data", async () => {
    const resolver = createResolverWithEntities([]);
    const handler = new NewEntityHandler(writer as any, resolver, {
      parentIds: { researchers: "res-parent" },
    });

    const affected: AffectedEntities = {
      chemicals: [],
      reactionTypes: [],
      researchers: ["Dr. Tanaka"],
    };

    const result = await handler.handleNewEntities(affected);

    expect(result.created).toHaveLength(1);
    expect(result.created[0].name).toBe("Dr. Tanaka");
    expect(result.created[0].type).toBe("researcher");

    const [markdown, matchTag, options] = writer.upsertPage.mock.calls[0];
    expect(matchTag).toBe("researcher:dr.-tanaka");
    expect(options.parentId).toBe("res-parent");
    expect(markdown).toContain("Dr. Tanaka");
  });

  it("processes entities in correct dependency order", async () => {
    const resolver = createResolverWithEntities([]);
    const callOrder: string[] = [];

    writer.upsertPage.mockImplementation(
      (_md: string, matchTag: string) => {
        callOrder.push(matchTag.split(":")[0]);
        return Promise.resolve({
          action: "created" as const,
          pageId: "p-1",
          title: "T",
          contentHash: "h",
        });
      },
    );

    const handler = new NewEntityHandler(writer as any, resolver);

    const affected: AffectedEntities = {
      chemicals: ["64-17-5"],
      reactionTypes: ["Suzuki"],
      researchers: ["Dr. Li"],
    };

    await handler.handleNewEntities(affected);

    expect(callOrder[0]).toBe("cas");
    expect(callOrder[1]).toBe("reaction");
    expect(callOrder[2]).toBe("researcher");
  });
});
