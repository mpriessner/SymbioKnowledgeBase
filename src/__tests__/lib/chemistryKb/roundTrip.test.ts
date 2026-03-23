import { describe, test, expect } from "vitest";
import {
  generateExperimentPage,
  generateChemicalPage,
  generateReactionTypePage,
  generateResearcherPage,
  generateSubstrateClassPage,
} from "@/lib/chemistryKb/templates";
import {
  ALL_SAMPLE_CHEMICALS,
  ALL_SAMPLE_EXPERIMENTS,
  ALL_SAMPLE_PAGE_TITLES,
  SYNONYM_MAP,
  sampleDrMueller,
  sampleSuzukiCoupling,
  sampleHeteroarylHalides,
} from "@/lib/chemistryKb/sampleData";
import {
  validateFrontmatter,
  validateExperimentFrontmatter,
  validateChemicalFrontmatter,
  validateReactionTypeFrontmatter,
  validateResearcherFrontmatter,
  validateSubstrateClassFrontmatter,
} from "@/lib/chemistryKb/validateFrontmatter";
import { validateChemistryKbPages } from "@/lib/chemistryKb/validate";
import { ChemPageType } from "@/lib/chemistryKb/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractFrontmatterBlock(md: string): string | null {
  const match = md.match(/^---\n([\s\S]*?)\n---/);
  return match ? match[1] : null;
}

function parseFrontmatterFields(md: string): Record<string, string> {
  const block = extractFrontmatterBlock(md);
  if (!block) return {};
  const result: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1 || line.startsWith("  -")) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (key) result[key] = val;
  }
  return result;
}

function extractWikilinks(md: string): string[] {
  const regex = /\[\[([^\]]+)\]\]/g;
  const links: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(md)) !== null) {
    links.push(m[1]);
  }
  return links;
}

function extractSections(md: string): string[] {
  return (md.match(/^## .+$/gm) ?? []).map((s) => s.replace(/^## /, ""));
}

function extractSubsections(md: string): string[] {
  return (md.match(/^### .+$/gm) ?? []).map((s) => s.replace(/^### /, ""));
}

// ---------------------------------------------------------------------------
// Round-trip tests: Experiment pages
// ---------------------------------------------------------------------------

describe("Round-trip: Experiment pages", () => {
  for (const exp of ALL_SAMPLE_EXPERIMENTS) {
    describe(exp.title, () => {
      const md = generateExperimentPage(exp);

      test("has valid YAML frontmatter delimiters", () => {
        expect(md).toMatch(/^---\n[\s\S]*?\n---/);
      });

      test("frontmatter contains all required fields", () => {
        const fields = parseFrontmatterFields(md);
        expect(fields["title"]).toBeDefined();
        expect(fields["icon"]).toBeDefined();
        expect(fields["eln_id"]).toBeDefined();
        expect(fields["researcher"]).toBeDefined();
        expect(fields["date"]).toBeDefined();
        expect(fields["status"]).toBeDefined();
        expect(fields["scale_category"]).toBeDefined();
        expect(fields["quality_score"]).toBeDefined();
      });

      test("frontmatter values match input data", () => {
        const fields = parseFrontmatterFields(md);
        expect(fields["eln_id"]).toContain(exp.elnId);
        expect(fields["researcher"]).toContain(exp.researcher);
        expect(fields["status"]).toContain(exp.status);
        expect(fields["scale_category"]).toContain(exp.scaleCategory);
        expect(fields["quality_score"]).toBe(String(exp.qualityScore));
      });

      test("has required sections", () => {
        const sections = extractSections(md);
        expect(sections).toContain("Metadata");
        expect(sections).toContain("Reaction Conditions");
        expect(sections).toContain("Reagents");
        expect(sections).toContain("Procedure");
        expect(sections).toContain("Results");
        expect(sections).toContain("Practical Notes");
        expect(sections).toContain("Related Experiments");
        expect(sections).toContain("Related Pages");
      });

      test("has procedure subsections", () => {
        const subsections = extractSubsections(md);
        expect(subsections).toContain("Setup");
        expect(subsections).toContain("Reaction");
        expect(subsections).toContain("Workup");
        expect(subsections).toContain("Purification");
      });

      test("all wikilinks are in [[Page Title]] format", () => {
        const wikilinks = extractWikilinks(md);
        expect(wikilinks.length).toBeGreaterThan(0);
        for (const link of wikilinks) {
          expect(link).not.toContain("[");
          expect(link).not.toContain("]");
          expect(link.trim()).toBe(link);
        }
      });

      test("wikilinks reference existing pages or synonyms", () => {
        const knownTitles = new Set(ALL_SAMPLE_PAGE_TITLES);
        const knownSynonyms = new Set(Object.keys(SYNONYM_MAP));
        const wikilinks = extractWikilinks(md);
        for (const link of wikilinks) {
          const isKnown = knownTitles.has(link) || knownSynonyms.has(link);
          expect(isKnown).toBe(true);
        }
      });

      test("contains researcher wikilink", () => {
        const wikilinks = extractWikilinks(md);
        expect(wikilinks).toContain(exp.researcher);
      });

      test("contains reaction type wikilink", () => {
        if (exp.reactionType) {
          const wikilinks = extractWikilinks(md);
          expect(wikilinks).toContain(exp.reactionType);
        }
      });

      test("reagents table contains wikilinked chemical names", () => {
        for (const reagent of exp.reagents) {
          expect(md).toContain(`[[${reagent.name}]]`);
        }
      });

      test("contains one-liner summary as blockquote", () => {
        expect(md).toContain(`> One-liner summary: ${exp.summary}`);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// Round-trip tests: Chemical pages
// ---------------------------------------------------------------------------

describe("Round-trip: Chemical pages", () => {
  for (const chem of ALL_SAMPLE_CHEMICALS) {
    describe(chem.name, () => {
      const md = generateChemicalPage(chem);

      test("has valid YAML frontmatter delimiters", () => {
        expect(md).toMatch(/^---\n[\s\S]*?\n---/);
      });

      test("frontmatter contains required fields", () => {
        const fields = parseFrontmatterFields(md);
        expect(fields["title"]).toBeDefined();
        expect(fields["icon"]).toBeDefined();
        expect(fields["cas_number"]).toBeDefined();
      });

      test("CAS number matches input", () => {
        const fields = parseFrontmatterFields(md);
        expect(fields["cas_number"]).toContain(chem.casNumber);
      });

      test("has required sections", () => {
        const sections = extractSections(md);
        expect(sections).toContain("Properties");
        expect(sections).toContain("Practical Usage Notes");
        expect(sections).toContain("Used In Experiments");
        expect(sections).toContain("Related Pages");
      });

      test("wikilinks reference existing pages", () => {
        const knownTitles = new Set(ALL_SAMPLE_PAGE_TITLES);
        const knownSynonyms = new Set(Object.keys(SYNONYM_MAP));
        const wikilinks = extractWikilinks(md);
        for (const link of wikilinks) {
          expect(knownTitles.has(link) || knownSynonyms.has(link)).toBe(true);
        }
      });

      test("experiment backlinks reference sample experiments", () => {
        if (chem.usedInExperiments && chem.usedInExperiments.length > 0) {
          const wikilinks = extractWikilinks(md);
          for (const exp of chem.usedInExperiments) {
            expect(wikilinks).toContain(exp.elnId);
          }
        }
      });
    });
  }
});

// ---------------------------------------------------------------------------
// Round-trip tests: Reaction Type page
// ---------------------------------------------------------------------------

describe("Round-trip: Reaction Type page", () => {
  const md = generateReactionTypePage(sampleSuzukiCoupling);

  test("has valid YAML frontmatter", () => {
    expect(md).toMatch(/^---\n[\s\S]*?\n---/);
  });

  test("frontmatter contains required fields", () => {
    const fields = parseFrontmatterFields(md);
    expect(fields["title"]).toBeDefined();
    expect(fields["icon"]).toBeDefined();
    expect(fields["experiment_count"]).toBe("3");
    expect(fields["researcher_count"]).toBe("1");
  });

  test("has required sections", () => {
    const sections = extractSections(md);
    expect(sections).toContain("Institutional Experience");
    expect(sections).toContain("Key Learnings");
    expect(sections).toContain("Who to Ask");
    expect(sections).toContain("Representative Experiments");
    expect(sections).toContain("Related Pages");
  });

  test("references all 3 experiment pages", () => {
    const wikilinks = extractWikilinks(md);
    expect(wikilinks).toContain("EXP-2026-0042");
    expect(wikilinks).toContain("EXP-2026-0043");
    expect(wikilinks).toContain("EXP-2026-0044");
  });

  test("references Dr. Anna Mueller", () => {
    const wikilinks = extractWikilinks(md);
    expect(wikilinks).toContain("Dr. Anna Mueller");
  });

  test("references catalyst Pd(PPh3)4", () => {
    const wikilinks = extractWikilinks(md);
    expect(wikilinks).toContain("Pd(PPh3)4");
  });
});

// ---------------------------------------------------------------------------
// Round-trip tests: Researcher page
// ---------------------------------------------------------------------------

describe("Round-trip: Researcher page", () => {
  const md = generateResearcherPage(sampleDrMueller);

  test("has valid YAML frontmatter", () => {
    expect(md).toMatch(/^---\n[\s\S]*?\n---/);
  });

  test("frontmatter contains required fields", () => {
    const fields = parseFrontmatterFields(md);
    expect(fields["title"]).toBeDefined();
    expect(fields["icon"]).toBeDefined();
    expect(fields["experiment_count"]).toBe("3");
    expect(fields["email"]).toContain("a.mueller@institute.edu");
  });

  test("has required sections", () => {
    const sections = extractSections(md);
    expect(sections).toContain("Expertise Areas");
    expect(sections).toContain("Recent Experiments");
    expect(sections).toContain("Key Contributions");
    expect(sections).toContain("Contact");
  });

  test("references all 3 experiment pages", () => {
    const wikilinks = extractWikilinks(md);
    expect(wikilinks).toContain("EXP-2026-0042");
    expect(wikilinks).toContain("EXP-2026-0043");
    expect(wikilinks).toContain("EXP-2026-0044");
  });

  test("references expertise areas as wikilinks", () => {
    const wikilinks = extractWikilinks(md);
    expect(wikilinks).toContain("Suzuki Coupling");
    expect(wikilinks).toContain("Heteroaryl Halides");
  });
});

// ---------------------------------------------------------------------------
// Round-trip tests: Substrate Class page
// ---------------------------------------------------------------------------

describe("Round-trip: Substrate Class page", () => {
  const md = generateSubstrateClassPage(sampleHeteroarylHalides);

  test("has valid YAML frontmatter", () => {
    expect(md).toMatch(/^---\n[\s\S]*?\n---/);
  });

  test("frontmatter contains required fields", () => {
    const fields = parseFrontmatterFields(md);
    expect(fields["title"]).toBeDefined();
    expect(fields["icon"]).toBeDefined();
    expect(fields["experiment_count"]).toBe("3");
  });

  test("has required sections", () => {
    const sections = extractSections(md);
    expect(sections).toContain("Common Challenges");
    expect(sections).toContain("What Worked");
    expect(sections).toContain("Who Has Experience");
    expect(sections).toContain("Representative Experiments");
    expect(sections).toContain("Related Pages");
  });

  test("references Dr. Anna Mueller", () => {
    const wikilinks = extractWikilinks(md);
    expect(wikilinks).toContain("Dr. Anna Mueller");
  });

  test("references Suzuki Coupling", () => {
    const wikilinks = extractWikilinks(md);
    expect(wikilinks).toContain("Suzuki Coupling");
  });

  test("references all 3 experiments", () => {
    const wikilinks = extractWikilinks(md);
    expect(wikilinks).toContain("EXP-2026-0042");
    expect(wikilinks).toContain("EXP-2026-0043");
    expect(wikilinks).toContain("EXP-2026-0044");
  });
});

// ---------------------------------------------------------------------------
// Cross-reference consistency tests
// ---------------------------------------------------------------------------

describe("Cross-reference consistency", () => {
  test("experiments reference chemicals that exist in sample set", () => {
    const chemicalNames = new Set(ALL_SAMPLE_CHEMICALS.map((c) => c.name));
    const synonyms = new Set(Object.keys(SYNONYM_MAP));

    for (const exp of ALL_SAMPLE_EXPERIMENTS) {
      for (const reagent of exp.reagents) {
        const isKnown = chemicalNames.has(reagent.name) || synonyms.has(reagent.name);
        expect(isKnown).toBe(true);
      }
    }
  });

  test("chemicals reference experiments that exist in sample set", () => {
    const expIds = new Set(ALL_SAMPLE_EXPERIMENTS.map((e) => e.elnId));
    for (const chem of ALL_SAMPLE_CHEMICALS) {
      if (chem.usedInExperiments) {
        for (const ref of chem.usedInExperiments) {
          expect(expIds.has(ref.elnId)).toBe(true);
        }
      }
    }
  });

  test("researcher references experiments that exist in sample set", () => {
    const expIds = new Set(ALL_SAMPLE_EXPERIMENTS.map((e) => e.elnId));
    if (sampleDrMueller.recentExperiments) {
      for (const ref of sampleDrMueller.recentExperiments) {
        expect(expIds.has(ref.elnId)).toBe(true);
      }
    }
  });

  test("reaction type references experiments that exist in sample set", () => {
    const expIds = new Set(ALL_SAMPLE_EXPERIMENTS.map((e) => e.elnId));
    if (sampleSuzukiCoupling.representativeExperiments) {
      for (const ref of sampleSuzukiCoupling.representativeExperiments) {
        expect(expIds.has(ref.elnId)).toBe(true);
      }
    }
  });

  test("substrate class references experiments that exist in sample set", () => {
    const expIds = new Set(ALL_SAMPLE_EXPERIMENTS.map((e) => e.elnId));
    if (sampleHeteroarylHalides.representativeExperiments) {
      for (const ref of sampleHeteroarylHalides.representativeExperiments) {
        expect(expIds.has(ref.elnId)).toBe(true);
      }
    }
  });

  test("experiment-to-experiment cross-references are consistent", () => {
    const expIds = new Set(ALL_SAMPLE_EXPERIMENTS.map((e) => e.elnId));
    for (const exp of ALL_SAMPLE_EXPERIMENTS) {
      if (exp.relatedExperiments) {
        for (const ref of exp.relatedExperiments) {
          expect(expIds.has(ref.elnId)).toBe(true);
        }
      }
    }
  });

  test("EXP-0042 uses THF which resolves to Tetrahydrofuran via synonym", () => {
    const md = generateExperimentPage(ALL_SAMPLE_EXPERIMENTS[0]);
    const wikilinks = extractWikilinks(md);
    expect(wikilinks).toContain("THF");
    expect(SYNONYM_MAP["THF"]).toBe("Tetrahydrofuran");
  });
});

// ---------------------------------------------------------------------------
// Frontmatter validation tests
// ---------------------------------------------------------------------------

describe("Frontmatter validation utilities", () => {
  test("validateExperimentFrontmatter accepts valid data", () => {
    const result = validateExperimentFrontmatter({
      title: "EXP-2026-0042: Test",
      icon: "\u{1F9EA}",
      eln_id: "EXP-2026-0042",
      researcher: "Dr. Test",
      date: "2026-03-15",
      status: "completed",
      scale_category: "medium",
      quality_score: 4,
      tags: ["eln:EXP-2026-0042"],
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("validateExperimentFrontmatter rejects missing fields", () => {
    const result = validateExperimentFrontmatter({
      title: "Test",
      icon: "\u{1F9EA}",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes("eln_id"))).toBe(true);
  });

  test("validateExperimentFrontmatter rejects invalid status", () => {
    const result = validateExperimentFrontmatter({
      title: "Test",
      icon: "\u{1F9EA}",
      eln_id: "EXP-2026-0042",
      researcher: "Dr. Test",
      date: "2026-03-15",
      status: "invalid-status",
      scale_category: "medium",
      quality_score: 4,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("status"))).toBe(true);
  });

  test("validateChemicalFrontmatter accepts valid data", () => {
    const result = validateChemicalFrontmatter({
      title: "Pd(PPh3)4",
      icon: "\u2697\uFE0F",
      cas_number: "14221-01-3",
      molecular_weight: 1155.56,
    });
    expect(result.valid).toBe(true);
  });

  test("validateChemicalFrontmatter rejects missing CAS", () => {
    const result = validateChemicalFrontmatter({
      title: "Test",
      icon: "\u2697\uFE0F",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("cas_number"))).toBe(true);
  });

  test("validateReactionTypeFrontmatter accepts valid data", () => {
    const result = validateReactionTypeFrontmatter({
      title: "Suzuki Coupling",
      icon: "\u{1F52C}",
      experiment_count: 3,
      researcher_count: 1,
      avg_yield: 83,
    });
    expect(result.valid).toBe(true);
  });

  test("validateResearcherFrontmatter accepts valid data", () => {
    const result = validateResearcherFrontmatter({
      title: "Dr. Anna Mueller",
      icon: "\u{1F469}\u200D\u{1F52C}",
      experiment_count: 3,
      email: "a.mueller@institute.edu",
    });
    expect(result.valid).toBe(true);
  });

  test("validateSubstrateClassFrontmatter accepts valid data", () => {
    const result = validateSubstrateClassFrontmatter({
      title: "Heteroaryl Halides",
      icon: "\u{1F9EC}",
      experiment_count: 3,
    });
    expect(result.valid).toBe(true);
  });

  test("validateFrontmatter factory dispatches correctly", () => {
    const result = validateFrontmatter(ChemPageType.CHEMICAL, {
      title: "Test",
      icon: "\u2697\uFE0F",
      cas_number: "123-45-6",
    });
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Full validation report test
// ---------------------------------------------------------------------------

describe("Full validation report", () => {
  test("all 11 sample pages pass validation", () => {
    const report = validateChemistryKbPages("test-tenant");

    expect(report.tenantId).toBe("test-tenant");
    expect(report.totalPages).toBe(11);
    expect(report.results).toHaveLength(11);

    for (const result of report.results) {
      if (!result.pass) {
        console.error(`FAILED: ${result.pageTitle}`, result.errors);
      }
      expect(result.pass).toBe(true);
    }

    expect(report.passed).toBe(11);
    expect(report.failed).toBe(0);
  });

  test("validation report contains all page types", () => {
    const report = validateChemistryKbPages("test-tenant");
    const types = new Set(report.results.map((r) => r.pageType));

    expect(types.has(ChemPageType.EXPERIMENT)).toBe(true);
    expect(types.has(ChemPageType.CHEMICAL)).toBe(true);
    expect(types.has(ChemPageType.REACTION_TYPE)).toBe(true);
    expect(types.has(ChemPageType.RESEARCHER)).toBe(true);
    expect(types.has(ChemPageType.SUBSTRATE_CLASS)).toBe(true);
  });

  test("experiment pages have correct count", () => {
    const report = validateChemistryKbPages("test-tenant");
    const experiments = report.results.filter(
      (r) => r.pageType === ChemPageType.EXPERIMENT,
    );
    expect(experiments).toHaveLength(3);
  });

  test("chemical pages have correct count", () => {
    const report = validateChemistryKbPages("test-tenant");
    const chemicals = report.results.filter(
      (r) => r.pageType === ChemPageType.CHEMICAL,
    );
    expect(chemicals).toHaveLength(5);
  });
});
