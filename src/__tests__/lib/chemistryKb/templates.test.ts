import { describe, test, expect } from "vitest";
import {
  generateExperimentPage,
  generateChemicalPage,
  generateReactionTypePage,
  generateResearcherPage,
  generateSubstrateClassPage,
  type ExperimentPageData,
  type ChemicalPageData,
  type ReactionTypePageData,
  type ResearcherPageData,
  type SubstrateClassPageData,
} from "@/lib/chemistryKb/templates";

// ---------------------------------------------------------------------------
// Test data fixtures
// ---------------------------------------------------------------------------

const experimentData: ExperimentPageData = {
  title: "EXP-2026-0042: Suzuki Coupling of 4-Bromopyridine",
  elnId: "EXP-2026-0042",
  researcher: "Dr. Anna Mueller",
  date: "2026-03-15",
  status: "completed",
  reactionType: "Suzuki Coupling",
  substrateClass: "Heteroaryl Halides",
  scaleCategory: "medium",
  scaleMmol: "5.0 mmol",
  qualityScore: 4,
  summary: "Successful Suzuki coupling achieving 82% yield.",
  conditions: [
    { parameter: "Temperature", value: "80 °C", notes: "Reflux" },
    { parameter: "Solvent", value: "THF/H2O (3:1)", notes: "20 mL" },
    { parameter: "Atmosphere", value: "Nitrogen" },
    { parameter: "Duration", value: "4 hours" },
  ],
  reagents: [
    { name: "4-Bromopyridine", amount: "790 mg", equivalents: "1.0 eq", cas: "1120-87-2" },
    { name: "Phenylboronic Acid", amount: "731 mg", equivalents: "1.2 eq", cas: "98-80-6" },
    { name: "Pd(PPh3)4", amount: "173 mg", equivalents: "3 mol%", cas: "14221-01-3" },
  ],
  procedureSetup: ["Flame-dried flask under nitrogen", "Added starting material"],
  procedureReaction: ["Added catalyst", "Heated to 80 °C", "Stirred for 4 hours"],
  procedureWorkup: ["Cooled to RT", "Extracted with EtOAc"],
  procedurePurification: ["Column chromatography (EtOAc/hexanes)"],
  results: { yield: "82% (636 mg)", purity: ">97% (NMR)", characterization: "1H NMR, 13C NMR, HRMS" },
  productAppearance: "White solid",
  practicalNotesWorked: ["Freshly distilled THF improved yield"],
  practicalNotesChallenges: ["Protodeboronation at higher temperatures"],
  practicalNotesRecommendations: ["Use boronic acid pinacol ester for better stability"],
  substrateInsights: ["4-Bromopyridine more reactive than 2-bromopyridine"],
  relatedExperiments: [
    { elnId: "EXP-2026-0038", description: "Same substrate, different catalyst" },
  ],
  relatedChemicals: ["4-Bromopyridine", "Phenylboronic Acid", "Pd(PPh3)4"],
};

const chemicalData: ChemicalPageData = {
  name: "Pd(PPh3)4",
  casNumber: "14221-01-3",
  molecularFormula: "C72H60P4Pd",
  molecularWeight: 1155.56,
  commonSynonyms: ["Tetrakis(triphenylphosphine)palladium(0)", "Tetrakis"],
  summary: "Palladium(0) catalyst for cross-coupling reactions.",
  appearance: "Bright yellow powder",
  storageNotes: ["Store at 2-8 °C under argon"],
  handlingNotes: ["Air-sensitive, weigh under nitrogen"],
  institutionalKnowledge: ["Sigma-Aldrich preferred vendor"],
  usedInExperiments: [
    { elnId: "EXP-2026-0042", description: "Suzuki coupling, 82% yield" },
  ],
  relatedReactionTypes: ["Suzuki Coupling", "Heck Reaction"],
  relatedResearchers: ["Dr. Anna Mueller"],
};

const reactionTypeData: ReactionTypePageData = {
  name: "Suzuki Coupling",
  experimentCount: 24,
  avgYield: 76,
  successRate: "88% (21/24)",
  researcherCount: 4,
  summary: "Pd-catalyzed cross-coupling of organoboron compounds.",
  whatWorksWell: ["Pd(PPh3)4 at 3 mol% in THF/H2O"],
  commonPitfalls: ["Protodeboronation at high temperature"],
  substrateAdvice: [
    { substrateClass: "Heteroaryl Halides", advice: "Higher catalyst loading needed" },
  ],
  whoToAsk: [
    { researcher: "Dr. Anna Mueller", expertise: "Heteroaryl substrates" },
  ],
  representativeExperiments: [
    { elnId: "EXP-2026-0042", description: "Standard protocol, 82% yield" },
  ],
  relatedReactionTypes: ["Heck Reaction", "Stille Coupling"],
  commonCatalysts: ["Pd(PPh3)4", "Pd(dppf)Cl2"],
};

const researcherData: ResearcherPageData = {
  name: "Dr. Anna Mueller",
  email: "anna.mueller@institution.edu",
  experimentCount: 47,
  primaryExpertise: ["Suzuki Coupling", "Heteroaryl Halides"],
  summary: "Senior researcher specializing in palladium-catalyzed cross-coupling.",
  expertiseAreas: [
    { area: "Suzuki Coupling", description: "18 experiments, developed optimized protocol" },
  ],
  recentExperiments: [
    { elnId: "EXP-2026-0042", description: "Suzuki coupling, 82% yield" },
  ],
  notableResults: ["Consistent >80% yields for heteroaryl Suzuki couplings"],
  institutionalKnowledge: ["Established lab standard protocol for Suzuki coupling"],
  whenToAsk: "Palladium catalysis and heteroaryl substrates",
};

const substrateClassData: SubstrateClassPageData = {
  name: "Heteroaryl Halides",
  experimentCount: 31,
  summary: "Aromatic heterocyclic compounds bearing halide leaving groups.",
  commonChallenges: ["Nitrogen coordination to catalyst"],
  successfulStrategies: ["Pd(PPh3)4 at 3-5 mol% with K2CO3 base"],
  reactionAdvice: [
    { reactionType: "Suzuki Coupling", advice: "Higher catalyst loading for 2-halopyridines" },
  ],
  whoHasExperience: [
    { researcher: "Dr. Anna Mueller", knowledge: "Expert on pyridine substrates" },
  ],
  representativeExperiments: [
    { elnId: "EXP-2026-0042", description: "4-Bromopyridine coupling, 82% yield" },
  ],
  relatedSubstrateClasses: ["Electron-Deficient Arenes"],
  commonReactions: ["Suzuki Coupling", "Heck Reaction"],
};

// ---------------------------------------------------------------------------
// Frontmatter helpers
// ---------------------------------------------------------------------------

function extractFrontmatter(md: string): string {
  const match = md.match(/^---\n([\s\S]*?)\n---/);
  return match ? match[1] : "";
}

function hasFrontmatterField(md: string, field: string): boolean {
  const fm = extractFrontmatter(md);
  return fm.includes(`${field}:`);
}

function hasSection(md: string, heading: string): boolean {
  return md.includes(`## ${heading}`) || md.includes(`### ${heading}`);
}

function hasWikilink(md: string, target: string): boolean {
  return md.includes(`[[${target}]]`);
}

function isValidFrontmatter(md: string): boolean {
  return md.startsWith("---\n") && md.includes("\n---\n");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("generateExperimentPage", () => {
  const output = generateExperimentPage(experimentData);

  test("produces valid frontmatter", () => {
    expect(isValidFrontmatter(output)).toBe(true);
  });

  test("includes all required frontmatter fields", () => {
    expect(hasFrontmatterField(output, "title")).toBe(true);
    expect(hasFrontmatterField(output, "icon")).toBe(true);
    expect(hasFrontmatterField(output, "tags")).toBe(true);
    expect(hasFrontmatterField(output, "eln_id")).toBe(true);
    expect(hasFrontmatterField(output, "researcher")).toBe(true);
    expect(hasFrontmatterField(output, "date")).toBe(true);
    expect(hasFrontmatterField(output, "status")).toBe(true);
    expect(hasFrontmatterField(output, "scale_category")).toBe(true);
    expect(hasFrontmatterField(output, "quality_score")).toBe(true);
  });

  test("includes optional frontmatter fields when provided", () => {
    expect(hasFrontmatterField(output, "reaction_type")).toBe(true);
    expect(hasFrontmatterField(output, "substrate_class")).toBe(true);
  });

  test("includes experiment icon", () => {
    expect(output).toContain('icon: "🧪"');
  });

  test("includes all required sections", () => {
    expect(hasSection(output, "Metadata")).toBe(true);
    expect(hasSection(output, "Reaction Conditions")).toBe(true);
    expect(hasSection(output, "Reagents")).toBe(true);
    expect(hasSection(output, "Procedure")).toBe(true);
    expect(hasSection(output, "Results")).toBe(true);
    expect(hasSection(output, "Practical Notes")).toBe(true);
    expect(hasSection(output, "Related Experiments")).toBe(true);
    expect(hasSection(output, "Related Pages")).toBe(true);
  });

  test("includes one-liner summary", () => {
    expect(output).toContain("> One-liner summary:");
    expect(output).toContain(experimentData.summary);
  });

  test("includes wikilinks to researcher", () => {
    expect(hasWikilink(output, "Dr. Anna Mueller")).toBe(true);
  });

  test("includes wikilinks to reaction type", () => {
    expect(hasWikilink(output, "Suzuki Coupling")).toBe(true);
  });

  test("includes wikilinks to substrate class", () => {
    expect(hasWikilink(output, "Heteroaryl Halides")).toBe(true);
  });

  test("includes wikilinks to reagents", () => {
    expect(hasWikilink(output, "4-Bromopyridine")).toBe(true);
    expect(hasWikilink(output, "Phenylboronic Acid")).toBe(true);
    expect(hasWikilink(output, "Pd(PPh3)4")).toBe(true);
  });

  test("includes wikilinks to related experiments", () => {
    expect(hasWikilink(output, "EXP-2026-0038")).toBe(true);
  });

  test("includes conditions table with all entries", () => {
    expect(output).toContain("| **Temperature** |");
    expect(output).toContain("| **Solvent** |");
    expect(output).toContain("| **Atmosphere** |");
    expect(output).toContain("| **Duration** |");
  });

  test("includes procedure steps", () => {
    expect(output).toContain("1. Flame-dried flask under nitrogen");
    expect(output).toContain("1. Added catalyst");
  });

  test("includes yield in results", () => {
    expect(output).toContain("82% (636 mg)");
  });

  test("includes practical notes content", () => {
    expect(output).toContain("Freshly distilled THF improved yield");
    expect(output).toContain("Protodeboronation at higher temperatures");
  });

  test("auto-generates tags from data", () => {
    expect(output).toContain("eln:EXP-2026-0042");
    expect(output).toContain("reaction:suzuki-coupling");
    expect(output).toContain("scale:medium");
    expect(output).toContain("quality:4");
  });
});

describe("generateChemicalPage", () => {
  const output = generateChemicalPage(chemicalData);

  test("produces valid frontmatter", () => {
    expect(isValidFrontmatter(output)).toBe(true);
  });

  test("includes all required frontmatter fields", () => {
    expect(hasFrontmatterField(output, "title")).toBe(true);
    expect(hasFrontmatterField(output, "icon")).toBe(true);
    expect(hasFrontmatterField(output, "tags")).toBe(true);
    expect(hasFrontmatterField(output, "cas_number")).toBe(true);
  });

  test("includes optional frontmatter fields when provided", () => {
    expect(hasFrontmatterField(output, "molecular_weight")).toBe(true);
    expect(hasFrontmatterField(output, "common_synonyms")).toBe(true);
  });

  test("includes chemical icon", () => {
    expect(output).toContain('icon: "⚗️"');
  });

  test("includes all required sections", () => {
    expect(hasSection(output, "Properties")).toBe(true);
    expect(hasSection(output, "Practical Usage Notes")).toBe(true);
    expect(hasSection(output, "Used In Experiments")).toBe(true);
    expect(hasSection(output, "Related Pages")).toBe(true);
  });

  test("includes one-liner summary", () => {
    expect(output).toContain("> One-liner:");
  });

  test("includes CAS number in properties table", () => {
    expect(output).toContain("14221-01-3");
  });

  test("includes molecular weight", () => {
    expect(output).toContain("1155.56");
  });

  test("includes synonyms", () => {
    expect(output).toContain("Tetrakis");
  });

  test("includes wikilinks to experiments", () => {
    expect(hasWikilink(output, "EXP-2026-0042")).toBe(true);
  });

  test("includes wikilinks to reaction types", () => {
    expect(hasWikilink(output, "Suzuki Coupling")).toBe(true);
    expect(hasWikilink(output, "Heck Reaction")).toBe(true);
  });

  test("includes wikilinks to researchers", () => {
    expect(hasWikilink(output, "Dr. Anna Mueller")).toBe(true);
  });

  test("includes cas tag", () => {
    expect(output).toContain("cas:14221-01-3");
  });
});

describe("generateReactionTypePage", () => {
  const output = generateReactionTypePage(reactionTypeData);

  test("produces valid frontmatter", () => {
    expect(isValidFrontmatter(output)).toBe(true);
  });

  test("includes all required frontmatter fields", () => {
    expect(hasFrontmatterField(output, "title")).toBe(true);
    expect(hasFrontmatterField(output, "icon")).toBe(true);
    expect(hasFrontmatterField(output, "tags")).toBe(true);
    expect(hasFrontmatterField(output, "experiment_count")).toBe(true);
    expect(hasFrontmatterField(output, "researcher_count")).toBe(true);
  });

  test("includes optional avg_yield", () => {
    expect(hasFrontmatterField(output, "avg_yield")).toBe(true);
  });

  test("includes reaction type icon", () => {
    expect(output).toContain('icon: "🔬"');
  });

  test("includes all required sections", () => {
    expect(hasSection(output, "Institutional Experience")).toBe(true);
    expect(hasSection(output, "Key Learnings")).toBe(true);
    expect(hasSection(output, "What Works Well")).toBe(true);
    expect(hasSection(output, "Common Pitfalls")).toBe(true);
    expect(hasSection(output, "Who to Ask")).toBe(true);
    expect(hasSection(output, "Representative Experiments")).toBe(true);
    expect(hasSection(output, "Related Pages")).toBe(true);
  });

  test("includes one-liner summary", () => {
    expect(output).toContain("> One-liner:");
  });

  test("includes experiment count", () => {
    expect(output).toContain("24");
  });

  test("includes wikilinks to substrate classes", () => {
    expect(hasWikilink(output, "Heteroaryl Halides")).toBe(true);
  });

  test("includes wikilinks to researchers", () => {
    expect(hasWikilink(output, "Dr. Anna Mueller")).toBe(true);
  });

  test("includes wikilinks to experiments", () => {
    expect(hasWikilink(output, "EXP-2026-0042")).toBe(true);
  });

  test("includes wikilinks to related reaction types", () => {
    expect(hasWikilink(output, "Heck Reaction")).toBe(true);
    expect(hasWikilink(output, "Stille Coupling")).toBe(true);
  });

  test("includes wikilinks to catalysts", () => {
    expect(hasWikilink(output, "Pd(PPh3)4")).toBe(true);
    expect(hasWikilink(output, "Pd(dppf)Cl2")).toBe(true);
  });
});

describe("generateResearcherPage", () => {
  const output = generateResearcherPage(researcherData);

  test("produces valid frontmatter", () => {
    expect(isValidFrontmatter(output)).toBe(true);
  });

  test("includes all required frontmatter fields", () => {
    expect(hasFrontmatterField(output, "title")).toBe(true);
    expect(hasFrontmatterField(output, "icon")).toBe(true);
    expect(hasFrontmatterField(output, "tags")).toBe(true);
    expect(hasFrontmatterField(output, "experiment_count")).toBe(true);
  });

  test("includes optional frontmatter fields when provided", () => {
    expect(hasFrontmatterField(output, "email")).toBe(true);
    expect(hasFrontmatterField(output, "primary_expertise")).toBe(true);
  });

  test("includes researcher icon", () => {
    expect(output).toContain('icon: "👩‍🔬"');
  });

  test("includes all required sections", () => {
    expect(hasSection(output, "Expertise Areas")).toBe(true);
    expect(hasSection(output, "Recent Experiments")).toBe(true);
    expect(hasSection(output, "Key Contributions")).toBe(true);
    expect(hasSection(output, "Contact")).toBe(true);
  });

  test("includes one-liner summary", () => {
    expect(output).toContain("> One-liner:");
  });

  test("includes email in contact section", () => {
    expect(output).toContain("anna.mueller@institution.edu");
  });

  test("includes wikilinks to expertise areas", () => {
    expect(hasWikilink(output, "Suzuki Coupling")).toBe(true);
  });

  test("includes wikilinks to experiments", () => {
    expect(hasWikilink(output, "EXP-2026-0042")).toBe(true);
  });

  test("includes when to ask info", () => {
    expect(output).toContain("Palladium catalysis and heteroaryl substrates");
  });
});

describe("generateSubstrateClassPage", () => {
  const output = generateSubstrateClassPage(substrateClassData);

  test("produces valid frontmatter", () => {
    expect(isValidFrontmatter(output)).toBe(true);
  });

  test("includes all required frontmatter fields", () => {
    expect(hasFrontmatterField(output, "title")).toBe(true);
    expect(hasFrontmatterField(output, "icon")).toBe(true);
    expect(hasFrontmatterField(output, "tags")).toBe(true);
    expect(hasFrontmatterField(output, "experiment_count")).toBe(true);
  });

  test("includes substrate class icon", () => {
    expect(output).toContain('icon: "🧬"');
  });

  test("includes all required sections", () => {
    expect(hasSection(output, "Common Challenges")).toBe(true);
    expect(hasSection(output, "What Worked")).toBe(true);
    expect(hasSection(output, "Who Has Experience")).toBe(true);
    expect(hasSection(output, "Representative Experiments")).toBe(true);
    expect(hasSection(output, "Related Pages")).toBe(true);
  });

  test("includes one-liner summary", () => {
    expect(output).toContain("> One-liner:");
  });

  test("includes wikilinks to reaction types", () => {
    expect(hasWikilink(output, "Suzuki Coupling")).toBe(true);
    expect(hasWikilink(output, "Heck Reaction")).toBe(true);
  });

  test("includes wikilinks to researchers", () => {
    expect(hasWikilink(output, "Dr. Anna Mueller")).toBe(true);
  });

  test("includes wikilinks to experiments", () => {
    expect(hasWikilink(output, "EXP-2026-0042")).toBe(true);
  });

  test("includes wikilinks to related substrate classes", () => {
    expect(hasWikilink(output, "Electron-Deficient Arenes")).toBe(true);
  });

  test("includes challenges content", () => {
    expect(output).toContain("Nitrogen coordination to catalyst");
  });

  test("includes strategies content", () => {
    expect(output).toContain("Pd(PPh3)4 at 3-5 mol%");
  });
});

describe("template generators handle minimal data", () => {
  test("experiment page with no optional fields", () => {
    const minimal: ExperimentPageData = {
      title: "EXP-2026-0001: Minimal Experiment",
      elnId: "EXP-2026-0001",
      researcher: "Dr. Test User",
      date: "2026-01-01",
      status: "planned",
      scaleCategory: "small",
      qualityScore: 1,
      summary: "A minimal test experiment.",
      conditions: [],
      reagents: [],
      procedureSetup: ["Step 1"],
      procedureReaction: ["Step 1"],
      procedureWorkup: ["Step 1"],
      procedurePurification: ["Step 1"],
      results: { yield: "N/A" },
    };
    const output = generateExperimentPage(minimal);
    expect(isValidFrontmatter(output)).toBe(true);
    expect(hasSection(output, "Metadata")).toBe(true);
    expect(hasSection(output, "Practical Notes")).toBe(true);
    expect(output).toContain("No notes yet");
  });

  test("chemical page with no optional fields", () => {
    const minimal: ChemicalPageData = {
      name: "Test Chemical",
      casNumber: "000-00-0",
      summary: "A test chemical.",
    };
    const output = generateChemicalPage(minimal);
    expect(isValidFrontmatter(output)).toBe(true);
    expect(hasSection(output, "Properties")).toBe(true);
    expect(output).toContain("No storage notes yet");
  });

  test("reaction type page with no optional fields", () => {
    const minimal: ReactionTypePageData = {
      name: "Test Reaction",
      experimentCount: 0,
      researcherCount: 0,
      summary: "A test reaction.",
    };
    const output = generateReactionTypePage(minimal);
    expect(isValidFrontmatter(output)).toBe(true);
    expect(hasSection(output, "Key Learnings")).toBe(true);
    expect(output).toContain("No learnings documented yet");
  });

  test("researcher page with no optional fields", () => {
    const minimal: ResearcherPageData = {
      name: "Test Researcher",
      experimentCount: 0,
      summary: "A test researcher.",
    };
    const output = generateResearcherPage(minimal);
    expect(isValidFrontmatter(output)).toBe(true);
    expect(hasSection(output, "Expertise Areas")).toBe(true);
  });

  test("substrate class page with no optional fields", () => {
    const minimal: SubstrateClassPageData = {
      name: "Test Substrate Class",
      experimentCount: 0,
      summary: "A test substrate class.",
    };
    const output = generateSubstrateClassPage(minimal);
    expect(isValidFrontmatter(output)).toBe(true);
    expect(hasSection(output, "Common Challenges")).toBe(true);
    expect(output).toContain("No challenges documented yet");
  });
});
