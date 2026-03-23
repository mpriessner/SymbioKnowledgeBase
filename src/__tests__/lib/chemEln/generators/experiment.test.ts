import { describe, it, expect } from "vitest";
import {
  generateExperimentPage,
  ExperimentPageContext,
} from "@/lib/chemEln/generators/experiment";
import type { ExperimentData } from "@/lib/chemEln/types";

const mockExperiment: ExperimentData = {
  id: "EXP-2024-001",
  title: "Suzuki Coupling with 4-bromoanisole",
  objective: "Optimize conditions for Suzuki coupling of aryl bromides",
  experimentType: "Suzuki Coupling",
  status: "completed",
  createdBy: "user-1",
  createdAt: "2026-03-01T10:00:00Z",
  actualProcedure: [
    {
      stepNumber: 1,
      action: "Charge flask with substrate and catalyst",
      temperature: "RT",
    },
    {
      stepNumber: 2,
      action: "Add solvent under nitrogen",
      duration: "5 min",
    },
    {
      stepNumber: 3,
      action: "Heat to reflux",
      temperature: "80\u00B0C",
      duration: "2 hours",
    },
  ],
  procedureMetadata: {
    temperature: "80\u00B0C",
    time: "2 hours",
    solvent: "THF",
    atmosphere: "N\u2082",
  },
  reagents: [
    {
      id: "r1",
      chemical: {
        id: "c1",
        name: "Palladium Acetate",
        casNumber: "3375-31-3",
        molecularFormula: null,
      },
      role: "catalyst",
      amount: 5,
      unit: "mol%",
    },
    {
      id: "r2",
      chemical: {
        id: "c2",
        name: "4-Bromoanisole",
        casNumber: "104-92-7",
        molecularFormula: "C7H7BrO",
      },
      role: "substrate",
      amount: 1.0,
      unit: "mmol",
    },
  ],
  products: [
    {
      id: "p1",
      chemical: {
        id: "c3",
        name: "4-Methoxybiphenyl",
        casNumber: "613-37-6",
        molecularFormula: "C13H12O",
      },
      yield: 85,
      unit: "%",
    },
  ],
  practicalNotes: [
    {
      type: "deviation",
      content: "Used 3x more catalyst due to low reactivity",
      timestamp: "2026-03-01",
    },
    {
      type: "observation",
      content:
        "Color change observed at 60\u00B0C instead of expected 80\u00B0C",
    },
  ],
  relatedExperiments: [
    { id: "EXP-2024-005", title: "Suzuki Coupling optimization" },
  ],
};

const mockContext: ExperimentPageContext = {
  researcherName: "Jane Doe",
  reactionType: "Suzuki Coupling",
  substrateClass: "aryl-halides",
  scale: "mmol",
  relatedExperiments: [
    { id: "EXP-2024-005", title: "Suzuki Coupling optimization" },
  ],
};

describe("generateExperimentPage", () => {
  it("should generate valid frontmatter with all required tags", () => {
    const md = generateExperimentPage(mockExperiment, mockContext);
    expect(md).toContain("---");
    expect(md).toContain("page-type: experiment");
    expect(md).toContain("eln:EXP-2024-001");
    expect(md).toContain("reaction:suzuki-coupling");
    expect(md).toContain("researcher:jane-doe");
    expect(md).toContain("quality:");
    expect(md).toContain("substrate-class:aryl-halides");
    expect(md).toContain("scale:mmol");
  });

  it("should include the experiment title as heading", () => {
    const md = generateExperimentPage(mockExperiment, mockContext);
    expect(md).toContain(
      "# EXP-2024-001: Suzuki Coupling with 4-bromoanisole"
    );
  });

  it("should include objective paragraph", () => {
    const md = generateExperimentPage(mockExperiment, mockContext);
    expect(md).toContain(
      "Optimize conditions for Suzuki coupling of aryl bromides"
    );
  });

  it("should include one-liner in frontmatter from objective", () => {
    const md = generateExperimentPage(mockExperiment, mockContext);
    expect(md).toContain(
      "one-liner: Optimize conditions for Suzuki coupling of aryl bromides"
    );
  });

  it("should include reaction type as wikilink", () => {
    const md = generateExperimentPage(mockExperiment, mockContext);
    expect(md).toContain("**Reaction Type:** [[Suzuki Coupling]]");
  });

  it("should include researcher as wikilink", () => {
    const md = generateExperimentPage(mockExperiment, mockContext);
    expect(md).toContain("**Researcher:** [[Jane Doe]]");
  });

  it("should include quality score with stars", () => {
    const md = generateExperimentPage(mockExperiment, mockContext);
    expect(md).toMatch(/Quality Score:.*\(\d\/5\)/);
  });

  it("should include conditions table with correct values", () => {
    const md = generateExperimentPage(mockExperiment, mockContext);
    expect(md).toContain("## Conditions");
    expect(md).toContain("Temperature");
    expect(md).toContain("80\u00B0C");
    expect(md).toContain("Reaction Time");
    expect(md).toContain("2 hours");
    expect(md).toContain("Atmosphere");
  });

  it("should wikilink solvent in conditions table", () => {
    const md = generateExperimentPage(mockExperiment, mockContext);
    expect(md).toContain("[[Thf]]");
  });

  it("should include wikilinked reagents with role and amount", () => {
    const md = generateExperimentPage(mockExperiment, mockContext);
    expect(md).toContain("## Reagents");
    expect(md).toContain("[[Palladium Acetate]]");
    expect(md).toContain("5 mol%");
    expect(md).toContain("[[4 Bromoanisole]]");
    expect(md).toContain("1 mmol");
  });

  it("should include products with yield", () => {
    const md = generateExperimentPage(mockExperiment, mockContext);
    expect(md).toContain("## Products");
    expect(md).toContain("[[4 Methoxybiphenyl]]");
    expect(md).toContain("85% yield");
  });

  it("should include procedure steps from actualProcedure", () => {
    const md = generateExperimentPage(mockExperiment, mockContext);
    expect(md).toContain("## Procedure");
    expect(md).toContain("1. Charge flask with substrate and catalyst");
    expect(md).toContain("2. Add solvent under nitrogen");
    expect(md).toContain("3. Heat to reflux");
  });

  it("should include step details (duration, temperature)", () => {
    const md = generateExperimentPage(mockExperiment, mockContext);
    expect(md).toContain("(RT)");
    expect(md).toContain("(5 min)");
    expect(md).toContain("(2 hours, 80\u00B0C)");
  });

  it("should fall back to plannedProcedure when actualProcedure is null", () => {
    const experimentWithPlanned: ExperimentData = {
      ...mockExperiment,
      actualProcedure: null,
      plannedProcedure: [
        { stepNumber: 1, action: "Planned step one" },
        { stepNumber: 2, action: "Planned step two" },
      ],
    };
    const md = generateExperimentPage(experimentWithPlanned, mockContext);
    expect(md).toContain("## Procedure");
    expect(md).toContain("1. Planned step one");
    expect(md).toContain("2. Planned step two");
  });

  it("should include practical notes with type labels", () => {
    const md = generateExperimentPage(mockExperiment, mockContext);
    expect(md).toContain("## Practical Notes");
    expect(md).toContain("**Deviation:**");
    expect(md).toContain("3x more catalyst");
    expect(md).toContain("**Observation:**");
    expect(md).toContain("Color change observed");
  });

  it("should include timestamp attribution for notes", () => {
    const md = generateExperimentPage(mockExperiment, mockContext);
    expect(md).toContain("Jane Doe, 2026-03-01");
  });

  it("should include related experiments as wikilinks", () => {
    const md = generateExperimentPage(mockExperiment, mockContext);
    expect(md).toContain("## Related Experiments");
    expect(md).toContain(
      "[[EXP-2024-005: Suzuki Coupling optimization]]"
    );
  });

  it("should omit conditions section when procedureMetadata is null", () => {
    const minimal: ExperimentData = {
      ...mockExperiment,
      procedureMetadata: null,
    };
    const md = generateExperimentPage(minimal, mockContext);
    expect(md).not.toContain("## Conditions");
  });

  it("should omit reagents section when reagents array is empty", () => {
    const minimal: ExperimentData = {
      ...mockExperiment,
      reagents: [],
    };
    const md = generateExperimentPage(minimal, mockContext);
    expect(md).not.toContain("## Reagents");
  });

  it("should omit products section when products array is empty", () => {
    const minimal: ExperimentData = {
      ...mockExperiment,
      products: [],
    };
    const md = generateExperimentPage(minimal, mockContext);
    expect(md).not.toContain("## Products");
  });

  it("should omit procedure section when both actual and planned are null", () => {
    const minimal: ExperimentData = {
      ...mockExperiment,
      actualProcedure: null,
      plannedProcedure: null,
    };
    const md = generateExperimentPage(minimal, mockContext);
    expect(md).not.toContain("## Procedure");
  });

  it("should omit practical notes section when practicalNotes is undefined", () => {
    const minimal: ExperimentData = {
      ...mockExperiment,
      practicalNotes: undefined,
    };
    const md = generateExperimentPage(minimal, mockContext);
    expect(md).not.toContain("## Practical Notes");
  });

  it("should omit practical notes section when practicalNotes is empty", () => {
    const minimal: ExperimentData = {
      ...mockExperiment,
      practicalNotes: [],
    };
    const md = generateExperimentPage(minimal, mockContext);
    expect(md).not.toContain("## Practical Notes");
  });

  it("should omit related experiments when none provided", () => {
    const noRelated: ExperimentData = {
      ...mockExperiment,
      relatedExperiments: undefined,
    };
    const contextNoRelated: ExperimentPageContext = {
      ...mockContext,
      relatedExperiments: undefined,
    };
    const md = generateExperimentPage(noRelated, contextNoRelated);
    expect(md).not.toContain("## Related Experiments");
  });

  it("should omit all optional sections for minimal data", () => {
    const minimal: ExperimentData = {
      id: "EXP-2024-099",
      title: "Minimal experiment",
      experimentType: "Unknown",
      status: "planned",
      createdBy: "user-2",
      createdAt: "2026-03-15T08:00:00Z",
      actualProcedure: null,
      procedureMetadata: null,
      reagents: [],
      products: [],
    };
    const minCtx: ExperimentPageContext = {
      researcherName: "John Smith",
      reactionType: "Unknown",
    };
    const md = generateExperimentPage(minimal, minCtx);

    expect(md).toContain("---");
    expect(md).toContain("page-type: experiment");
    expect(md).toContain("# EXP-2024-099: Minimal experiment");
    expect(md).not.toContain("## Conditions");
    expect(md).not.toContain("## Reagents");
    expect(md).not.toContain("## Products");
    expect(md).not.toContain("## Procedure");
    expect(md).not.toContain("## Practical Notes");
    expect(md).not.toContain("## Related Experiments");
  });

  it("should compute quality score and include it in tags", () => {
    const md = generateExperimentPage(mockExperiment, mockContext);
    // 85% yield -> score 4
    expect(md).toContain("quality:4");
  });

  it("should compute lower quality score when data is incomplete", () => {
    const incomplete: ExperimentData = {
      ...mockExperiment,
      actualProcedure: null,
      reagents: [],
      products: [
        {
          id: "p1",
          chemical: {
            id: "c3",
            name: "Product",
            casNumber: null,
            molecularFormula: null,
          },
          yield: 30,
          unit: "%",
        },
      ],
    };
    const md = generateExperimentPage(incomplete, mockContext);
    // 30% yield -> base 2, -1 no procedure, -1 no reagents -> quality:1
    expect(md).toContain("quality:1");
  });

  it("should use title as one-liner when objective is absent", () => {
    const noObjective: ExperimentData = {
      ...mockExperiment,
      objective: undefined,
    };
    const md = generateExperimentPage(noObjective, mockContext);
    expect(md).toContain("one-liner: Suzuki Coupling with 4-bromoanisole");
  });

  it("should handle products with null yield", () => {
    const nullYield: ExperimentData = {
      ...mockExperiment,
      products: [
        {
          id: "p1",
          chemical: {
            id: "c3",
            name: "Unknown Product",
            casNumber: null,
            molecularFormula: null,
          },
          yield: null,
          unit: "%",
        },
      ],
    };
    const md = generateExperimentPage(nullYield, mockContext);
    expect(md).toContain("[[Unknown Product]]");
    expect(md).not.toContain("% yield");
  });

  it("should generate complete markdown matching template structure", () => {
    const md = generateExperimentPage(mockExperiment, mockContext);
    const sections = md.split("\n## ");
    // frontmatter + title section, then Conditions, Reagents, Products, Procedure, Practical Notes, Related
    expect(sections.length).toBeGreaterThanOrEqual(7);
  });

  it("should handle reagent without role", () => {
    const noRole: ExperimentData = {
      ...mockExperiment,
      reagents: [
        {
          id: "r1",
          chemical: {
            id: "c1",
            name: "Some Chemical",
            casNumber: null,
            molecularFormula: null,
          },
          amount: 10,
          unit: "mg",
        },
      ],
    };
    const md = generateExperimentPage(noRole, mockContext);
    expect(md).toContain("[[Some Chemical]]");
    expect(md).not.toContain("(undefined)");
  });
});
