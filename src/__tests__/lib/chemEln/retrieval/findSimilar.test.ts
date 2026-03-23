import { describe, it, expect } from "vitest";
import {
  findSimilarExperiments,
  buildSimilarityContext,
  formatSimilarExperimentsForAgent,
  type ExperimentEntry,
  type ExperimentRef,
  type SimilarityQuery,
} from "@/lib/chemEln/retrieval/findSimilar";

const EXPERIMENTS: ExperimentEntry[] = [
  {
    experimentTitle: "EXP-2026-0042",
    reactionType: "Suzuki Coupling",
    substrateClass: "heteroaryl",
    chemicals: ["Pd(PPh3)4", "K2CO3", "DMF"],
    researcher: "Dr. Jane Mueller",
    scaleCategory: "medium",
    qualityScore: 4,
    yield: 89,
    date: "2026-03-15",
  },
  {
    experimentTitle: "EXP-2025-0312",
    reactionType: "Suzuki Coupling",
    substrateClass: "aryl",
    chemicals: ["Pd(PPh3)4", "Cs2CO3", "DMF"],
    researcher: "Dr. Wei Chen",
    scaleCategory: "large",
    qualityScore: 5,
    yield: 84,
    date: "2025-11-08",
  },
  {
    experimentTitle: "EXP-2025-0289",
    reactionType: "Suzuki Coupling",
    substrateClass: "heteroaryl",
    chemicals: ["Pd(OAc)2", "K2CO3", "THF"],
    researcher: "Dr. Anika Patel",
    scaleCategory: "small",
    qualityScore: 3,
    yield: 78,
    date: "2025-09-22",
  },
  {
    experimentTitle: "EXP-2026-0050",
    reactionType: "Heck Reaction",
    substrateClass: "vinyl",
    chemicals: ["Pd(OAc)2", "Et3N", "DMF"],
    researcher: "Dr. Jane Mueller",
    scaleCategory: "medium",
    qualityScore: 4,
    yield: 72,
    date: "2026-02-10",
  },
  {
    experimentTitle: "EXP-2025-0100",
    reactionType: "Grignard Reaction",
    substrateClass: "alkyl",
    chemicals: ["MgBr2", "THF"],
    researcher: "Dr. Wei Chen",
    scaleCategory: "large",
    qualityScore: 5,
    yield: 91,
    date: "2025-06-01",
  },
  {
    experimentTitle: "EXP-2025-0200",
    reactionType: "Suzuki Coupling",
    substrateClass: "heteroaryl",
    chemicals: ["Pd(PPh3)4", "K2CO3", "DMF", "X-Phos"],
    researcher: "Dr. Jane Mueller",
    scaleCategory: "medium",
    qualityScore: 2,
    yield: 45,
    date: "2025-07-12",
  },
];

// ---------------------------------------------------------------------------
// Scoring algorithm
// ---------------------------------------------------------------------------

describe("findSimilarExperiments - scoring", () => {
  it("should award +3 for same reaction type", () => {
    const query: SimilarityQuery = { reactionType: "Heck Reaction" };
    const results = findSimilarExperiments(query, EXPERIMENTS);

    const heckExp = results.find(
      (r) => r.experimentTitle === "EXP-2026-0050"
    )!;
    const suzukiExp = results.find(
      (r) => r.experimentTitle === "EXP-2026-0042"
    )!;

    // Heck should get +3 for reaction match; Suzuki should not
    // Both also get quality bonus, so compare relative
    expect(heckExp.score - suzukiExp.score).toBeCloseTo(3, 5);
    expect(heckExp.matchReasons).toContain(
      "Same reaction type: Heck Reaction"
    );
  });

  it("should award +2 for same substrate class", () => {
    const query: SimilarityQuery = { substrateClass: "heteroaryl" };
    const results = findSimilarExperiments(query, EXPERIMENTS);

    const heteroarylExp = results.find(
      (r) => r.experimentTitle === "EXP-2026-0042"
    )!;
    const arylExp = results.find(
      (r) => r.experimentTitle === "EXP-2025-0312"
    )!;

    // Both have quality bonus; heteroaryl match gets +2
    expect(heteroarylExp.score - arylExp.score).toBeCloseTo(2 + (4 - 5) * 0.5, 5);
    expect(heteroarylExp.matchReasons).toContain(
      "Same substrate class: heteroaryl"
    );
  });

  it("should award +1 per matching chemical up to 5", () => {
    const query: SimilarityQuery = {
      chemicals: ["Pd(PPh3)4", "K2CO3", "DMF"],
    };
    const results = findSimilarExperiments(query, EXPERIMENTS);

    // EXP-2026-0042 has all 3 chemicals
    const exp42 = results.find(
      (r) => r.experimentTitle === "EXP-2026-0042"
    )!;
    expect(exp42.matchReasons.filter((r) => r.startsWith("Uses chemical:"))).toHaveLength(3);
    // Score should include +3 for chemicals + quality bonus (4*0.5 = 2) = 5
    expect(exp42.score).toBeCloseTo(3 + 4 * 0.5, 5);
  });

  it("should cap chemical matches at 5 points", () => {
    const manyChemicals = [
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
      "G",
    ];
    const expWithMany: ExperimentEntry = {
      experimentTitle: "EXP-MANY",
      chemicals: manyChemicals,
      researcher: "Test",
      qualityScore: 0,
      date: "2026-01-01",
    };

    const query: SimilarityQuery = {
      chemicals: manyChemicals,
    };
    const results = findSimilarExperiments(query, [expWithMany]);
    // 7 chemicals match but capped at 5
    expect(results[0].score).toBeCloseTo(5, 5);
  });

  it("should award +1 for same researcher", () => {
    const query: SimilarityQuery = { researcher: "Dr. Jane Mueller" };
    const results = findSimilarExperiments(query, EXPERIMENTS);

    const muellerExp = results.find(
      (r) => r.experimentTitle === "EXP-2026-0042"
    )!;
    expect(muellerExp.matchReasons).toContain(
      "Same researcher: Dr. Jane Mueller"
    );
  });

  it("should award +1 for same scale category", () => {
    const query: SimilarityQuery = { scaleCategory: "large" };
    const results = findSimilarExperiments(query, EXPERIMENTS);

    const largeExp = results.find(
      (r) => r.experimentTitle === "EXP-2025-0312"
    )!;
    expect(largeExp.matchReasons).toContain("Same scale category: large");
  });

  it("should add +0.5 per quality point", () => {
    const query: SimilarityQuery = {};
    const results = findSimilarExperiments(query, EXPERIMENTS);

    // With no query criteria, score is purely quality-based
    const q5exp = results.find(
      (r) => r.experimentTitle === "EXP-2025-0312"
    )!;
    const q3exp = results.find(
      (r) => r.experimentTitle === "EXP-2025-0289"
    )!;

    expect(q5exp.score).toBeCloseTo(5 * 0.5, 5);
    expect(q3exp.score).toBeCloseTo(3 * 0.5, 5);
  });

  it("should combine multiple scoring factors", () => {
    const query: SimilarityQuery = {
      reactionType: "Suzuki Coupling",
      substrateClass: "heteroaryl",
      chemicals: ["Pd(PPh3)4", "K2CO3"],
      researcher: "Dr. Jane Mueller",
      scaleCategory: "medium",
    };
    const results = findSimilarExperiments(query, EXPERIMENTS);

    // EXP-2026-0042 matches all criteria:
    // +3 reaction + 2 substrate + 2 chemicals + 1 researcher + 1 scale + 2 quality = 11
    const exp42 = results.find(
      (r) => r.experimentTitle === "EXP-2026-0042"
    )!;
    const expectedScore = 3 + 2 + 2 + 1 + 1 + 4 * 0.5;
    expect(exp42.score).toBeCloseTo(expectedScore, 5);
  });
});

// ---------------------------------------------------------------------------
// Reaction type matching
// ---------------------------------------------------------------------------

describe("findSimilarExperiments - reaction type matching", () => {
  it("should be case-insensitive for reaction type", () => {
    const query: SimilarityQuery = { reactionType: "suzuki coupling" };
    const results = findSimilarExperiments(query, EXPERIMENTS);

    const suzukiResults = results.filter((r) =>
      r.matchReasons.some((m) => m.startsWith("Same reaction type:"))
    );
    expect(suzukiResults.length).toBe(4);
  });

  it("should not match different reaction types", () => {
    const query: SimilarityQuery = { reactionType: "Buchwald-Hartwig" };
    const results = findSimilarExperiments(query, EXPERIMENTS);

    const matchedReaction = results.filter((r) =>
      r.matchReasons.some((m) => m.startsWith("Same reaction type:"))
    );
    expect(matchedReaction.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Chemical matching
// ---------------------------------------------------------------------------

describe("findSimilarExperiments - chemical matching", () => {
  it("should match chemicals case-insensitively", () => {
    const query: SimilarityQuery = { chemicals: ["pd(pph3)4"] };
    const results = findSimilarExperiments(query, EXPERIMENTS);

    const matched = results.filter((r) =>
      r.matchReasons.some((m) => m.startsWith("Uses chemical:"))
    );
    expect(matched.length).toBeGreaterThan(0);
  });

  it("should match multiple chemicals independently", () => {
    const query: SimilarityQuery = { chemicals: ["K2CO3", "THF"] };
    const results = findSimilarExperiments(query, EXPERIMENTS);

    // EXP-2025-0289 has both K2CO3 and THF
    const exp289 = results.find(
      (r) => r.experimentTitle === "EXP-2025-0289"
    )!;
    const chemReasons = exp289.matchReasons.filter((m) =>
      m.startsWith("Uses chemical:")
    );
    expect(chemReasons).toHaveLength(2);
  });

  it("should not match chemicals not present", () => {
    const query: SimilarityQuery = { chemicals: ["NaOH"] };
    const results = findSimilarExperiments(query, EXPERIMENTS);

    const matched = results.filter((r) =>
      r.matchReasons.some((m) => m.startsWith("Uses chemical:"))
    );
    expect(matched.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Quality filtering
// ---------------------------------------------------------------------------

describe("findSimilarExperiments - quality filtering", () => {
  it("should filter out experiments below minQuality", () => {
    const query: SimilarityQuery = { minQuality: 4 };
    const results = findSimilarExperiments(query, EXPERIMENTS);

    results.forEach((r) => {
      expect(r.qualityScore).toBeGreaterThanOrEqual(4);
    });
    // Only quality 4 and 5 should remain (4 experiments)
    expect(results.length).toBe(4);
  });

  it("should include experiments at exact minQuality", () => {
    const query: SimilarityQuery = { minQuality: 5 };
    const results = findSimilarExperiments(query, EXPERIMENTS);

    expect(results.length).toBe(2);
    results.forEach((r) => {
      expect(r.qualityScore).toBe(5);
    });
  });

  it("should return all experiments when minQuality is not set", () => {
    const query: SimilarityQuery = {};
    const results = findSimilarExperiments(query, EXPERIMENTS);
    expect(results.length).toBe(EXPERIMENTS.length);
  });
});

// ---------------------------------------------------------------------------
// Result sorting
// ---------------------------------------------------------------------------

describe("findSimilarExperiments - sorting", () => {
  it("should sort results by score descending", () => {
    const query: SimilarityQuery = {
      reactionType: "Suzuki Coupling",
      substrateClass: "heteroaryl",
    };
    const results = findSimilarExperiments(query, EXPERIMENTS);

    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it("should place best matches first", () => {
    const query: SimilarityQuery = {
      reactionType: "Suzuki Coupling",
      substrateClass: "heteroaryl",
    };
    const results = findSimilarExperiments(query, EXPERIMENTS);

    // Top results should have both reaction type and substrate class matches
    expect(results[0].matchReasons).toContain(
      "Same reaction type: Suzuki Coupling"
    );
    expect(results[0].matchReasons).toContain(
      "Same substrate class: heteroaryl"
    );
  });
});

// ---------------------------------------------------------------------------
// Limit
// ---------------------------------------------------------------------------

describe("findSimilarExperiments - limit", () => {
  it("should default limit to 10", () => {
    const query: SimilarityQuery = {};
    const results = findSimilarExperiments(query, EXPERIMENTS);
    // We have 6 experiments, all should be returned (< 10)
    expect(results.length).toBe(6);
  });

  it("should respect custom limit", () => {
    const query: SimilarityQuery = { limit: 2 };
    const results = findSimilarExperiments(query, EXPERIMENTS);
    expect(results.length).toBe(2);
  });

  it("should return fewer than limit if not enough experiments", () => {
    const query: SimilarityQuery = { limit: 100 };
    const results = findSimilarExperiments(query, EXPERIMENTS);
    expect(results.length).toBe(EXPERIMENTS.length);
  });
});

// ---------------------------------------------------------------------------
// buildSimilarityContext
// ---------------------------------------------------------------------------

describe("buildSimilarityContext", () => {
  it("should extract query from a reference experiment", () => {
    const ref: ExperimentRef = {
      experimentTitle: "EXP-2026-0042",
      reactionType: "Suzuki Coupling",
      substrateClass: "heteroaryl",
      chemicals: ["Pd(PPh3)4", "K2CO3"],
      researcher: "Dr. Jane Mueller",
      scaleCategory: "medium",
      qualityScore: 4,
      yield: 89,
      date: "2026-03-15",
    };

    const query = buildSimilarityContext(ref);

    expect(query.reactionType).toBe("Suzuki Coupling");
    expect(query.substrateClass).toBe("heteroaryl");
    expect(query.chemicals).toEqual(["Pd(PPh3)4", "K2CO3"]);
    expect(query.researcher).toBe("Dr. Jane Mueller");
    expect(query.scaleCategory).toBe("medium");
  });

  it("should omit undefined fields", () => {
    const ref: ExperimentRef = {
      experimentTitle: "EXP-MINIMAL",
      chemicals: [],
      researcher: "Dr. Test",
      qualityScore: 3,
      date: "2026-01-01",
    };

    const query = buildSimilarityContext(ref);

    expect(query.reactionType).toBeUndefined();
    expect(query.substrateClass).toBeUndefined();
    expect(query.chemicals).toBeUndefined();
    expect(query.scaleCategory).toBeUndefined();
    expect(query.researcher).toBe("Dr. Test");
  });

  it("should create a copy of chemicals array", () => {
    const ref: ExperimentRef = {
      experimentTitle: "EXP-COPY",
      chemicals: ["DMF"],
      researcher: "Dr. Test",
      qualityScore: 3,
      date: "2026-01-01",
    };

    const query = buildSimilarityContext(ref);
    ref.chemicals.push("THF");

    expect(query.chemicals).toEqual(["DMF"]);
  });
});

// ---------------------------------------------------------------------------
// formatSimilarExperimentsForAgent
// ---------------------------------------------------------------------------

describe("formatSimilarExperimentsForAgent", () => {
  it("should return 'no similar experiments' for empty results", () => {
    const output = formatSimilarExperimentsForAgent([]);
    expect(output).toBe("No similar experiments found.");
  });

  it("should include wikilinks for experiment titles", () => {
    const results = [
      {
        experimentTitle: "EXP-2026-0042",
        score: 8.0,
        matchReasons: ["Same reaction type: Suzuki Coupling"],
        reactionType: "Suzuki Coupling",
        yield: 89,
        qualityScore: 4,
        researcher: "Dr. Jane Mueller",
        date: "2026-03-15",
      },
    ];

    const output = formatSimilarExperimentsForAgent(results);
    expect(output).toContain("[[EXP-2026-0042]]");
  });

  it("should include wikilinks for researchers", () => {
    const results = [
      {
        experimentTitle: "EXP-2026-0042",
        score: 8.0,
        matchReasons: [],
        reactionType: "Suzuki Coupling",
        yield: 89,
        qualityScore: 4,
        researcher: "Dr. Jane Mueller",
        date: "2026-03-15",
      },
    ];

    const output = formatSimilarExperimentsForAgent(results);
    expect(output).toContain("[[Dr. Jane Mueller]]");
  });

  it("should include scores and match reasons", () => {
    const results = [
      {
        experimentTitle: "EXP-2026-0042",
        score: 11.0,
        matchReasons: [
          "Same reaction type: Suzuki Coupling",
          "Uses chemical: Pd(PPh3)4",
        ],
        reactionType: "Suzuki Coupling",
        yield: 89,
        qualityScore: 4,
        researcher: "Dr. Jane Mueller",
        date: "2026-03-15",
      },
    ];

    const output = formatSimilarExperimentsForAgent(results);
    expect(output).toContain("**Score:** 11.0");
    expect(output).toContain("Same reaction type: Suzuki Coupling");
    expect(output).toContain("Uses chemical: Pd(PPh3)4");
  });

  it("should include yield when present", () => {
    const results = [
      {
        experimentTitle: "EXP-2026-0042",
        score: 5.0,
        matchReasons: [],
        reactionType: "Suzuki Coupling",
        yield: 89,
        qualityScore: 4,
        researcher: "Dr. Test",
        date: "2026-01-01",
      },
    ];

    const output = formatSimilarExperimentsForAgent(results);
    expect(output).toContain("**Yield:** 89%");
  });

  it("should omit yield when not present", () => {
    const results = [
      {
        experimentTitle: "EXP-2026-0042",
        score: 5.0,
        matchReasons: [],
        reactionType: "Suzuki Coupling",
        qualityScore: 4,
        researcher: "Dr. Test",
        date: "2026-01-01",
      },
    ];

    const output = formatSimilarExperimentsForAgent(results);
    expect(output).not.toContain("**Yield:**");
  });

  it("should include summary header with count", () => {
    const results = [
      {
        experimentTitle: "EXP-001",
        score: 5.0,
        matchReasons: [],
        qualityScore: 4,
        researcher: "Dr. A",
        date: "2026-01-01",
      },
      {
        experimentTitle: "EXP-002",
        score: 4.0,
        matchReasons: [],
        qualityScore: 3,
        researcher: "Dr. B",
        date: "2026-01-02",
      },
    ];

    const output = formatSimilarExperimentsForAgent(results);
    expect(output).toContain("## Similar Experiments");
    expect(output).toContain("Found 2 similar experiment(s):");
  });

  it("should number results sequentially", () => {
    const results = [
      {
        experimentTitle: "EXP-001",
        score: 5.0,
        matchReasons: [],
        qualityScore: 4,
        researcher: "Dr. A",
        date: "2026-01-01",
      },
      {
        experimentTitle: "EXP-002",
        score: 4.0,
        matchReasons: [],
        qualityScore: 3,
        researcher: "Dr. B",
        date: "2026-01-02",
      },
    ];

    const output = formatSimilarExperimentsForAgent(results);
    expect(output).toContain("### 1. [[EXP-001]]");
    expect(output).toContain("### 2. [[EXP-002]]");
  });
});
