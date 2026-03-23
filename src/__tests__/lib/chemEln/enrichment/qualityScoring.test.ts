import { describe, it, expect } from "vitest";
import {
  computeYieldScore,
  computeCompletenessScore,
  computeDocumentationScore,
  computeReproducibilityScore,
  computeEnhancedQualityScore,
  computeConfidence,
  experimentDataToScoringInput,
  rawFieldsToScoringInput,
} from "@/lib/chemEln/enrichment/qualityScoring";
import type {
  QualityScoringInput,
  QualityScoreBreakdown,
} from "@/lib/chemEln/enrichment/qualityScoring";
import type { ExperimentData } from "@/lib/chemEln/types";

function makeEmptyInput(): QualityScoringInput {
  return {
    yieldPercent: null,
    status: null,
    procedureSteps: null,
    practicalNotes: null,
    reagents: null,
    products: null,
    procedureMetadata: null,
    procedureText: null,
  };
}

function makeFullInput(): QualityScoringInput {
  return {
    yieldPercent: 95,
    status: "completed",
    procedureSteps: [
      { stepNumber: 1, action: "Dissolve starting material" },
      { stepNumber: 2, action: "Add catalyst" },
      { stepNumber: 3, action: "Heat to reflux" },
      { stepNumber: 4, action: "Monitor by TLC" },
      { stepNumber: 5, action: "Cool to RT" },
      { stepNumber: 6, action: "Purify by column chromatography" },
    ],
    practicalNotes: [
      { type: "observation", content: "Color changed from yellow to brown" },
      { type: "observation", content: "Precipitate formed after 30 min" },
      { type: "observation", content: "TLC shows clean conversion" },
      { type: "deviation", content: "Extended reaction time by 1h" },
      { type: "deviation", content: "Used different workup" },
      { type: "tip", content: "Pre-dry flask before use" },
    ],
    reagents: [
      {
        id: "r1",
        chemical: { id: "c1", name: "Aryl bromide", casNumber: null, molecularFormula: null },
        amount: 1.0,
        unit: "mmol",
      },
      {
        id: "r2",
        chemical: { id: "c2", name: "Boronic acid", casNumber: null, molecularFormula: null },
        amount: 1.2,
        unit: "mmol",
      },
    ],
    products: [
      {
        id: "p1",
        chemical: { id: "pc1", name: "Biaryl", casNumber: null, molecularFormula: null },
        yield: 95,
        unit: "mg",
      },
    ],
    procedureMetadata: {
      temperature: "80 C",
      time: "16 h",
      solvent: "THF",
      atmosphere: "N2",
    },
    procedureText: null,
  };
}

// ---------------------------------------------------------------------------
// Yield score
// ---------------------------------------------------------------------------
describe("computeYieldScore", () => {
  it("should return 5 for yield > 90%", () => {
    expect(computeYieldScore(91)).toBe(5);
    expect(computeYieldScore(100)).toBe(5);
  });

  it("should return 4 for yield > 80% and <= 90%", () => {
    expect(computeYieldScore(81)).toBe(4);
    expect(computeYieldScore(90)).toBe(4);
  });

  it("should return 3 for yield > 70% and <= 80%", () => {
    expect(computeYieldScore(71)).toBe(3);
    expect(computeYieldScore(80)).toBe(3);
  });

  it("should return 2 for yield > 60% and <= 70%", () => {
    expect(computeYieldScore(61)).toBe(2);
    expect(computeYieldScore(70)).toBe(2);
  });

  it("should return 1 for yield <= 60%", () => {
    expect(computeYieldScore(60)).toBe(1);
    expect(computeYieldScore(50)).toBe(1);
    expect(computeYieldScore(0)).toBe(1);
  });

  it("should return 0 for null yield", () => {
    expect(computeYieldScore(null)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Completeness score
// ---------------------------------------------------------------------------
describe("computeCompletenessScore", () => {
  it("should return 0 when all fields are null/empty", () => {
    expect(computeCompletenessScore(makeEmptyInput())).toBe(0);
  });

  it("should return 5 when all categories are present", () => {
    expect(computeCompletenessScore(makeFullInput())).toBe(5);
  });

  it("should award 1 for having procedure steps", () => {
    const input = makeEmptyInput();
    input.procedureSteps = [{ stepNumber: 1, action: "Mix" }];
    expect(computeCompletenessScore(input)).toBe(1);
  });

  it("should award 1 for having procedure text instead of steps", () => {
    const input = makeEmptyInput();
    input.procedureText = "Dissolve the reagent in solvent and stir.";
    expect(computeCompletenessScore(input)).toBe(1);
  });

  it("should award 1 for reagents with amounts", () => {
    const input = makeEmptyInput();
    input.reagents = [
      {
        id: "r1",
        chemical: { id: "c1", name: "A", casNumber: null, molecularFormula: null },
        amount: 1.0,
        unit: "mmol",
      },
    ];
    expect(computeCompletenessScore(input)).toBe(1);
  });

  it("should not award for reagents without amounts", () => {
    const input = makeEmptyInput();
    input.reagents = [
      {
        id: "r1",
        chemical: { id: "c1", name: "A", casNumber: null, molecularFormula: null },
        amount: 0,
        unit: "",
      },
    ];
    expect(computeCompletenessScore(input)).toBe(0);
  });

  it("should award 1 for products with yield data", () => {
    const input = makeEmptyInput();
    input.products = [
      {
        id: "p1",
        chemical: { id: "pc1", name: "B", casNumber: null, molecularFormula: null },
        yield: 85,
        unit: "mg",
      },
    ];
    expect(computeCompletenessScore(input)).toBe(1);
  });

  it("should award 1 for practical notes", () => {
    const input = makeEmptyInput();
    input.practicalNotes = [{ type: "tip", content: "Use dry glassware" }];
    expect(computeCompletenessScore(input)).toBe(1);
  });

  it("should award 1 for conditions metadata", () => {
    const input = makeEmptyInput();
    input.procedureMetadata = { temperature: "80 C" };
    expect(computeCompletenessScore(input)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Documentation score
// ---------------------------------------------------------------------------
describe("computeDocumentationScore", () => {
  it("should return 0 for no documentation", () => {
    expect(computeDocumentationScore(makeEmptyInput())).toBe(0);
  });

  it("should score 1 for 1-2 procedure steps", () => {
    const input = makeEmptyInput();
    input.procedureSteps = [{ stepNumber: 1, action: "Mix" }];
    expect(computeDocumentationScore(input)).toBe(1);
  });

  it("should score 2 for 3-5 procedure steps", () => {
    const input = makeEmptyInput();
    input.procedureSteps = [
      { stepNumber: 1, action: "A" },
      { stepNumber: 2, action: "B" },
      { stepNumber: 3, action: "C" },
    ];
    expect(computeDocumentationScore(input)).toBe(2);
  });

  it("should score 3 for 6+ procedure steps", () => {
    const input = makeEmptyInput();
    input.procedureSteps = Array.from({ length: 6 }, (_, i) => ({
      stepNumber: i + 1,
      action: `Step ${i + 1}`,
    }));
    expect(computeDocumentationScore(input)).toBe(3);
  });

  it("should add points for observations", () => {
    const input = makeEmptyInput();
    input.practicalNotes = [
      { type: "observation", content: "A" },
      { type: "observation", content: "B" },
      { type: "observation", content: "C" },
    ];
    expect(computeDocumentationScore(input)).toBe(2);
  });

  it("should add points for deviations", () => {
    const input = makeEmptyInput();
    input.practicalNotes = [
      { type: "deviation", content: "Changed temp" },
      { type: "deviation", content: "Extended time" },
    ];
    expect(computeDocumentationScore(input)).toBe(1);
  });

  it("should cap at 5", () => {
    const input = makeFullInput();
    const score = computeDocumentationScore(input);
    expect(score).toBeLessThanOrEqual(5);
  });

  it("should use procedure text lines as fallback when no steps", () => {
    const input = makeEmptyInput();
    input.procedureText = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6";
    expect(computeDocumentationScore(input)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Reproducibility score
// ---------------------------------------------------------------------------
describe("computeReproducibilityScore", () => {
  it("should return 0 when no conditions are specified", () => {
    expect(computeReproducibilityScore(makeEmptyInput())).toBe(0);
  });

  it("should return 5 when all conditions are specified", () => {
    expect(computeReproducibilityScore(makeFullInput())).toBe(5);
  });

  it("should award 1 per specified condition", () => {
    const input = makeEmptyInput();
    input.procedureMetadata = { temperature: "80 C" };
    expect(computeReproducibilityScore(input)).toBe(1);

    input.procedureMetadata = { temperature: "80 C", time: "2 h" };
    expect(computeReproducibilityScore(input)).toBe(2);
  });

  it("should award 1 for complete reagent concentrations", () => {
    const input = makeEmptyInput();
    input.reagents = [
      {
        id: "r1",
        chemical: { id: "c1", name: "A", casNumber: null, molecularFormula: null },
        amount: 1.0,
        unit: "mmol",
      },
    ];
    expect(computeReproducibilityScore(input)).toBe(1);
  });

  it("should not award for reagents missing amounts", () => {
    const input = makeEmptyInput();
    input.reagents = [
      {
        id: "r1",
        chemical: { id: "c1", name: "A", casNumber: null, molecularFormula: null },
        amount: 0,
        unit: "mmol",
      },
    ];
    expect(computeReproducibilityScore(input)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Confidence
// ---------------------------------------------------------------------------
describe("computeConfidence", () => {
  it("should return 'low' when 0-1 dimensions are non-zero", () => {
    expect(computeConfidence({ yield: 0, completeness: 0, documentation: 0, reproducibility: 0 })).toBe("low");
    expect(computeConfidence({ yield: 3, completeness: 0, documentation: 0, reproducibility: 0 })).toBe("low");
  });

  it("should return 'medium' when 2 dimensions are non-zero", () => {
    expect(computeConfidence({ yield: 3, completeness: 2, documentation: 0, reproducibility: 0 })).toBe("medium");
  });

  it("should return 'high' when 3+ dimensions are non-zero", () => {
    expect(computeConfidence({ yield: 3, completeness: 2, documentation: 1, reproducibility: 0 })).toBe("high");
    expect(computeConfidence({ yield: 5, completeness: 5, documentation: 5, reproducibility: 5 })).toBe("high");
  });
});

// ---------------------------------------------------------------------------
// Composite: computeEnhancedQualityScore
// ---------------------------------------------------------------------------
describe("computeEnhancedQualityScore", () => {
  it("should return overall score clamped to 1-5 integer range", () => {
    const result = computeEnhancedQualityScore(makeEmptyInput());
    expect(result.overall).toBeGreaterThanOrEqual(1);
    expect(result.overall).toBeLessThanOrEqual(5);
    expect(Number.isInteger(result.overall)).toBe(true);
  });

  it("should score a perfect experiment as 5", () => {
    const result = computeEnhancedQualityScore(makeFullInput());
    expect(result.overall).toBe(5);
    expect(result.confidence).toBe("high");
  });

  it("should score an empty experiment as 1 (clamped)", () => {
    const result = computeEnhancedQualityScore(makeEmptyInput());
    expect(result.overall).toBe(1);
    expect(result.confidence).toBe("low");
  });

  it("should include breakdown with all four dimensions", () => {
    const result = computeEnhancedQualityScore(makeFullInput());
    expect(result.breakdown).toHaveProperty("yield");
    expect(result.breakdown).toHaveProperty("completeness");
    expect(result.breakdown).toHaveProperty("documentation");
    expect(result.breakdown).toHaveProperty("reproducibility");
  });

  it("should apply correct weights (40/25/20/15)", () => {
    // Construct input where we know exact dimension scores
    const input = makeEmptyInput();
    input.yieldPercent = 95; // yield = 5
    // completeness = 0, documentation = 0, reproducibility = 0
    const result = computeEnhancedQualityScore(input);
    // weighted = 5*0.4 + 0*0.25 + 0*0.20 + 0*0.15 = 2.0
    expect(result.overall).toBe(2);
  });

  it("should calculate weighted composite correctly for mixed scores", () => {
    const input = makeEmptyInput();
    input.yieldPercent = 85; // yield = 4
    input.procedureSteps = [
      { stepNumber: 1, action: "A" },
      { stepNumber: 2, action: "B" },
      { stepNumber: 3, action: "C" },
    ]; // completeness += 1 (procedure), documentation = 2 (3-5 steps)
    input.reagents = [
      {
        id: "r1",
        chemical: { id: "c1", name: "X", casNumber: null, molecularFormula: null },
        amount: 1.0,
        unit: "mmol",
      },
    ]; // completeness += 1 (reagents with amounts), reproducibility += 1 (concentrations)
    input.procedureMetadata = { temperature: "80 C", time: "2 h" }; // completeness += 1 (conditions), reproducibility += 2

    // yield=4, completeness=3, documentation=2, reproducibility=3
    // weighted = 4*0.4 + 3*0.25 + 2*0.2 + 3*0.15 = 1.6 + 0.75 + 0.4 + 0.45 = 3.2
    // round(3.2) = 3
    const result = computeEnhancedQualityScore(input);
    expect(result.overall).toBe(3);
    expect(result.confidence).toBe("high");
  });

  it("should clamp scores below 1 to 1", () => {
    // All zero dimensions => weighted = 0 => clamped to 1
    const result = computeEnhancedQualityScore(makeEmptyInput());
    expect(result.overall).toBe(1);
  });

  it("should clamp scores above 5 to 5", () => {
    // All max dimensions => weighted = 5 => stays 5
    const result = computeEnhancedQualityScore(makeFullInput());
    expect(result.overall).toBe(5);
  });

  it("should produce consistent results for the same input", () => {
    const input = makeFullInput();
    const r1 = computeEnhancedQualityScore(input);
    const r2 = computeEnhancedQualityScore(input);
    expect(r1).toEqual(r2);
  });
});

// ---------------------------------------------------------------------------
// Realistic experiment data
// ---------------------------------------------------------------------------
describe("realistic experiment scenarios", () => {
  it("should score a Suzuki coupling with good data highly", () => {
    const input: QualityScoringInput = {
      yieldPercent: 88,
      status: "completed",
      procedureSteps: [
        { stepNumber: 1, action: "Charge flask with Pd catalyst" },
        { stepNumber: 2, action: "Add aryl bromide and boronic acid" },
        { stepNumber: 3, action: "Add base and solvent" },
        { stepNumber: 4, action: "Heat to 80C under N2" },
        { stepNumber: 5, action: "Monitor by TLC" },
        { stepNumber: 6, action: "Cool and extract" },
        { stepNumber: 7, action: "Purify by column chromatography" },
      ],
      practicalNotes: [
        { type: "observation", content: "Reaction turned dark brown after 2h" },
        { type: "tip", content: "Degas solvent thoroughly" },
      ],
      reagents: [
        { id: "r1", chemical: { id: "c1", name: "4-Bromoanisole", casNumber: "104-92-7", molecularFormula: "C7H7BrO" }, amount: 1.0, unit: "mmol" },
        { id: "r2", chemical: { id: "c2", name: "Phenylboronic acid", casNumber: "98-80-6", molecularFormula: "C6H7BO2" }, amount: 1.2, unit: "mmol" },
        { id: "r3", chemical: { id: "c3", name: "Pd(PPh3)4", casNumber: "14221-01-3", molecularFormula: null }, amount: 0.05, unit: "mmol" },
      ],
      products: [
        { id: "p1", chemical: { id: "pc1", name: "4-Methoxybiphenyl", casNumber: null, molecularFormula: null }, yield: 88, unit: "mg" },
      ],
      procedureMetadata: {
        temperature: "80 C",
        time: "16 h",
        solvent: "THF/H2O",
        atmosphere: "N2",
      },
      procedureText: null,
    };

    const result = computeEnhancedQualityScore(input);
    expect(result.overall).toBeGreaterThanOrEqual(4);
    expect(result.confidence).toBe("high");
  });

  it("should score a failed experiment with poor documentation low", () => {
    const input: QualityScoringInput = {
      yieldPercent: 12,
      status: "failed",
      procedureSteps: null,
      practicalNotes: null,
      reagents: null,
      products: null,
      procedureMetadata: null,
      procedureText: null,
    };

    const result = computeEnhancedQualityScore(input);
    expect(result.overall).toBeLessThanOrEqual(2);
    expect(result.confidence).toBe("low");
  });

  it("should score a well-documented failed experiment moderately", () => {
    const input: QualityScoringInput = {
      yieldPercent: 15,
      status: "failed",
      procedureSteps: [
        { stepNumber: 1, action: "Prepare substrate" },
        { stepNumber: 2, action: "Add reagent" },
        { stepNumber: 3, action: "Heat" },
        { stepNumber: 4, action: "Observe failure" },
      ],
      practicalNotes: [
        { type: "observation", content: "No reaction observed at 60C" },
        { type: "observation", content: "Starting material recovered" },
        { type: "deviation", content: "Increased temperature to 100C - still no reaction" },
      ],
      reagents: [
        { id: "r1", chemical: { id: "c1", name: "A", casNumber: null, molecularFormula: null }, amount: 0.5, unit: "mmol" },
      ],
      products: [],
      procedureMetadata: {
        temperature: "60-100 C",
        time: "24 h",
        solvent: "DMF",
      },
      procedureText: null,
    };

    const result = computeEnhancedQualityScore(input);
    // Low yield pulls it down, but documentation and reproducibility help
    expect(result.overall).toBeGreaterThanOrEqual(2);
    expect(result.confidence).toBe("high");
  });
});

// ---------------------------------------------------------------------------
// Adapter: experimentDataToScoringInput
// ---------------------------------------------------------------------------
describe("experimentDataToScoringInput", () => {
  it("should convert ExperimentData to QualityScoringInput", () => {
    const experiment: ExperimentData = {
      id: "exp-001",
      title: "Test Experiment",
      experimentType: "Suzuki coupling",
      status: "completed",
      createdBy: "researcher-1",
      createdAt: "2026-01-15",
      actualProcedure: [
        { stepNumber: 1, action: "Mix reagents" },
        { stepNumber: 2, action: "Heat" },
      ],
      procedureMetadata: { temperature: "80 C", solvent: "THF" },
      reagents: [
        {
          id: "r1",
          chemical: { id: "c1", name: "Reagent A", casNumber: null, molecularFormula: null },
          amount: 1.0,
          unit: "mmol",
        },
      ],
      products: [
        {
          id: "p1",
          chemical: { id: "pc1", name: "Product B", casNumber: null, molecularFormula: null },
          yield: 85,
          unit: "mg",
        },
      ],
      practicalNotes: [
        { type: "observation", content: "Color change" },
      ],
    };

    const input = experimentDataToScoringInput(experiment);
    expect(input.yieldPercent).toBe(85);
    expect(input.status).toBe("completed");
    expect(input.procedureSteps).toHaveLength(2);
    expect(input.practicalNotes).toHaveLength(1);
    expect(input.reagents).toHaveLength(1);
    expect(input.products).toHaveLength(1);
    expect(input.procedureMetadata?.temperature).toBe("80 C");
  });

  it("should handle experiment with no products gracefully", () => {
    const experiment: ExperimentData = {
      id: "exp-002",
      title: "No products",
      experimentType: "test",
      status: "in-progress",
      createdBy: "researcher-1",
      createdAt: "2026-01-15",
      actualProcedure: null,
      procedureMetadata: null,
      reagents: [],
      products: [],
    };

    const input = experimentDataToScoringInput(experiment);
    expect(input.yieldPercent).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Adapter: rawFieldsToScoringInput
// ---------------------------------------------------------------------------
describe("rawFieldsToScoringInput", () => {
  it("should create input from raw numeric fields", () => {
    const input = rawFieldsToScoringInput({
      yieldPercent: 85,
      stepCount: 4,
      reagentCount: 2,
      hasReagentAmounts: true,
      productCount: 1,
      hasProductYield: true,
      observationCount: 2,
      deviationCount: 1,
      temperature: "80 C",
      time: "2 h",
    });

    expect(input.yieldPercent).toBe(85);
    expect(input.procedureSteps).toHaveLength(4);
    expect(input.reagents).toHaveLength(2);
    expect(input.products).toHaveLength(1);
    expect(input.practicalNotes).toHaveLength(3);
    expect(input.procedureMetadata?.temperature).toBe("80 C");
  });

  it("should handle all-empty fields", () => {
    const input = rawFieldsToScoringInput({});
    expect(input.yieldPercent).toBeNull();
    expect(input.procedureSteps).toBeNull();
    expect(input.reagents).toBeNull();
    expect(input.products).toBeNull();
    expect(input.practicalNotes).toBeNull();
    expect(input.procedureMetadata).toBeNull();
  });
});
