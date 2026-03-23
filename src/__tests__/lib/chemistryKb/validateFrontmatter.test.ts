import { describe, it, expect } from "vitest";
import {
  validateExperimentFrontmatter,
  validateChemicalFrontmatter,
  validateFrontmatter,
} from "@/lib/chemistryKb/validateFrontmatter";
import { ChemPageType } from "@/lib/chemistryKb/types";

describe("validateExperimentFrontmatter", () => {
  const validFrontmatter = {
    title: "Suzuki coupling of 4-bromoanisole",
    icon: "\u{1F9EA}",
    eln_id: "EXP-001",
    researcher: "Jane Doe",
    date: "2026-03-01",
    status: "completed",
    scale_category: "small",
    quality_score: 4,
  };

  it("should validate a complete frontmatter as valid", () => {
    const result = validateExperimentFrontmatter(validFrontmatter);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should report missing required fields", () => {
    const result = validateExperimentFrontmatter({});
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing required field: title");
    expect(result.errors).toContain("Missing required field: eln_id");
    expect(result.errors).toContain("Missing required field: researcher");
    expect(result.errors).toContain("Missing required field: date");
    expect(result.errors).toContain("Missing required field: status");
    expect(result.errors).toContain("Missing required field: quality_score");
  });

  it("should report type mismatch for quality_score", () => {
    const result = validateExperimentFrontmatter({
      ...validFrontmatter,
      quality_score: "not-a-number",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("quality_score"))).toBe(true);
  });

  it("should report quality_score out of range", () => {
    const result = validateExperimentFrontmatter({
      ...validFrontmatter,
      quality_score: 10,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("between 1 and 5"))).toBe(true);
  });

  it("should report invalid status enum value", () => {
    const result = validateExperimentFrontmatter({
      ...validFrontmatter,
      status: "unknown-status",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("status"))).toBe(true);
  });

  it("should report invalid scale_category enum value", () => {
    const result = validateExperimentFrontmatter({
      ...validFrontmatter,
      scale_category: "huge",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("scale_category"))).toBe(true);
  });

  it("should report wrong icon", () => {
    const result = validateExperimentFrontmatter({
      ...validFrontmatter,
      icon: "wrong",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("icon"))).toBe(true);
  });

  it("should report tags that are not an array", () => {
    const result = validateExperimentFrontmatter({
      ...validFrontmatter,
      tags: "not-an-array",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("tags must be an array");
  });

  it("should accept valid tags array", () => {
    const result = validateExperimentFrontmatter({
      ...validFrontmatter,
      tags: ["chemistry", "suzuki"],
    });
    expect(result.valid).toBe(true);
  });

  it("should treat empty string as missing", () => {
    const result = validateExperimentFrontmatter({
      ...validFrontmatter,
      title: "",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing required field: title");
  });
});

describe("validateChemicalFrontmatter", () => {
  const validChemical = {
    title: "Palladium Acetate",
    icon: "\u2697\uFE0F",
    cas_number: "3375-31-3",
  };

  it("should validate a complete chemical frontmatter", () => {
    const result = validateChemicalFrontmatter(validChemical);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should report missing required fields for chemical", () => {
    const result = validateChemicalFrontmatter({});
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing required field: title");
    expect(result.errors).toContain("Missing required field: cas_number");
  });

  it("should report common_synonyms that are not an array", () => {
    const result = validateChemicalFrontmatter({
      ...validChemical,
      common_synonyms: "Pd(OAc)2",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("common_synonyms must be an array");
  });
});

describe("validateFrontmatter (dispatch)", () => {
  it("should dispatch to experiment validator", () => {
    const result = validateFrontmatter(ChemPageType.EXPERIMENT, {});
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing required field: title");
  });

  it("should dispatch to chemical validator", () => {
    const result = validateFrontmatter(ChemPageType.CHEMICAL, {});
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing required field: cas_number");
  });

  it("should dispatch to reaction type validator", () => {
    const result = validateFrontmatter(ChemPageType.REACTION_TYPE, {});
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing required field: experiment_count");
  });

  it("should dispatch to researcher validator", () => {
    const result = validateFrontmatter(ChemPageType.RESEARCHER, {});
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing required field: experiment_count");
  });

  it("should dispatch to substrate class validator", () => {
    const result = validateFrontmatter(ChemPageType.SUBSTRATE_CLASS, {});
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing required field: experiment_count");
  });
});
