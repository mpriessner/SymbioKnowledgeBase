import { describe, it, expect } from "vitest";
import {
  extractKeyLearnings,
  aggregateLearningsForReactionType,
  classifyLearning,
  computeTextSimilarity,
} from "@/lib/chemEln/enrichment/keyLearnings";
import type {
  ExperimentWithNotes,
  RankedLearning,
} from "@/lib/chemEln/enrichment/keyLearnings";
import type { PracticalNotesResult } from "@/lib/chemEln/enrichment/types";

function makeEmptyNotes(): PracticalNotesResult {
  return {
    hasData: false,
    whatWorked: [],
    challenges: [],
    recommendations: [],
    timingTips: [],
    safetyNotes: [],
    deviations: [],
    tips: [],
  };
}

function makeExperiment(overrides: Partial<ExperimentWithNotes> = {}): ExperimentWithNotes {
  return {
    id: "exp-001",
    title: "EXP-2026-001",
    researcher: "Dr. Anna Mueller",
    date: "2026-03-15",
    qualityScore: 4.5,
    yieldPercent: 85,
    practicalNotes: makeEmptyNotes(),
    ...overrides,
  };
}

function makeNotesWithTips(tips: string[], extra: Partial<PracticalNotesResult> = {}): PracticalNotesResult {
  return {
    ...makeEmptyNotes(),
    hasData: true,
    tips,
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// classifyLearning
// ---------------------------------------------------------------------------

describe("classifyLearning", () => {
  it("should classify warning-related text as 'warning'", () => {
    expect(classifyLearning("Avoid using excess base, it causes decomposition")).toBe("warning");
    expect(classifyLearning("Caution: exothermic reaction at high concentration")).toBe("warning");
    expect(classifyLearning("Do not heat above 100°C")).toBe("warning");
  });

  it("should classify condition-related text as 'condition'", () => {
    expect(classifyLearning("Use THF as solvent for best results")).toBe("condition");
    expect(classifyLearning("Optimal temperature is 80°C")).toBe("condition");
    expect(classifyLearning("Pd(PPh3)4 catalyst at 5 mol% loading")).toBe("condition");
  });

  it("should classify technique-related text as 'technique'", () => {
    expect(classifyLearning("Monitor by TLC every 30 minutes")).toBe("technique");
    expect(classifyLearning("Use column chromatography for purification")).toBe("technique");
    expect(classifyLearning("Add reagent dropwise over 20 minutes")).toBe("technique");
  });

  it("should classify general advice as 'tip'", () => {
    expect(classifyLearning("Use fresh reagents for best results")).toBe("tip");
    expect(classifyLearning("This works well on gram scale")).toBe("tip");
  });
});

// ---------------------------------------------------------------------------
// computeTextSimilarity
// ---------------------------------------------------------------------------

describe("computeTextSimilarity", () => {
  it("should return 1 for identical texts", () => {
    expect(computeTextSimilarity("Use 10% excess substrate", "Use 10% excess substrate")).toBe(1);
  });

  it("should return high similarity for nearly identical texts", () => {
    const sim = computeTextSimilarity(
      "Use 10% excess substrate for heteroaryl couplings",
      "Use 10% excess substrate for heteroaryl reactions"
    );
    expect(sim).toBeGreaterThan(0.5);
  });

  it("should return low similarity for different texts", () => {
    const sim = computeTextSimilarity(
      "Use 10% excess substrate",
      "Monitor TLC carefully at 2h mark"
    );
    expect(sim).toBeLessThan(0.3);
  });

  it("should handle empty strings", () => {
    expect(computeTextSimilarity("", "")).toBe(1);
    expect(computeTextSimilarity("hello world test", "")).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// extractKeyLearnings — basic extraction
// ---------------------------------------------------------------------------

describe("extractKeyLearnings", () => {
  it("should extract learnings from practical notes tips", () => {
    const experiments: ExperimentWithNotes[] = [
      makeExperiment({
        practicalNotes: makeNotesWithTips([
          "Use 10% excess substrate for heteroaryl couplings",
          "Monitor TLC at 2h mark",
        ]),
      }),
    ];

    const learnings = extractKeyLearnings(experiments, "Suzuki Coupling");
    expect(learnings).toHaveLength(2);
    expect(learnings[0].text).toBeDefined();
    expect(learnings[0].sourceExperiments).toHaveLength(1);
    expect(learnings[0].sourceExperiments[0].title).toBe("EXP-2026-001");
  });

  it("should extract learnings from whatWorked entries", () => {
    const experiments: ExperimentWithNotes[] = [
      makeExperiment({
        practicalNotes: {
          ...makeEmptyNotes(),
          hasData: true,
          whatWorked: [
            { text: "Dropwise addition gave clean product", importance: "informational" },
          ],
        },
      }),
    ];

    const learnings = extractKeyLearnings(experiments, "Suzuki Coupling");
    expect(learnings).toHaveLength(1);
    expect(learnings[0].text).toBe("Dropwise addition gave clean product");
  });

  it("should extract learnings from challenges as warnings", () => {
    const experiments: ExperimentWithNotes[] = [
      makeExperiment({
        practicalNotes: {
          ...makeEmptyNotes(),
          hasData: true,
          challenges: [
            { text: "Step 3: Filtration was slow due to precipitate clogging", importance: "important" },
          ],
        },
      }),
    ];

    const learnings = extractKeyLearnings(experiments, "Suzuki Coupling");
    expect(learnings).toHaveLength(1);
    expect(learnings[0].category).toBe("warning");
  });

  it("should extract overall notes from high-quality experiments", () => {
    const experiments: ExperimentWithNotes[] = [
      makeExperiment({
        qualityScore: 4.5,
        practicalNotes: {
          ...makeEmptyNotes(),
          hasData: true,
          overallNotes: "This Suzuki coupling works best with degassed solvent and Pd(PPh3)4 catalyst at room temperature",
        },
      }),
    ];

    const learnings = extractKeyLearnings(experiments, "Suzuki Coupling");
    expect(learnings).toHaveLength(1);
    expect(learnings[0].text).toContain("degassed");
  });

  it("should NOT extract overall notes from low-quality experiments", () => {
    const experiments: ExperimentWithNotes[] = [
      makeExperiment({
        qualityScore: 2.5,
        practicalNotes: {
          ...makeEmptyNotes(),
          hasData: true,
          overallNotes: "This Suzuki coupling works best with degassed solvent and Pd(PPh3)4",
        },
      }),
    ];

    const learnings = extractKeyLearnings(experiments, "Suzuki Coupling");
    expect(learnings).toHaveLength(0);
  });

  it("should return empty array when no practical notes", () => {
    const experiments: ExperimentWithNotes[] = [
      makeExperiment({ practicalNotes: makeEmptyNotes() }),
    ];
    const learnings = extractKeyLearnings(experiments, "Suzuki Coupling");
    expect(learnings).toHaveLength(0);
  });

  it("should return empty array for empty experiment list", () => {
    const learnings = extractKeyLearnings([], "Suzuki Coupling");
    expect(learnings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

describe("extractKeyLearnings — ranking", () => {
  it("should rank high-confidence learnings above low-confidence", () => {
    // Same tip from 3 experiments vs unique tip from 1 experiment
    const sharedTip = "Use 10% excess boronic acid for electron-poor substrates";
    const uniqueTip = "Reaction works at room temperature for simple aryl halides";

    const experiments: ExperimentWithNotes[] = [
      makeExperiment({
        id: "exp-001",
        title: "EXP-2026-001",
        researcher: "Dr. Mueller",
        qualityScore: 4.0,
        practicalNotes: makeNotesWithTips([sharedTip]),
      }),
      makeExperiment({
        id: "exp-002",
        title: "EXP-2026-002",
        researcher: "Dr. Chen",
        qualityScore: 4.0,
        practicalNotes: makeNotesWithTips([sharedTip]),
      }),
      makeExperiment({
        id: "exp-003",
        title: "EXP-2026-003",
        researcher: "Dr. Smith",
        qualityScore: 4.0,
        practicalNotes: makeNotesWithTips([sharedTip]),
      }),
      makeExperiment({
        id: "exp-004",
        title: "EXP-2026-004",
        researcher: "Dr. Lee",
        qualityScore: 4.5,
        practicalNotes: makeNotesWithTips([uniqueTip]),
      }),
    ];

    const learnings = extractKeyLearnings(experiments, "Suzuki Coupling");

    // The shared tip (high confidence, 3 sources) should rank first
    const sharedIndex = learnings.findIndex((l) => l.text === sharedTip);
    const uniqueIndex = learnings.findIndex((l) =>
      l.text.includes("room temperature")
    );

    expect(sharedIndex).toBeLessThan(uniqueIndex);
    expect(learnings[sharedIndex].confidence).toBe("high");
    expect(learnings[uniqueIndex].confidence).toBe("low");
  });

  it("should rank by quality weight when confidence is the same", () => {
    const experiments: ExperimentWithNotes[] = [
      makeExperiment({
        id: "exp-001",
        title: "EXP-2026-001",
        qualityScore: 5.0,
        practicalNotes: makeNotesWithTips(["High quality tip about catalyst loading"]),
      }),
      makeExperiment({
        id: "exp-002",
        title: "EXP-2026-002",
        qualityScore: 2.0,
        practicalNotes: makeNotesWithTips(["Low quality tip about general stuff"]),
      }),
    ];

    const learnings = extractKeyLearnings(experiments, "Suzuki Coupling");
    expect(learnings).toHaveLength(2);
    // Both are low confidence (single source), so qualityWeight decides
    expect(learnings[0].qualityWeight).toBeGreaterThan(learnings[1].qualityWeight);
  });
});

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

describe("extractKeyLearnings — deduplication", () => {
  it("should deduplicate similar learnings and merge sources", () => {
    const experiments: ExperimentWithNotes[] = [
      makeExperiment({
        id: "exp-001",
        title: "EXP-2026-001",
        researcher: "Dr. Mueller",
        practicalNotes: makeNotesWithTips([
          "Use 10% excess substrate for heteroaryl coupling reactions",
        ]),
      }),
      makeExperiment({
        id: "exp-002",
        title: "EXP-2026-002",
        researcher: "Dr. Chen",
        practicalNotes: makeNotesWithTips([
          "Use 10% excess substrate for heteroaryl couplings reactions",
        ]),
      }),
    ];

    const learnings = extractKeyLearnings(experiments, "Suzuki Coupling");

    // Should be deduplicated into one learning
    const substrateLearnings = learnings.filter((l) =>
      l.text.toLowerCase().includes("excess substrate")
    );
    expect(substrateLearnings).toHaveLength(1);
    expect(substrateLearnings[0].sourceExperiments).toHaveLength(2);
    expect(substrateLearnings[0].confidence).toBe("medium");
  });

  it("should NOT merge dissimilar learnings", () => {
    const experiments: ExperimentWithNotes[] = [
      makeExperiment({
        id: "exp-001",
        title: "EXP-2026-001",
        practicalNotes: makeNotesWithTips([
          "Use 10% excess substrate for heteroaryl couplings",
          "Monitor TLC every 30 minutes until completion",
        ]),
      }),
    ];

    const learnings = extractKeyLearnings(experiments, "Suzuki Coupling");
    expect(learnings).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Top-10 limit
// ---------------------------------------------------------------------------

describe("extractKeyLearnings — top 10 limit", () => {
  it("should limit output to 10 learnings", () => {
    const tips = Array.from({ length: 15 }, (_, i) =>
      `Unique learning number ${i + 1} about different topic ${i + 1} in chemistry`
    );

    const experiments: ExperimentWithNotes[] = [
      makeExperiment({
        practicalNotes: makeNotesWithTips(tips),
      }),
    ];

    const learnings = extractKeyLearnings(experiments, "Suzuki Coupling");
    expect(learnings.length).toBeLessThanOrEqual(10);
  });
});

// ---------------------------------------------------------------------------
// Common pitfalls extraction
// ---------------------------------------------------------------------------

describe("aggregateLearningsForReactionType — common pitfalls", () => {
  it("should extract warning-category learnings as common pitfalls", () => {
    const experiments: ExperimentWithNotes[] = [
      makeExperiment({
        practicalNotes: {
          ...makeEmptyNotes(),
          hasData: true,
          tips: ["Use fresh Pd catalyst for best results"],
          challenges: [
            { text: "Step 2: Reaction failed when run at temperatures above 120 degrees", importance: "important" },
          ],
        },
      }),
    ];

    const result = aggregateLearningsForReactionType("Suzuki Coupling", experiments);
    expect(result.commonPitfalls.length).toBeGreaterThanOrEqual(1);
    expect(result.commonPitfalls.every((p) => p.category === "warning")).toBe(true);
  });

  it("should return empty pitfalls when there are no warnings", () => {
    const experiments: ExperimentWithNotes[] = [
      makeExperiment({
        practicalNotes: makeNotesWithTips(["General tip about running reaction smoothly"]),
      }),
    ];

    const result = aggregateLearningsForReactionType("Suzuki Coupling", experiments);
    expect(result.commonPitfalls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Best conditions aggregation
// ---------------------------------------------------------------------------

describe("aggregateLearningsForReactionType — best conditions", () => {
  it("should extract most common conditions from high-quality experiments", () => {
    const experiments: ExperimentWithNotes[] = [
      makeExperiment({
        id: "exp-001",
        qualityScore: 4.5,
        practicalNotes: makeNotesWithTips(["Tip A"]),
        conditions: { temperature: "80°C", solvent: "THF", catalyst: "Pd(PPh3)4" },
      }),
      makeExperiment({
        id: "exp-002",
        qualityScore: 4.0,
        practicalNotes: makeNotesWithTips(["Tip B"]),
        conditions: { temperature: "80°C", solvent: "THF", catalyst: "Pd(dppf)Cl2" },
      }),
      makeExperiment({
        id: "exp-003",
        qualityScore: 4.2,
        practicalNotes: makeNotesWithTips(["Tip C"]),
        conditions: { temperature: "100°C", solvent: "DMF", catalyst: "Pd(PPh3)4" },
      }),
    ];

    const result = aggregateLearningsForReactionType("Suzuki Coupling", experiments);
    expect(result.bestConditions.temperature).toBe("80°C");
    expect(result.bestConditions.solvent).toBe("THF");
    expect(result.bestConditions.catalyst).toBe("Pd(PPh3)4");
  });

  it("should ignore low-quality experiments for best conditions", () => {
    const experiments: ExperimentWithNotes[] = [
      makeExperiment({
        id: "exp-001",
        qualityScore: 2.0,
        practicalNotes: makeNotesWithTips(["Tip"]),
        conditions: { temperature: "50°C", solvent: "Hexane" },
      }),
      makeExperiment({
        id: "exp-002",
        qualityScore: 4.5,
        practicalNotes: makeNotesWithTips(["Good tip"]),
        conditions: { temperature: "80°C", solvent: "THF" },
      }),
    ];

    const result = aggregateLearningsForReactionType("Suzuki Coupling", experiments);
    expect(result.bestConditions.temperature).toBe("80°C");
    expect(result.bestConditions.solvent).toBe("THF");
  });

  it("should return null for conditions when no high-quality experiments have conditions", () => {
    const experiments: ExperimentWithNotes[] = [
      makeExperiment({
        qualityScore: 4.5,
        practicalNotes: makeNotesWithTips(["Tip"]),
        // no conditions
      }),
    ];

    const result = aggregateLearningsForReactionType("Suzuki Coupling", experiments);
    expect(result.bestConditions.temperature).toBeNull();
    expect(result.bestConditions.solvent).toBeNull();
    expect(result.bestConditions.catalyst).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Realistic chemistry data integration test
// ---------------------------------------------------------------------------

describe("extractKeyLearnings — realistic chemistry data", () => {
  it("should handle a realistic Suzuki coupling dataset", () => {
    const experiments: ExperimentWithNotes[] = [
      makeExperiment({
        id: "exp-2026-156",
        title: "EXP-2026-156",
        researcher: "Dr. Anna Mueller",
        date: "2026-03-10",
        qualityScore: 4.5,
        yieldPercent: 92,
        practicalNotes: {
          ...makeEmptyNotes(),
          hasData: true,
          tips: [
            "Use 10% excess boronic acid for electron-poor heteroaryl substrates",
            "Monitor color change at 50°C as indicator of catalyst activation",
          ],
          whatWorked: [
            { text: "Step 3 (degassing): Complete conversion observed after degassing for 15 min", importance: "informational" },
          ],
          overallNotes: "Suzuki coupling with Pd(PPh3)4 in THF/H2O at 80°C gave excellent yield for heteroaryl substrate scope",
        },
        conditions: { temperature: "80°C", solvent: "THF/H2O", catalyst: "Pd(PPh3)4" },
      }),
      makeExperiment({
        id: "exp-2026-089",
        title: "EXP-2026-089",
        researcher: "Dr. James Chen",
        date: "2026-01-20",
        qualityScore: 4.0,
        yieldPercent: 78,
        practicalNotes: {
          ...makeEmptyNotes(),
          hasData: true,
          tips: [
            "TLC monitoring at 2h mark recommended — reaction usually complete by then",
          ],
          challenges: [
            { text: "Step 5: Slow filtration due to Pd black precipitate clogging the filter", importance: "important" },
          ],
        },
        conditions: { temperature: "80°C", solvent: "THF/H2O", catalyst: "Pd(PPh3)4" },
      }),
      makeExperiment({
        id: "exp-2025-234",
        title: "EXP-2025-234",
        researcher: "Dr. Sarah Kim",
        date: "2025-11-05",
        qualityScore: 3.0,
        yieldPercent: 65,
        practicalNotes: {
          ...makeEmptyNotes(),
          hasData: true,
          tips: [
            "Use 10% excess boronic acid for heteroaryl coupling reactions",
          ],
        },
        conditions: { temperature: "100°C", solvent: "DMF/H2O", catalyst: "Pd(PPh3)4" },
      }),
    ];

    const result = aggregateLearningsForReactionType("Suzuki Coupling", experiments);

    // Should have extracted learnings
    expect(result.keyLearnings.length).toBeGreaterThan(0);
    expect(result.keyLearnings.length).toBeLessThanOrEqual(10);

    // The duplicate "Use 10% excess" tip should be merged
    const excessTips = result.keyLearnings.filter((l) =>
      l.text.toLowerCase().includes("excess boronic acid")
    );
    expect(excessTips).toHaveLength(1);
    // Should have sources from both Mueller and Kim
    expect(excessTips[0].sourceExperiments.length).toBeGreaterThanOrEqual(2);
    expect(excessTips[0].confidence).toBe("medium");

    // Should have a pitfall about filtration
    expect(result.commonPitfalls.length).toBeGreaterThanOrEqual(1);
    const filtrationPitfall = result.commonPitfalls.find((p) =>
      p.text.toLowerCase().includes("filtration")
    );
    expect(filtrationPitfall).toBeDefined();

    // Best conditions: 80°C is most common among high-quality
    expect(result.bestConditions.temperature).toBe("80°C");
    expect(result.bestConditions.catalyst).toBe("Pd(PPh3)4");
  });
});
