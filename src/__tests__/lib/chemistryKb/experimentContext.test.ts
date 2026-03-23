import { describe, test, expect, vi, beforeEach } from "vitest";

// Mock Prisma
const mockPageFindFirst = vi.fn();
const mockBlockFindFirst = vi.fn();
const mockPageLinkFindMany = vi.fn();
const mockPageFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    page: {
      findFirst: (...args: unknown[]) => mockPageFindFirst(...args),
      findMany: (...args: unknown[]) => mockPageFindMany(...args),
    },
    block: {
      findFirst: (...args: unknown[]) => mockBlockFindFirst(...args),
    },
    pageLink: {
      findMany: (...args: unknown[]) => mockPageLinkFindMany(...args),
    },
  },
}));

vi.mock("@/lib/agent/markdown", () => ({
  tiptapToMarkdown: vi.fn((content) => {
    // Return the mock markdown stored in content._mockMarkdown
    if (content && typeof content === "object" && "_mockMarkdown" in content) {
      return content._mockMarkdown;
    }
    return "";
  }),
}));

const { assembleExperimentContext } = await import(
  "@/lib/chemistryKb/experimentContext"
);

const TENANT_ID = "test-tenant";
const EXP_ID = "EXP-2026-0042";

const mockExperimentPage = {
  id: "exp-page-id",
  title: "EXP-2026-0042: Suzuki Coupling of 4-Bromopyridine",
  oneLiner: "Standard Suzuki coupling with Pd catalyst",
};

const mockChemicalPage = {
  id: "chem-page-id",
  title: "Pd(PPh3)4",
  oneLiner: "Tetrakis palladium catalyst",
  parentId: "chemicals-parent-id",
};

const mockReactionTypePage = {
  id: "rt-page-id",
  title: "Suzuki Coupling",
  oneLiner: "Palladium-catalyzed cross-coupling",
  parentId: "reaction-types-parent-id",
};

const mockResearcherPage = {
  id: "researcher-page-id",
  title: "Dr. Anna Mueller",
  oneLiner: "Senior researcher, cross-coupling expert",
  parentId: "researchers-parent-id",
};

function makeDocBlock(markdown: string) {
  return {
    content: { _mockMarkdown: markdown },
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  // Default: experiment page found
  mockPageFindFirst.mockImplementation(({ where }) => {
    if (where.title?.startsWith === EXP_ID) {
      return Promise.resolve(mockExperimentPage);
    }
    return Promise.resolve(null);
  });

  // Default: no linked pages
  mockPageLinkFindMany.mockResolvedValue([]);

  // Default: no parent pages found
  mockPageFindMany.mockResolvedValue([]);

  // Default: empty block
  mockBlockFindFirst.mockResolvedValue(null);
});

describe("assembleExperimentContext", () => {
  test("returns null when experiment not found", async () => {
    mockPageFindFirst.mockResolvedValue(null);

    const result = await assembleExperimentContext(
      TENANT_ID,
      "NON-EXISTENT",
      "default"
    );
    expect(result).toBeNull();
  });

  test("default depth returns titles and one-liners only", async () => {
    const result = await assembleExperimentContext(
      TENANT_ID,
      EXP_ID,
      "default"
    );

    expect(result).not.toBeNull();
    expect(result!.experiment.id).toBe(EXP_ID);
    expect(result!.experiment.title).toBe(mockExperimentPage.title);
    expect(result!.experiment.oneLiner).toBe(mockExperimentPage.oneLiner);
    expect(result!.depth).toBe("default");
    expect(result!.experiment.procedures).toBeUndefined();
    expect(result!.contextSize).toBeGreaterThan(0);
  });

  test("default depth does not fetch page content", async () => {
    await assembleExperimentContext(TENANT_ID, EXP_ID, "default");

    // Block content should not be fetched at default depth
    // (only pageLink queries run for category detection)
    const blockCalls = mockBlockFindFirst.mock.calls;
    expect(blockCalls.length).toBe(0);
  });

  test("medium depth includes procedures and chemical details", async () => {
    // Setup linked chemical
    mockPageLinkFindMany.mockImplementation(({ where }) => {
      if (where.sourcePageId === mockExperimentPage.id) {
        return Promise.resolve([
          { targetPage: mockChemicalPage },
          { targetPage: mockReactionTypePage },
          { targetPage: mockResearcherPage },
        ]);
      }
      return Promise.resolve([]);
    });

    // Setup parent category pages
    mockPageFindMany.mockImplementation(({ where }) => {
      if (where.id?.in) {
        return Promise.resolve([
          { id: "chemicals-parent-id", title: "Chemicals" },
          { id: "reaction-types-parent-id", title: "Reaction Types" },
          { id: "researchers-parent-id", title: "Researchers" },
        ]);
      }
      return Promise.resolve([]);
    });

    // Setup page content
    mockBlockFindFirst.mockImplementation(({ where }) => {
      if (where.pageId === mockExperimentPage.id) {
        return Promise.resolve(
          makeDocBlock(
            "# Experiment\n\n## Procedures\n\n1. Add reagent\n2. Heat to 80°C\n3. Stir for 2h\n\n## Results\n\nYield: 87%"
          )
        );
      }
      if (where.pageId === mockChemicalPage.id) {
        return Promise.resolve(
          makeDocBlock(
            "# Pd(PPh3)4\n\n## Safety\n\nAir-sensitive, use Schlenk line\n\n## Handling\n\nStore under nitrogen at -20°C"
          )
        );
      }
      if (where.pageId === mockReactionTypePage.id) {
        return Promise.resolve(
          makeDocBlock(
            "# Suzuki Coupling\n\n## Best Practices\n\n- Always degas solvents\n- Use fresh catalyst\n\n## Common Pitfalls\n\n- Old THF gives 10-15% yield drop\n\n## Tips\n\n- Dr. Mueller recommends 80°C for heteroaryl substrates"
          )
        );
      }
      if (where.pageId === mockResearcherPage.id) {
        return Promise.resolve(
          makeDocBlock(
            "# Dr. Anna Mueller\n\n## Expertise\n\nCross-coupling reactions, heteroaryl chemistry"
          )
        );
      }
      return Promise.resolve(null);
    });

    const result = await assembleExperimentContext(
      TENANT_ID,
      EXP_ID,
      "medium"
    );

    expect(result).not.toBeNull();
    expect(result!.depth).toBe("medium");
    expect(result!.experiment.procedures).toContain("Add reagent");
    expect(result!.experiment.chemicals.length).toBe(1);
    expect(result!.experiment.chemicals[0].name).toBe("Pd(PPh3)4");
    expect(result!.experiment.chemicals[0].safety).toContain("Air-sensitive");
    expect(result!.experiment.chemicals[0].handling).toContain("nitrogen");
    expect(result!.experiment.reactionType?.name).toBe("Suzuki Coupling");
    expect(result!.experiment.reactionType?.bestPractices).toContain(
      "degas solvents"
    );
    expect(result!.experiment.researcher?.name).toBe("Dr. Anna Mueller");
    expect(result!.experiment.researcher?.expertise).toContain("Cross-coupling");
    expect(result!.institutionalKnowledge.bestPractices).toContain(
      "Always degas solvents"
    );
    expect(result!.institutionalKnowledge.commonPitfalls).toContain(
      "Old THF gives 10-15% yield drop"
    );
    expect(result!.institutionalKnowledge.tips.length).toBeGreaterThan(0);
  });

  test("deep depth includes related experiments", async () => {
    // Setup linked reaction type
    mockPageLinkFindMany.mockImplementation(({ where }) => {
      if (where.sourcePageId === mockExperimentPage.id) {
        return Promise.resolve([
          { targetPage: mockReactionTypePage },
        ]);
      }
      if (where.targetPageId === mockReactionTypePage.id) {
        return Promise.resolve([
          {
            sourcePage: {
              id: "related-exp-id",
              title: "EXP-2026-0043: Suzuki Follow-up",
              oneLiner: "Optimization run",
            },
          },
        ]);
      }
      return Promise.resolve([]);
    });

    mockPageFindMany.mockImplementation(({ where }) => {
      if (where.id?.in) {
        return Promise.resolve([
          { id: "reaction-types-parent-id", title: "Reaction Types" },
        ]);
      }
      return Promise.resolve([]);
    });

    mockBlockFindFirst.mockImplementation(({ where }) => {
      if (where.pageId === mockReactionTypePage.id) {
        return Promise.resolve(
          makeDocBlock("# Suzuki\n\n## Best Practices\n\n- Degas\n\n## Tips\n\n- Use fresh")
        );
      }
      if (where.pageId === "related-exp-id") {
        return Promise.resolve(
          makeDocBlock("# Related\n\n## Challenges\n\n- Slow conversion at RT")
        );
      }
      return Promise.resolve(makeDocBlock(""));
    });

    const result = await assembleExperimentContext(
      TENANT_ID,
      EXP_ID,
      "deep"
    );

    expect(result).not.toBeNull();
    expect(result!.depth).toBe("deep");
    expect(result!.institutionalKnowledge.relatedExperiments.length).toBeGreaterThan(0);
    expect(result!.institutionalKnowledge.relatedExperiments[0].title).toContain(
      "Follow-up"
    );
  });

  test("contextSize is a positive number", async () => {
    const result = await assembleExperimentContext(
      TENANT_ID,
      EXP_ID,
      "default"
    );

    expect(result).not.toBeNull();
    expect(result!.contextSize).toBeGreaterThan(0);
    // contextSize should be roughly the size of the serialized result
    const serializedSize = JSON.stringify(result).length;
    expect(Math.abs(result!.contextSize - serializedSize)).toBeLessThan(10);
  });

  test("handles experiment with no linked entities gracefully", async () => {
    mockPageLinkFindMany.mockResolvedValue([]);

    const result = await assembleExperimentContext(
      TENANT_ID,
      EXP_ID,
      "medium"
    );

    expect(result).not.toBeNull();
    expect(result!.experiment.chemicals).toEqual([]);
    expect(result!.experiment.reactionType).toBeUndefined();
    expect(result!.experiment.researcher).toBeUndefined();
    expect(result!.institutionalKnowledge.bestPractices).toEqual([]);
  });
});
