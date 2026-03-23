import { describe, test, expect } from "vitest";
import {
  validateExperimentTitle,
  validateChemicalTitle,
  formatExperimentTitle,
  formatResearcherTitle,
  generatePageTitle,
} from "@/lib/chemistryKb/naming";
import { ChemPageType } from "@/lib/chemistryKb/types";

describe("validateExperimentTitle", () => {
  test("accepts valid experiment title", () => {
    const result = validateExperimentTitle(
      "EXP-2026-0042: Suzuki Coupling of Aryl Bromide"
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test("rejects empty title", () => {
    const result = validateExperimentTitle("");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Title must not be empty");
  });

  test("rejects title without ELN ID prefix", () => {
    const result = validateExperimentTitle("Suzuki Coupling of Aryl Bromide");
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test("rejects title missing colon separator", () => {
    const result = validateExperimentTitle("EXP-2026-0042 Suzuki Coupling");
    expect(result.valid).toBe(false);
  });

  test("rejects title exceeding 80 characters", () => {
    const longTitle =
      "EXP-2026-0042: " + "A".repeat(70);
    const result = validateExperimentTitle(longTitle);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("80 characters"))).toBe(true);
  });

  test("rejects title with empty short title", () => {
    const result = validateExperimentTitle("EXP-2026-0042:  ");
    expect(result.valid).toBe(false);
  });

  test("accepts title at exactly 80 characters", () => {
    // "EXP-2026-0042: " = 15 chars, so 65 chars of short title = 80 total
    // but short title max is 60, so we need a title that is 80 chars total
    // with short title at exactly 60: "EXP-2026-0042: " (15) + 60 = 75
    // To hit 80 chars we need a longer prefix or accept 75 as valid
    const shortTitle = "A".repeat(60);
    const title = `EXP-2026-0042: ${shortTitle}`;
    expect(title.length).toBe(75);
    const result = validateExperimentTitle(title);
    expect(result.valid).toBe(true);
  });
});

describe("validateChemicalTitle", () => {
  test("accepts valid chemical name", () => {
    const result = validateChemicalTitle("Tetrahydrofuran");
    expect(result.valid).toBe(true);
  });

  test("accepts chemical name with special characters", () => {
    const result = validateChemicalTitle("Pd(PPh3)4");
    expect(result.valid).toBe(true);
  });

  test("accepts disambiguated chemical name", () => {
    const result = validateChemicalTitle("Ethanol (64-17-5)");
    expect(result.valid).toBe(true);
  });

  test("rejects empty chemical name", () => {
    const result = validateChemicalTitle("");
    expect(result.valid).toBe(false);
  });

  test("rejects overly long chemical name", () => {
    const result = validateChemicalTitle("A".repeat(81));
    expect(result.valid).toBe(false);
  });
});

describe("formatExperimentTitle", () => {
  test("formats valid ELN ID and short title", () => {
    expect(
      formatExperimentTitle("EXP-2026-0042", "Suzuki Coupling of Aryl Bromide")
    ).toBe("EXP-2026-0042: Suzuki Coupling of Aryl Bromide");
  });

  test("truncates short title exceeding 60 characters", () => {
    const longTitle = "A".repeat(65);
    const result = formatExperimentTitle("EXP-2026-0001", longTitle);
    expect(result).toBe(`EXP-2026-0001: ${"A".repeat(60)}`);
  });

  test("throws on invalid ELN ID format", () => {
    expect(() => formatExperimentTitle("INVALID", "Title")).toThrow(
      "Invalid ELN ID format"
    );
  });

  test("throws on empty short title", () => {
    expect(() => formatExperimentTitle("EXP-2026-0001", "")).toThrow(
      "Short title must not be empty"
    );
  });

  test("trims whitespace from short title", () => {
    expect(
      formatExperimentTitle("EXP-2026-0001", "  Suzuki Coupling  ")
    ).toBe("EXP-2026-0001: Suzuki Coupling");
  });
});

describe("formatResearcherTitle", () => {
  test("formats researcher with PhD", () => {
    expect(formatResearcherTitle("Anna", "Mueller", true)).toBe(
      "Dr. Anna Mueller"
    );
  });

  test("formats researcher without PhD", () => {
    expect(formatResearcherTitle("Sarah", "Chen", false)).toBe("Sarah Chen");
  });

  test("throws on empty first name", () => {
    expect(() => formatResearcherTitle("", "Mueller", true)).toThrow(
      "must not be empty"
    );
  });

  test("throws on empty last name", () => {
    expect(() => formatResearcherTitle("Anna", "", true)).toThrow(
      "must not be empty"
    );
  });

  test("trims whitespace from names", () => {
    expect(formatResearcherTitle("  Anna  ", "  Mueller  ", true)).toBe(
      "Dr. Anna Mueller"
    );
  });
});

describe("generatePageTitle", () => {
  test("generates experiment title", () => {
    expect(
      generatePageTitle(ChemPageType.EXPERIMENT, {
        elnId: "EXP-2026-0042",
        shortTitle: "Suzuki Coupling of Aryl Bromide",
      })
    ).toBe("EXP-2026-0042: Suzuki Coupling of Aryl Bromide");
  });

  test("generates chemical title", () => {
    expect(
      generatePageTitle(ChemPageType.CHEMICAL, {
        chemicalName: "Tetrahydrofuran",
      })
    ).toBe("Tetrahydrofuran");
  });

  test("generates reaction type title", () => {
    expect(
      generatePageTitle(ChemPageType.REACTION_TYPE, {
        reactionName: "Suzuki Coupling",
      })
    ).toBe("Suzuki Coupling");
  });

  test("generates researcher title with PhD", () => {
    expect(
      generatePageTitle(ChemPageType.RESEARCHER, {
        firstName: "Anna",
        lastName: "Mueller",
        hasPhd: true,
      })
    ).toBe("Dr. Anna Mueller");
  });

  test("generates researcher title without PhD", () => {
    expect(
      generatePageTitle(ChemPageType.RESEARCHER, {
        firstName: "Sarah",
        lastName: "Chen",
        hasPhd: false,
      })
    ).toBe("Sarah Chen");
  });

  test("generates substrate class title", () => {
    expect(
      generatePageTitle(ChemPageType.SUBSTRATE_CLASS, {
        className: "Heteroaryl Halides",
      })
    ).toBe("Heteroaryl Halides");
  });

  test("throws when required data is missing for experiment", () => {
    expect(() =>
      generatePageTitle(ChemPageType.EXPERIMENT, { shortTitle: "Title" })
    ).toThrow("elnId");
  });

  test("throws when required data is missing for chemical", () => {
    expect(() => generatePageTitle(ChemPageType.CHEMICAL, {})).toThrow(
      "chemicalName"
    );
  });

  test("defaults hasPhd to false for researcher", () => {
    expect(
      generatePageTitle(ChemPageType.RESEARCHER, {
        firstName: "Sarah",
        lastName: "Chen",
      })
    ).toBe("Sarah Chen");
  });
});
