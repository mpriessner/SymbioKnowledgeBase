import { describe, it, expect } from "vitest";
import { generateChemicalPage } from "@/lib/chemEln/generators/chemical";
import { generateReactionTypePage } from "@/lib/chemEln/generators/reactionType";
import { generateResearcherPage } from "@/lib/chemEln/generators/researcher";
import { generateSubstrateClassPage } from "@/lib/chemEln/generators/substrateClass";
import type {
  ChemicalData,
  ChemicalUsage,
  ReactionTypeAggregation,
  ResearcherProfileData,
  SubstrateClassAggregation,
} from "@/lib/chemEln/types";

// ---------------------------------------------------------------------------
// Chemical Page Generator
// ---------------------------------------------------------------------------

describe("generateChemicalPage", () => {
  const palladiumAcetate: ChemicalData = {
    id: "c1",
    name: "Palladium Acetate",
    casNumber: "3375-31-3",
    molecularFormula: "C4H6O4Pd",
    molecularWeight: 224.51,
    synonyms: ["Pd(OAc)2"],
  };

  const usages: ChemicalUsage[] = [
    {
      experimentId: "EXP-001",
      experimentTitle: "Suzuki coupling of 4-bromoanisole",
      role: "catalyst",
      amount: 5,
      unit: "mol%",
    },
    {
      experimentId: "EXP-002",
      experimentTitle: "Heck reaction optimization",
      role: "catalyst",
      amount: 3,
      unit: "mol%",
    },
    {
      experimentId: "EXP-003",
      experimentTitle: "Pd-mediated cyclization",
      role: "reagent",
      amount: 0.5,
      unit: "mmol",
    },
  ];

  it("should produce valid frontmatter with page-type chemical", () => {
    const md = generateChemicalPage(palladiumAcetate, usages);
    expect(md).toMatch(/^---\n/);
    expect(md).toContain("page-type: chemical");
    expect(md).toContain("cas:3375-31-3");
  });

  it("should include CAS number and molecular formula in properties", () => {
    const md = generateChemicalPage(palladiumAcetate, usages);
    expect(md).toContain("**CAS Number:** 3375-31-3");
    expect(md).toContain("**Molecular Formula:** C4H6O4Pd");
    expect(md).toContain("**Molecular Weight:** 224.51 g/mol");
  });

  it("should include synonyms", () => {
    const md = generateChemicalPage(palladiumAcetate, usages);
    expect(md).toContain("Pd(OAc)2");
  });

  it("should have Used In section with experiment wikilinks", () => {
    const md = generateChemicalPage(palladiumAcetate, usages);
    expect(md).toContain("## Used In");
    expect(md).toContain(
      "[[EXP-001: Suzuki coupling of 4-bromoanisole]]"
    );
    expect(md).toContain("[[EXP-002: Heck reaction optimization]]");
  });

  it("should group usages by role", () => {
    const md = generateChemicalPage(palladiumAcetate, usages);
    expect(md).toContain("### As Catalyst");
    expect(md).toContain("### As Reagent");
  });

  it("should show amount and unit for each usage", () => {
    const md = generateChemicalPage(palladiumAcetate, usages);
    expect(md).toContain("5 mol%");
    expect(md).toContain("3 mol%");
    expect(md).toContain("0.5 mmol");
  });

  it("should include yield when present on a usage", () => {
    const usageWithYield: ChemicalUsage[] = [
      {
        experimentId: "EXP-004",
        experimentTitle: "Product isolation",
        role: "product",
        amount: 150,
        unit: "mg",
        yield: 85,
      },
    ];
    const md = generateChemicalPage(palladiumAcetate, usageWithYield);
    expect(md).toContain("85% yield");
  });

  it("should omit Used In section when usages is empty", () => {
    const md = generateChemicalPage(palladiumAcetate, []);
    expect(md).not.toContain("## Used In");
  });

  it("should omit properties section when no properties are available", () => {
    const minimal: ChemicalData = { id: "c2", name: "Unknown Compound" };
    const md = generateChemicalPage(minimal, []);
    expect(md).not.toContain("## Properties");
  });

  it("should omit CAS tag when casNumber is absent", () => {
    const noCas: ChemicalData = {
      id: "c3",
      name: "Mystery Reagent",
      molecularFormula: "C2H6",
    };
    const md = generateChemicalPage(noCas, []);
    expect(md).not.toContain("cas:");
  });

  it("should handle chemical with only a name", () => {
    const minimal: ChemicalData = { id: "c4", name: "Sodium Chloride" };
    const md = generateChemicalPage(minimal, []);
    expect(md).toContain("# Sodium Chloride");
    expect(md).toContain("page-type: chemical");
    expect(md).toMatch(/^---\n/);
  });
});

// ---------------------------------------------------------------------------
// Reaction Type Page Generator
// ---------------------------------------------------------------------------

describe("generateReactionTypePage", () => {
  const suzukiData: ReactionTypeAggregation = {
    name: "Suzuki Coupling",
    experimentCount: 25,
    avgYield: 78.5,
    researcherCount: 3,
    experiments: [
      {
        id: "EXP-001",
        title: "Suzuki with aryl bromide",
        yield: 85,
        researcher: "Jane Doe",
        date: "2026-03-01",
      },
      {
        id: "EXP-002",
        title: "Suzuki with aryl chloride",
        yield: 62,
        researcher: "John Smith",
        date: "2026-02-15",
      },
    ],
    keyLearnings: [
      {
        content: "Use fresh catalyst for best results",
        researcherName: "Jane Doe",
        experimentId: "EXP-001",
        date: "2026-03-01",
        qualityScore: 5,
      },
      {
        content: "Degassing the solvent improves reproducibility",
        researcherName: "John Smith",
        experimentId: "EXP-002",
        date: "2026-02-15",
        qualityScore: 3,
      },
    ],
    commonPitfalls: [
      "Catalyst deactivation in air",
      "Protodeboronation with electron-rich substrates",
    ],
    topResearchers: [
      { name: "Jane Doe", experimentCount: 15, avgYield: 82.3 },
      { name: "John Smith", experimentCount: 8, avgYield: 71.0 },
    ],
  };

  it("should produce valid frontmatter with reaction tag", () => {
    const md = generateReactionTypePage(suzukiData);
    expect(md).toMatch(/^---\n/);
    expect(md).toContain("page-type: reaction-type");
    expect(md).toContain("reaction:suzuki-coupling");
  });

  it("should include institutional experience stats", () => {
    const md = generateReactionTypePage(suzukiData);
    expect(md).toContain("## Institutional Experience");
    expect(md).toContain("**25 experiments**");
    expect(md).toContain("**78.5%**");
    expect(md).toContain("3 researchers");
  });

  it("should include key learnings ranked by quality score", () => {
    const md = generateReactionTypePage(suzukiData);
    expect(md).toContain("## Key Learnings");
    expect(md).toContain("Use fresh catalyst for best results");
    expect(md).toContain("Degassing the solvent");
    // Higher quality score first
    const freshIdx = md.indexOf("Use fresh catalyst");
    const degasIdx = md.indexOf("Degassing the solvent");
    expect(freshIdx).toBeLessThan(degasIdx);
  });

  it("should attribute key learnings to researchers with wikilinks", () => {
    const md = generateReactionTypePage(suzukiData);
    expect(md).toContain("[[Jane Doe]]");
    expect(md).toContain("[[John Smith]]");
  });

  it("should include common pitfalls", () => {
    const md = generateReactionTypePage(suzukiData);
    expect(md).toContain("## Common Pitfalls");
    expect(md).toContain("Catalyst deactivation in air");
    expect(md).toContain("Protodeboronation");
  });

  it("should include Who To Ask table with researcher wikilinks", () => {
    const md = generateReactionTypePage(suzukiData);
    expect(md).toContain("## Who To Ask");
    expect(md).toContain("[[Jane Doe]]");
    expect(md).toContain("15");
    expect(md).toContain("82.3%");
  });

  it("should include recent experiments with wikilinks", () => {
    const md = generateReactionTypePage(suzukiData);
    expect(md).toContain("## Recent Experiments");
    expect(md).toContain("[[EXP-001: Suzuki with aryl bromide]]");
  });

  it("should omit key learnings when empty", () => {
    const noLearnings = { ...suzukiData, keyLearnings: [] };
    const md = generateReactionTypePage(noLearnings);
    expect(md).not.toContain("## Key Learnings");
  });

  it("should omit common pitfalls when empty", () => {
    const noPitfalls = { ...suzukiData, commonPitfalls: [] };
    const md = generateReactionTypePage(noPitfalls);
    expect(md).not.toContain("## Common Pitfalls");
  });

  it("should omit Who To Ask when empty", () => {
    const noResearchers = { ...suzukiData, topResearchers: [] };
    const md = generateReactionTypePage(noResearchers);
    expect(md).not.toContain("## Who To Ask");
  });

  it("should omit recent experiments when empty", () => {
    const noExperiments = { ...suzukiData, experiments: [] };
    const md = generateReactionTypePage(noExperiments);
    expect(md).not.toContain("## Recent Experiments");
  });
});

// ---------------------------------------------------------------------------
// Researcher Page Generator
// ---------------------------------------------------------------------------

describe("generateResearcherPage", () => {
  const janeProfile: ResearcherProfileData = {
    name: "Jane Doe",
    email: "jane@lab.org",
    totalExperiments: 45,
    topReactionTypes: [
      { name: "Suzuki Coupling", count: 15, avgYield: 82.3 },
      { name: "Heck Reaction", count: 10, avgYield: 75.0 },
    ],
    recentExperiments: [
      {
        id: "EXP-001",
        title: "Suzuki with aryl bromide",
        date: "2026-03-01",
        reactionType: "Suzuki Coupling",
      },
      {
        id: "EXP-010",
        title: "Heck reaction scale-up",
        date: "2026-02-20",
        reactionType: "Heck Reaction",
      },
    ],
    keyContributions: [
      "Pioneered microwave-assisted Suzuki protocol",
      "Developed new catalyst screening workflow",
    ],
  };

  it("should produce valid frontmatter with researcher tag", () => {
    const md = generateResearcherPage(janeProfile);
    expect(md).toMatch(/^---\n/);
    expect(md).toContain("page-type: researcher");
    expect(md).toContain("researcher:jane-doe");
  });

  it("should include expertise areas table with wikilinks", () => {
    const md = generateResearcherPage(janeProfile);
    expect(md).toContain("## Expertise Areas");
    expect(md).toContain("[[Suzuki Coupling]]");
    expect(md).toContain("[[Heck Reaction]]");
    expect(md).toContain("15");
    expect(md).toContain("82.3%");
  });

  it("should include recent experiments with wikilinks", () => {
    const md = generateResearcherPage(janeProfile);
    expect(md).toContain("## Recent Experiments");
    expect(md).toContain("[[EXP-001: Suzuki with aryl bromide]]");
    expect(md).toContain("[[Suzuki Coupling]]");
  });

  it("should include key contributions", () => {
    const md = generateResearcherPage(janeProfile);
    expect(md).toContain("## Key Contributions");
    expect(md).toContain("Pioneered microwave-assisted Suzuki protocol");
    expect(md).toContain("Developed new catalyst screening workflow");
  });

  it("should include one-liner with experiment count", () => {
    const md = generateResearcherPage(janeProfile);
    expect(md).toContain("45 experiments across 2 reaction types");
  });

  it("should omit expertise areas when empty", () => {
    const noExpertise = { ...janeProfile, topReactionTypes: [] };
    const md = generateResearcherPage(noExpertise);
    expect(md).not.toContain("## Expertise Areas");
  });

  it("should omit recent experiments when empty", () => {
    const noRecent = { ...janeProfile, recentExperiments: [] };
    const md = generateResearcherPage(noRecent);
    expect(md).not.toContain("## Recent Experiments");
  });

  it("should omit key contributions when empty", () => {
    const noContributions = { ...janeProfile, keyContributions: [] };
    const md = generateResearcherPage(noContributions);
    expect(md).not.toContain("## Key Contributions");
  });

  it("should handle researcher with minimal data", () => {
    const minimal: ResearcherProfileData = {
      name: "New Researcher",
      totalExperiments: 0,
      topReactionTypes: [],
      recentExperiments: [],
      keyContributions: [],
    };
    const md = generateResearcherPage(minimal);
    expect(md).toContain("# New Researcher");
    expect(md).toContain("page-type: researcher");
    expect(md).not.toContain("## Expertise Areas");
    expect(md).not.toContain("## Recent Experiments");
    expect(md).not.toContain("## Key Contributions");
  });
});

// ---------------------------------------------------------------------------
// Substrate Class Page Generator
// ---------------------------------------------------------------------------

describe("generateSubstrateClassPage", () => {
  const arylHalides: SubstrateClassAggregation = {
    name: "Aryl Halides",
    experimentCount: 42,
    challenges: [
      "Electron-poor substrates require higher catalyst loading",
      "Ortho-substituted substrates are sterically challenging",
    ],
    whatWorked: [
      {
        description: "Use Pd(dppf)Cl2 for electron-poor substrates",
        experimentId: "EXP-001",
        experimentTitle: "Suzuki with electron-poor aryl bromide",
      },
      {
        description: "Microwave heating improves conversion for ortho-substituted",
        experimentId: "EXP-005",
        experimentTitle: "Microwave Suzuki optimization",
      },
    ],
    researchers: [
      { name: "Jane Doe", experimentCount: 20 },
      { name: "John Smith", experimentCount: 15 },
    ],
  };

  it("should produce valid frontmatter with substrate-class tag", () => {
    const md = generateSubstrateClassPage(arylHalides);
    expect(md).toMatch(/^---\n/);
    expect(md).toContain("page-type: substrate-class");
    expect(md).toContain("substrate-class:aryl-halides");
  });

  it("should include known challenges", () => {
    const md = generateSubstrateClassPage(arylHalides);
    expect(md).toContain("## Known Challenges");
    expect(md).toContain("Electron-poor substrates require higher catalyst loading");
    expect(md).toContain("Ortho-substituted substrates are sterically challenging");
  });

  it("should include What Worked with experiment wikilinks", () => {
    const md = generateSubstrateClassPage(arylHalides);
    expect(md).toContain("## What Worked");
    expect(md).toContain("Use Pd(dppf)Cl2 for electron-poor substrates");
    expect(md).toContain(
      "[[EXP-001: Suzuki with electron-poor aryl bromide]]"
    );
  });

  it("should include Who Has Experience with researcher wikilinks", () => {
    const md = generateSubstrateClassPage(arylHalides);
    expect(md).toContain("## Who Has Experience");
    expect(md).toContain("[[Jane Doe]]");
    expect(md).toContain("20 experiments");
    expect(md).toContain("[[John Smith]]");
  });

  it("should omit challenges section when empty", () => {
    const noChallenges = { ...arylHalides, challenges: [] };
    const md = generateSubstrateClassPage(noChallenges);
    expect(md).not.toContain("## Known Challenges");
  });

  it("should omit What Worked when empty", () => {
    const noWhatWorked = { ...arylHalides, whatWorked: [] };
    const md = generateSubstrateClassPage(noWhatWorked);
    expect(md).not.toContain("## What Worked");
  });

  it("should omit Who Has Experience when empty", () => {
    const noResearchers = { ...arylHalides, researchers: [] };
    const md = generateSubstrateClassPage(noResearchers);
    expect(md).not.toContain("## Who Has Experience");
  });

  it("should include one-liner with successful approach count", () => {
    const md = generateSubstrateClassPage(arylHalides);
    expect(md).toContain("2 successful approaches");
  });

  it("should handle substrate class with minimal data", () => {
    const minimal: SubstrateClassAggregation = {
      name: "Unknown Substrates",
      challenges: [],
      whatWorked: [],
      researchers: [],
    };
    const md = generateSubstrateClassPage(minimal);
    expect(md).toContain("# Unknown Substrates");
    expect(md).toContain("page-type: substrate-class");
    expect(md).not.toContain("## Known Challenges");
    expect(md).not.toContain("## What Worked");
    expect(md).not.toContain("## Who Has Experience");
  });
});
