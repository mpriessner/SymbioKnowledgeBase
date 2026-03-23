import { describe, test, expect } from "vitest";
import {
  transformExperiment,
  generateElnId,
  generateExperimentTitle,
  determineScaleCategory,
  extractChemicalWikilinks,
  generateTags,
  normalizeStatus,
  parseProcedure,
  parsePracticalNotes,
  formatReagents,
} from "@/lib/chemEln/experimentTransformer";
import type { RawExperimentData, RawChemical } from "@/lib/chemEln/fetcherTypes";

function makeRawExperiment(overrides: Partial<RawExperimentData> = {}): RawExperimentData {
  return {
    id: "exp-0042",
    title: "Suzuki Coupling of 4-Bromoanisole",
    researcher_name: "Dr. Sarah Chen",
    researcher_email: "s.chen@lab.org",
    date: "2026-03-15",
    status: "completed",
    reaction_type: "Suzuki Coupling",
    substrate_class: "Aryl Halides",
    chemicals: [
      {
        name: "4-Bromoanisole",
        cas_number: "104-92-7",
        molecular_weight: 187.04,
        role: "reagent",
        amount: 1.87,
        unit: "g",
      },
      {
        name: "Phenylboronic Acid",
        cas_number: "98-80-6",
        molecular_weight: 121.93,
        role: "reagent",
        amount: 1.46,
        unit: "g",
      },
      {
        name: "Pd(PPh3)4",
        cas_number: "14221-01-3",
        molecular_weight: 1155.56,
        role: "catalyst",
        amount: 0.058,
        unit: "g",
      },
      {
        name: "THF",
        cas_number: "109-99-9",
        molecular_weight: 72.11,
        role: "solvent",
        amount: 20,
        unit: "ml",
      },
      {
        name: "4-Methoxybiphenyl",
        cas_number: "613-37-6",
        molecular_weight: 184.24,
        role: "product",
        amount: 1.57,
        unit: "g",
      },
    ],
    procedure:
      "Setup:\nCharge flask with 4-bromoanisole and Pd(PPh3)4 under N2\nAdd THF via syringe\nReaction:\nHeat to 65C and stir for 12 hours\nMonitor by TLC\nWorkup:\nCool to room temperature\nQuench with saturated NH4Cl\nExtract with ethyl acetate (3 x 20 mL)\nPurification:\nColumn chromatography on silica gel (hexanes/EtOAc 9:1)",
    results:
      "Isolated 4-methoxybiphenyl as a white solid in 85% yield. 1H NMR consistent with literature.",
    yield_percent: 85,
    practical_notes:
      "What worked well:\nDegassing the solvent improved reproducibility\nChallenges:\nCatalyst loading below 2 mol% gave incomplete conversion\nRecommendations:\nUse fresh Pd(PPh3)4 from sealed ampule for best results",
    ...overrides,
  };
}

describe("experimentTransformer", () => {
  describe("transformExperiment - field mapping", () => {
    test("maps all frontmatter fields from raw data", () => {
      const raw = makeRawExperiment();
      const result = transformExperiment(raw);

      expect(result.frontmatter.elnId).toBe("EXP-2026-0042");
      expect(result.frontmatter.title).toBe(
        "EXP-2026-0042: Suzuki Coupling of 4-Bromoanisole"
      );
      expect(result.frontmatter.researcher).toBe("Dr. Sarah Chen");
      expect(result.frontmatter.date).toBe("2026-03-15");
      expect(result.frontmatter.status).toBe("completed");
      expect(result.frontmatter.reactionType).toBe("Suzuki Coupling");
      expect(result.frontmatter.substrateClass).toBe("Aryl Halides");
    });

    test("maps body content from raw data", () => {
      const raw = makeRawExperiment();
      const result = transformExperiment(raw);

      expect(result.body.reagents.length).toBeGreaterThan(0);
      expect(result.body.results.yield).toBe("85%");
      expect(result.body.relatedChemicals).toContain("4-Bromoanisole");
      expect(result.body.relatedChemicals).toContain("Phenylboronic Acid");
    });

    test("generates pageData compatible with ExperimentPageData", () => {
      const raw = makeRawExperiment();
      const result = transformExperiment(raw);

      expect(result.pageData.title).toBe(result.frontmatter.title);
      expect(result.pageData.elnId).toBe(result.frontmatter.elnId);
      expect(result.pageData.researcher).toBe("Dr. Sarah Chen");
      expect(result.pageData.status).toBe("completed");
      expect(result.pageData.scaleCategory).toBeDefined();
      expect(result.pageData.qualityScore).toBeGreaterThanOrEqual(1);
      expect(result.pageData.qualityScore).toBeLessThanOrEqual(5);
    });
  });

  describe("generateElnId", () => {
    test("generates ELN ID from experiment date and numeric ID suffix", () => {
      const raw = makeRawExperiment({ id: "exp-0042", date: "2026-03-15" });
      expect(generateElnId(raw)).toBe("EXP-2026-0042");
    });

    test("pads short numeric IDs to 4 digits", () => {
      const raw = makeRawExperiment({ id: "exp-7", date: "2025-11-01" });
      expect(generateElnId(raw)).toBe("EXP-2025-0007");
    });

    test("uses last 4 digits for long IDs", () => {
      const raw = makeRawExperiment({ id: "experiment-123456", date: "2026-01-10" });
      expect(generateElnId(raw)).toBe("EXP-2026-3456");
    });
  });

  describe("generateExperimentTitle", () => {
    test("formats title as EXP-YYYY-NNNN: [Short Title]", () => {
      const raw = makeRawExperiment();
      const title = generateExperimentTitle(raw);
      expect(title).toBe("EXP-2026-0042: Suzuki Coupling of 4-Bromoanisole");
    });

    test("handles empty title with default", () => {
      const raw = makeRawExperiment({ title: "" });
      const title = generateExperimentTitle(raw);
      expect(title).toBe("EXP-2026-0042: Untitled Experiment");
    });
  });

  describe("normalizeStatus", () => {
    test("passes through valid statuses", () => {
      expect(normalizeStatus("completed")).toBe("completed");
      expect(normalizeStatus("in-progress")).toBe("in-progress");
      expect(normalizeStatus("planned")).toBe("planned");
      expect(normalizeStatus("failed")).toBe("failed");
      expect(normalizeStatus("abandoned")).toBe("abandoned");
    });

    test("maps alternative status names", () => {
      expect(normalizeStatus("active")).toBe("in-progress");
      expect(normalizeStatus("done")).toBe("completed");
      expect(normalizeStatus("cancelled")).toBe("abandoned");
      expect(normalizeStatus("in progress")).toBe("in-progress");
    });

    test("defaults unknown statuses to planned", () => {
      expect(normalizeStatus("unknown-status")).toBe("planned");
      expect(normalizeStatus("")).toBe("planned");
    });

    test("is case-insensitive", () => {
      expect(normalizeStatus("COMPLETED")).toBe("completed");
      expect(normalizeStatus("In-Progress")).toBe("in-progress");
    });
  });

  describe("determineScaleCategory", () => {
    test("returns small for sub-mmol amounts", () => {
      const chemicals: RawChemical[] = [
        {
          name: "Substrate",
          cas_number: null,
          molecular_weight: 200,
          role: "reagent",
          amount: 0.1,
          unit: "g",
        },
      ];
      expect(determineScaleCategory(chemicals)).toBe("small");
    });

    test("returns medium for 1-10 mmol amounts", () => {
      const chemicals: RawChemical[] = [
        {
          name: "Substrate",
          cas_number: null,
          molecular_weight: 200,
          role: "reagent",
          amount: 1.0,
          unit: "g",
        },
      ];
      // 1.0g / 200 g/mol * 1000 = 5 mmol => medium
      expect(determineScaleCategory(chemicals)).toBe("medium");
    });

    test("returns large for 10-100 mmol amounts", () => {
      const chemicals: RawChemical[] = [
        {
          name: "Substrate",
          cas_number: null,
          molecular_weight: 100,
          role: "reagent",
          amount: 5.0,
          unit: "g",
        },
      ];
      // 5g / 100 g/mol * 1000 = 50 mmol => large
      expect(determineScaleCategory(chemicals)).toBe("large");
    });

    test("returns pilot for >= 100 mmol amounts", () => {
      const chemicals: RawChemical[] = [
        {
          name: "Substrate",
          cas_number: null,
          molecular_weight: 100,
          role: "reagent",
          amount: 15.0,
          unit: "g",
        },
      ];
      // 15g / 100 g/mol * 1000 = 150 mmol => pilot
      expect(determineScaleCategory(chemicals)).toBe("pilot");
    });

    test("handles mmol unit directly", () => {
      const chemicals: RawChemical[] = [
        {
          name: "Substrate",
          cas_number: null,
          molecular_weight: null,
          role: "reagent",
          amount: 5,
          unit: "mmol",
        },
      ];
      expect(determineScaleCategory(chemicals)).toBe("medium");
    });

    test("returns small when no reagents present", () => {
      const chemicals: RawChemical[] = [
        {
          name: "THF",
          cas_number: null,
          molecular_weight: 72,
          role: "solvent",
          amount: 50,
          unit: "ml",
        },
      ];
      expect(determineScaleCategory(chemicals)).toBe("small");
    });

    test("ignores solvents for scale determination", () => {
      const chemicals: RawChemical[] = [
        {
          name: "Substrate",
          cas_number: null,
          molecular_weight: 200,
          role: "reagent",
          amount: 0.05,
          unit: "g",
        },
        {
          name: "DCM",
          cas_number: null,
          molecular_weight: 85,
          role: "solvent",
          amount: 500,
          unit: "ml",
        },
      ];
      expect(determineScaleCategory(chemicals)).toBe("small");
    });
  });

  describe("extractChemicalWikilinks", () => {
    test("extracts names from chemicals array", () => {
      const chemicals: RawChemical[] = [
        { name: "4-Bromoanisole", cas_number: null, molecular_weight: 187, role: "reagent", amount: 1, unit: "g" },
        { name: "Phenylboronic Acid", cas_number: null, molecular_weight: 122, role: "reagent", amount: 1, unit: "g" },
      ];
      const links = extractChemicalWikilinks(chemicals);
      expect(links).toEqual(["4-Bromoanisole", "Phenylboronic Acid"]);
    });

    test("filters out empty names", () => {
      const chemicals: RawChemical[] = [
        { name: "", cas_number: null, molecular_weight: null, role: "reagent", amount: 1, unit: "g" },
        { name: "  ", cas_number: null, molecular_weight: null, role: "reagent", amount: 1, unit: "g" },
        { name: "Valid Chemical", cas_number: null, molecular_weight: null, role: "reagent", amount: 1, unit: "g" },
      ];
      const links = extractChemicalWikilinks(chemicals);
      expect(links).toEqual(["Valid Chemical"]);
    });
  });

  describe("generateTags", () => {
    test("generates all expected tag types", () => {
      const raw = makeRawExperiment();
      const tags = generateTags(raw, "EXP-2026-0042", "medium", 4);

      expect(tags).toContain("eln:EXP-2026-0042");
      expect(tags).toContain("reaction:suzuki-coupling");
      expect(tags).toContain("researcher:chen");
      expect(tags).toContain("scale:medium");
      expect(tags).toContain("quality:4");
      expect(tags).toContain("substrate-class:aryl-halides");
    });

    test("includes CAS tags for chemicals with CAS numbers", () => {
      const raw = makeRawExperiment();
      const tags = generateTags(raw, "EXP-2026-0042", "medium", 4);

      expect(tags).toContain("cas:104-92-7");
      expect(tags).toContain("cas:98-80-6");
    });

    test("omits reaction tag when reaction_type is null", () => {
      const raw = makeRawExperiment({ reaction_type: null });
      const tags = generateTags(raw, "EXP-2026-0042", "small", 2);

      const reactionTags = tags.filter((t) => t.startsWith("reaction:"));
      expect(reactionTags).toHaveLength(0);
    });

    test("omits substrate-class tag when substrate_class is null", () => {
      const raw = makeRawExperiment({ substrate_class: null });
      const tags = generateTags(raw, "EXP-2026-0042", "small", 2);

      const subTags = tags.filter((t) => t.startsWith("substrate-class:"));
      expect(subTags).toHaveLength(0);
    });
  });

  describe("quality score computation", () => {
    test("computes quality score based on yield and completeness", () => {
      const raw = makeRawExperiment({ yield_percent: 85 });
      const result = transformExperiment(raw);

      // yield 85 => base 4, has notes (+0.5), has products+characterization (+0.5), has procedure (+0.5)
      // 4 + 1.5 = 5.5, clamped to 5
      expect(result.frontmatter.qualityScore).toBe(5);
    });

    test("returns low score for low yield without completeness", () => {
      const raw = makeRawExperiment({
        yield_percent: 30,
        practical_notes: null,
        results: null,
        chemicals: [
          { name: "Reagent A", cas_number: null, molecular_weight: null, role: "reagent", amount: 1, unit: "g" },
        ],
        procedure: null,
      });
      const result = transformExperiment(raw);

      expect(result.frontmatter.qualityScore).toBe(1);
    });

    test("handles null yield as 0%", () => {
      const raw = makeRawExperiment({ yield_percent: null });
      const result = transformExperiment(raw);

      expect(result.frontmatter.qualityScore).toBeGreaterThanOrEqual(1);
    });
  });

  describe("parseProcedure", () => {
    test("parses sectioned procedure text", () => {
      const text = `Setup:
Charge flask with substrate under N2
Add solvent via syringe
Reaction:
Heat to 80C for 6 hours
Monitor by TLC
Workup:
Cool to RT
Extract with EtOAc
Purification:
Column chromatography (hex/EtOAc 4:1)`;

      const result = parseProcedure(text);

      expect(result.setup).toEqual([
        "Charge flask with substrate under N2",
        "Add solvent via syringe",
      ]);
      expect(result.reaction).toEqual([
        "Heat to 80C for 6 hours",
        "Monitor by TLC",
      ]);
      expect(result.workup).toEqual(["Cool to RT", "Extract with EtOAc"]);
      expect(result.purification).toEqual([
        "Column chromatography (hex/EtOAc 4:1)",
      ]);
    });

    test("puts unsectioned text into reaction by default", () => {
      const text = "Stir at RT for 2 hours\nFilter and wash with water";
      const result = parseProcedure(text);

      expect(result.setup).toEqual([]);
      expect(result.reaction).toEqual([
        "Stir at RT for 2 hours",
        "Filter and wash with water",
      ]);
    });

    test("returns empty arrays for null procedure", () => {
      const result = parseProcedure(null);
      expect(result.setup).toEqual([]);
      expect(result.reaction).toEqual([]);
      expect(result.workup).toEqual([]);
      expect(result.purification).toEqual([]);
    });

    test("returns empty arrays for empty string", () => {
      const result = parseProcedure("   ");
      expect(result.setup).toEqual([]);
      expect(result.reaction).toEqual([]);
    });
  });

  describe("formatReagents", () => {
    test("formats reagents with proper fields", () => {
      const chemicals: RawChemical[] = [
        { name: "Substrate A", cas_number: "123-45-6", molecular_weight: 200, role: "reagent", amount: 2.0, unit: "g" },
        { name: "Pd(OAc)2", cas_number: "3375-31-3", molecular_weight: 224.5, role: "catalyst", amount: 0.01, unit: "g" },
        { name: "THF", cas_number: "109-99-9", molecular_weight: 72.11, role: "solvent", amount: 20, unit: "ml" },
        { name: "Product B", cas_number: "789-01-2", molecular_weight: 250, role: "product", amount: 1.5, unit: "g" },
      ];

      const reagents = formatReagents(chemicals);

      expect(reagents).toHaveLength(3); // excludes product
      expect(reagents[0].name).toBe("Substrate A");
      expect(reagents[0].amount).toBe("2 g");
      expect(reagents[0].cas).toBe("123-45-6");
      expect(reagents[1].equivalents).toBe("cat.");
      expect(reagents[2].notes).toBe("solvent");
    });
  });

  describe("parsePracticalNotes", () => {
    test("parses sectioned notes", () => {
      const notes = `What worked well:
Degassing improved yield
Fresh catalyst gave better conversion
Challenges:
Low conversion with old catalyst
Recommendations:
Always degas solvents before use`;

      const result = parsePracticalNotes(notes);

      expect(result.worked).toEqual([
        "Degassing improved yield",
        "Fresh catalyst gave better conversion",
      ]);
      expect(result.challenges).toEqual([
        "Low conversion with old catalyst",
      ]);
      expect(result.recommendations).toEqual([
        "Always degas solvents before use",
      ]);
    });

    test("returns empty arrays for null notes", () => {
      const result = parsePracticalNotes(null);
      expect(result.worked).toEqual([]);
      expect(result.challenges).toEqual([]);
      expect(result.recommendations).toEqual([]);
    });
  });

  describe("handling of missing/optional fields", () => {
    test("handles null reaction_type", () => {
      const raw = makeRawExperiment({ reaction_type: null });
      const result = transformExperiment(raw);

      expect(result.frontmatter.reactionType).toBeUndefined();
      expect(result.pageData.reactionType).toBeUndefined();
    });

    test("handles null substrate_class", () => {
      const raw = makeRawExperiment({ substrate_class: null });
      const result = transformExperiment(raw);

      expect(result.frontmatter.substrateClass).toBeUndefined();
    });

    test("handles null procedure", () => {
      const raw = makeRawExperiment({ procedure: null });
      const result = transformExperiment(raw);

      expect(result.body.procedureSetup).toEqual([]);
      expect(result.body.procedureReaction).toEqual([]);
      expect(result.body.procedureWorkup).toEqual([]);
      expect(result.body.procedurePurification).toEqual([]);
    });

    test("handles null results", () => {
      const raw = makeRawExperiment({ results: null });
      const result = transformExperiment(raw);

      expect(result.body.summary).toContain("Suzuki Coupling");
    });

    test("handles null practical_notes", () => {
      const raw = makeRawExperiment({ practical_notes: null });
      const result = transformExperiment(raw);

      expect(result.body.practicalNotesWorked).toEqual([]);
      expect(result.body.practicalNotesChallenges).toEqual([]);
      expect(result.body.practicalNotesRecommendations).toEqual([]);
    });

    test("handles null yield_percent", () => {
      const raw = makeRawExperiment({ yield_percent: null });
      const result = transformExperiment(raw);

      expect(result.body.results.yield).toBe("0%");
    });

    test("handles empty chemicals array", () => {
      const raw = makeRawExperiment({ chemicals: [] });
      const result = transformExperiment(raw);

      expect(result.body.reagents).toEqual([]);
      expect(result.body.relatedChemicals).toEqual([]);
      expect(result.frontmatter.scaleCategory).toBe("small");
    });
  });

  describe("full transformation with realistic data", () => {
    test("transforms a Grignard reaction experiment", () => {
      const raw = makeRawExperiment({
        id: "exp-0108",
        title: "Grignard Addition to Benzaldehyde",
        researcher_name: "Dr. James Wilson",
        researcher_email: "j.wilson@lab.org",
        date: "2026-02-20",
        reaction_type: "Grignard Reaction",
        substrate_class: "Aldehydes",
        chemicals: [
          { name: "Benzaldehyde", cas_number: "100-52-7", molecular_weight: 106.12, role: "reagent", amount: 1.06, unit: "g" },
          { name: "Methylmagnesium Bromide", cas_number: "75-16-1", molecular_weight: 119.24, role: "reagent", amount: 10, unit: "mmol" },
          { name: "Diethyl Ether", cas_number: "60-29-7", molecular_weight: 74.12, role: "solvent", amount: 30, unit: "ml" },
          { name: "1-Phenylethanol", cas_number: "98-85-1", molecular_weight: 122.16, role: "product", amount: 1.1, unit: "g" },
        ],
        yield_percent: 92,
        results: "Obtained 1-phenylethanol as clear oil. Purity >98% by GC.",
        practical_notes: "What worked:\nSlow addition of aldehyde crucial\nChallenges:\nMoisture sensitivity required careful drying\nRecommendations:\nDry all glassware in oven overnight",
        procedure: "Setup:\nFlame-dry flask under argon\nPrepare Grignard from MeBr and Mg turnings\nReaction:\nAdd benzaldehyde dropwise at 0C over 30 min\nStir at RT for 2h\nWorkup:\nQuench with sat. NH4Cl at 0C\nExtract with Et2O\nPurification:\nDistillation under reduced pressure",
      });

      const result = transformExperiment(raw);

      expect(result.frontmatter.elnId).toBe("EXP-2026-0108");
      expect(result.frontmatter.title).toBe("EXP-2026-0108: Grignard Addition to Benzaldehyde");
      expect(result.frontmatter.status).toBe("completed");
      expect(result.frontmatter.qualityScore).toBe(5);
      expect(result.frontmatter.tags).toContain("reaction:grignard-reaction");
      expect(result.frontmatter.tags).toContain("researcher:wilson");
      expect(result.frontmatter.tags).toContain("substrate-class:aldehydes");
      expect(result.body.procedureSetup.length).toBeGreaterThan(0);
      expect(result.body.procedureReaction.length).toBeGreaterThan(0);
      expect(result.body.relatedChemicals).toContain("Benzaldehyde");
      expect(result.body.relatedChemicals).toContain("1-Phenylethanol");
      expect(result.body.practicalNotesWorked.length).toBeGreaterThan(0);
      expect(result.body.practicalNotesChallenges.length).toBeGreaterThan(0);
    });

    test("transforms a failed Wittig reaction", () => {
      const raw = makeRawExperiment({
        id: "exp-0077",
        title: "Wittig Olefination of Cyclohexanone",
        researcher_name: "Maria Gonzalez",
        date: "2026-01-10",
        status: "failed",
        reaction_type: "Wittig Reaction",
        substrate_class: "Ketones",
        chemicals: [
          { name: "Cyclohexanone", cas_number: "108-94-1", molecular_weight: 98.14, role: "reagent", amount: 0.5, unit: "g" },
          { name: "Methyltriphenylphosphonium Bromide", cas_number: "1779-49-3", molecular_weight: 357.22, role: "reagent", amount: 2.0, unit: "g" },
        ],
        yield_percent: 12,
        results: "Only trace product detected by NMR. Mainly starting material recovered.",
        practical_notes: null,
        procedure: "Added ylide to ketone in THF at RT. Stirred overnight.",
      });

      const result = transformExperiment(raw);

      expect(result.frontmatter.status).toBe("failed");
      expect(result.frontmatter.qualityScore).toBeLessThanOrEqual(2);
      expect(result.body.results.yield).toBe("12%");
    });
  });
});
