import { describe, it, expect } from "vitest";
import {
  computeResearcherExpertise,
  computeAllExpertise,
} from "@/lib/chemEln/enrichment/expertiseComputation";
import type {
  ResearcherWithExperiments,
  ExpertiseExperimentInput,
} from "@/lib/chemEln/enrichment/types";

function makeExperiment(
  overrides: Partial<ExpertiseExperimentInput> & { id: string }
): ExpertiseExperimentInput {
  return {
    title: `EXP-${overrides.id}`,
    reactionType: "Suzuki Coupling",
    qualityScore: 3.0,
    yieldPercent: 80,
    date: new Date("2026-02-01"),
    practicalNotesCount: 0,
    ...overrides,
  };
}

function makeResearcher(
  overrides: Partial<ResearcherWithExperiments> & {
    researcherId: string;
    experiments: ExpertiseExperimentInput[];
  }
): ResearcherWithExperiments {
  return {
    researcherName: "Dr. Test",
    ...overrides,
  };
}

describe("computeResearcherExpertise", () => {
  it("should compute expertise areas ranked by weighted score", () => {
    const researcher = makeResearcher({
      researcherId: "r-1",
      researcherName: "Dr. A",
      experiments: [
        makeExperiment({ id: "1", reactionType: "Suzuki Coupling", qualityScore: 4.5 }),
        makeExperiment({ id: "2", reactionType: "Suzuki Coupling", qualityScore: 5.0 }),
        makeExperiment({ id: "3", reactionType: "Buchwald-Hartwig", qualityScore: 3.0 }),
        makeExperiment({ id: "4", reactionType: "Buchwald-Hartwig", qualityScore: 3.0 }),
        makeExperiment({ id: "5", reactionType: "Buchwald-Hartwig", qualityScore: 3.0 }),
        makeExperiment({ id: "6", reactionType: "Negishi Coupling", qualityScore: 2.0 }),
      ],
    });

    const profile = computeResearcherExpertise(researcher);

    expect(profile.totalExperiments).toBe(6);
    // Suzuki: 2 * 4.75 = 9.5 weighted score
    // Buchwald: 3 * 3.0 = 9.0 weighted score
    // Negishi: 1 * 2.0 = 2.0 weighted score
    expect(profile.allExpertise[0].reactionType).toBe("Suzuki Coupling");
    expect(profile.allExpertise[0].weightedExpertiseScore).toBeCloseTo(9.5, 1);
    expect(profile.allExpertise[1].reactionType).toBe("Buchwald-Hartwig");
    expect(profile.allExpertise[1].weightedExpertiseScore).toBeCloseTo(9.0, 1);
    expect(profile.allExpertise[2].reactionType).toBe("Negishi Coupling");
  });

  it("should compute average quality score and yield per reaction type", () => {
    const researcher = makeResearcher({
      researcherId: "r-1",
      experiments: [
        makeExperiment({ id: "1", reactionType: "Suzuki Coupling", qualityScore: 4.0, yieldPercent: 86 }),
        makeExperiment({ id: "2", reactionType: "Suzuki Coupling", qualityScore: 5.0, yieldPercent: 92 }),
        makeExperiment({ id: "3", reactionType: "Suzuki Coupling", qualityScore: 3.0, yieldPercent: null }),
      ],
    });

    const profile = computeResearcherExpertise(researcher);

    expect(profile.allExpertise[0].avgQualityScore).toBe(4.0);
    expect(profile.allExpertise[0].avgYield).toBeCloseTo(89, 0);
  });

  it("should select top 3 as primary expertise", () => {
    const researcher = makeResearcher({
      researcherId: "r-1",
      experiments: [
        makeExperiment({ id: "1", reactionType: "Type A", qualityScore: 5.0 }),
        makeExperiment({ id: "2", reactionType: "Type A", qualityScore: 5.0 }),
        makeExperiment({ id: "3", reactionType: "Type B", qualityScore: 4.0 }),
        makeExperiment({ id: "4", reactionType: "Type B", qualityScore: 4.0 }),
        makeExperiment({ id: "5", reactionType: "Type C", qualityScore: 3.0 }),
        makeExperiment({ id: "6", reactionType: "Type D", qualityScore: 2.0 }),
      ],
    });

    const profile = computeResearcherExpertise(researcher);

    expect(profile.primaryExpertise).toHaveLength(3);
    const primaryTypes = profile.primaryExpertise.map((e) => e.reactionType);
    expect(primaryTypes).toContain("Type A");
    expect(primaryTypes).toContain("Type B");
    expect(primaryTypes).toContain("Type C");
    expect(primaryTypes).not.toContain("Type D");
  });

  it("should compute contribution score as sum of quality scores", () => {
    const researcher = makeResearcher({
      researcherId: "r-1",
      experiments: [
        makeExperiment({ id: "1", qualityScore: 4.0 }),
        makeExperiment({ id: "2", qualityScore: 5.0 }),
        makeExperiment({ id: "3", qualityScore: 3.5 }),
      ],
    });

    const profile = computeResearcherExpertise(researcher);

    expect(profile.contributionScore).toBeCloseTo(12.5, 1);
  });

  it('should mark researcher as "active" if experiment within last 90 days', () => {
    const now = new Date("2026-03-21");
    const researcher = makeResearcher({
      researcherId: "r-1",
      experiments: [
        makeExperiment({ id: "1", date: new Date("2026-03-01") }),
      ],
    });

    const profile = computeResearcherExpertise(researcher, now);
    expect(profile.activityStatus).toBe("active");
  });

  it('should mark researcher as "occasional" if last experiment 90-365 days ago', () => {
    const now = new Date("2026-03-21");
    const researcher = makeResearcher({
      researcherId: "r-1",
      experiments: [
        makeExperiment({ id: "1", date: new Date("2025-10-01") }),
      ],
    });

    const profile = computeResearcherExpertise(researcher, now);
    expect(profile.activityStatus).toBe("occasional");
  });

  it('should mark researcher as "inactive" if last experiment > 365 days ago', () => {
    const now = new Date("2026-03-21");
    const researcher = makeResearcher({
      researcherId: "r-1",
      experiments: [
        makeExperiment({ id: "1", date: new Date("2024-12-01") }),
      ],
    });

    const profile = computeResearcherExpertise(researcher, now);
    expect(profile.activityStatus).toBe("inactive");
  });

  it("should handle researcher with no experiments", () => {
    const researcher = makeResearcher({
      researcherId: "r-empty",
      researcherName: "Dr. Empty",
      experiments: [],
    });

    const profile = computeResearcherExpertise(researcher);

    expect(profile.totalExperiments).toBe(0);
    expect(profile.primaryExpertise).toHaveLength(0);
    expect(profile.allExpertise).toHaveLength(0);
    expect(profile.contributionScore).toBe(0);
    expect(profile.activityStatus).toBe("inactive");
    expect(profile.topContributions).toHaveLength(0);
  });

  it("should return top 5 contributions by quality score", () => {
    const experiments = Array.from({ length: 8 }, (_, i) =>
      makeExperiment({
        id: `exp-${i}`,
        qualityScore: i + 1,
        practicalNotes: `Optimization protocol for step ${i + 1}`,
      })
    );

    const researcher = makeResearcher({
      researcherId: "r-1",
      experiments,
    });

    const profile = computeResearcherExpertise(researcher);

    expect(profile.topContributions).toHaveLength(5);
    expect(profile.topContributions[0].qualityScore).toBe(8);
    expect(profile.topContributions[1].qualityScore).toBe(7);
    expect(profile.topContributions[4].qualityScore).toBe(4);
  });

  it("should count high-quality experiments (>= 4.0)", () => {
    const researcher = makeResearcher({
      researcherId: "r-1",
      experiments: [
        makeExperiment({ id: "1", qualityScore: 4.0 }),
        makeExperiment({ id: "2", qualityScore: 4.5 }),
        makeExperiment({ id: "3", qualityScore: 3.9 }),
        makeExperiment({ id: "4", qualityScore: 2.0 }),
      ],
    });

    const profile = computeResearcherExpertise(researcher);

    expect(profile.allExpertise[0].highQualityCount).toBe(2);
  });

  it("should compute date ranges per reaction type", () => {
    const researcher = makeResearcher({
      researcherId: "r-1",
      experiments: [
        makeExperiment({ id: "1", reactionType: "Suzuki Coupling", date: new Date("2025-01-15") }),
        makeExperiment({ id: "2", reactionType: "Suzuki Coupling", date: new Date("2026-03-01") }),
        makeExperiment({ id: "3", reactionType: "Suzuki Coupling", date: new Date("2025-06-15") }),
      ],
    });

    const profile = computeResearcherExpertise(researcher);
    const suzuki = profile.allExpertise[0];

    expect(suzuki.firstExperimentDate).toEqual(new Date("2025-01-15"));
    expect(suzuki.lastExperimentDate).toEqual(new Date("2026-03-01"));
  });

  it("should handle null yield gracefully", () => {
    const researcher = makeResearcher({
      researcherId: "r-1",
      experiments: [
        makeExperiment({ id: "1", yieldPercent: null }),
        makeExperiment({ id: "2", yieldPercent: null }),
      ],
    });

    const profile = computeResearcherExpertise(researcher);
    expect(profile.allExpertise[0].avgYield).toBeNull();
  });

  it("should work with realistic data", () => {
    const researcher = makeResearcher({
      researcherId: "anna-mueller",
      researcherName: "Dr. Anna Mueller",
      experiments: [
        makeExperiment({ id: "exp-101", reactionType: "Suzuki Coupling", qualityScore: 4.5, yieldPercent: 86, date: new Date("2026-01-10"), practicalNotes: "Optimized heteroaryl Suzuki protocol using Pd(dppf)Cl2" }),
        makeExperiment({ id: "exp-102", reactionType: "Suzuki Coupling", qualityScore: 5.0, yieldPercent: 92, date: new Date("2026-01-25") }),
        makeExperiment({ id: "exp-103", reactionType: "Suzuki Coupling", qualityScore: 3.5, yieldPercent: 78, date: new Date("2026-02-05") }),
        makeExperiment({ id: "exp-104", reactionType: "Suzuki Coupling", qualityScore: 4.0, yieldPercent: 88, date: new Date("2026-02-20") }),
        makeExperiment({ id: "exp-201", reactionType: "Buchwald-Hartwig", qualityScore: 4.0, yieldPercent: 84, date: new Date("2026-01-15"), practicalNotes: "Developed low-temp Buchwald method for sensitive substrates" }),
        makeExperiment({ id: "exp-202", reactionType: "Buchwald-Hartwig", qualityScore: 3.5, yieldPercent: 82, date: new Date("2026-02-10") }),
        makeExperiment({ id: "exp-301", reactionType: "Negishi Coupling", qualityScore: 4.5, yieldPercent: 88, date: new Date("2026-03-01"), practicalNotes: "Novel zinc reagent preparation for Negishi coupling" }),
        makeExperiment({ id: "exp-302", reactionType: "Negishi Coupling", qualityScore: 4.0, yieldPercent: 85, date: new Date("2026-03-10") }),
      ],
    });

    const now = new Date("2026-03-21");
    const profile = computeResearcherExpertise(researcher, now);

    expect(profile.researcherName).toBe("Dr. Anna Mueller");
    expect(profile.totalExperiments).toBe(8);
    expect(profile.activityStatus).toBe("active");
    expect(profile.primaryExpertise).toHaveLength(3);
    // Suzuki: 4 * avg(4.5,5,3.5,4) = 4 * 4.25 = 17
    expect(profile.primaryExpertise[0].reactionType).toBe("Suzuki Coupling");
    expect(profile.primaryExpertise[0].experimentCount).toBe(4);
    expect(profile.topContributions.length).toBeGreaterThan(0);
    expect(profile.topContributions[0].qualityScore).toBe(5.0);
  });
});

describe("computeAllExpertise", () => {
  it("should normalize contribution scores to 0-100 scale", () => {
    const researchers: ResearcherWithExperiments[] = [
      makeResearcher({
        researcherId: "r-1",
        researcherName: "Dr. A",
        experiments: [
          makeExperiment({ id: "1", qualityScore: 5.0 }),
          makeExperiment({ id: "2", qualityScore: 5.0 }),
        ],
      }),
      makeResearcher({
        researcherId: "r-2",
        researcherName: "Dr. B",
        experiments: [
          makeExperiment({ id: "3", qualityScore: 5.0 }),
        ],
      }),
    ];

    const profiles = computeAllExpertise(researchers);

    expect(profiles[0].researcherName).toBe("Dr. A");
    expect(profiles[0].contributionScore).toBe(100);
    expect(profiles[1].researcherName).toBe("Dr. B");
    expect(profiles[1].contributionScore).toBe(50);
  });

  it("should sort by contribution score descending", () => {
    const researchers: ResearcherWithExperiments[] = [
      makeResearcher({
        researcherId: "r-low",
        researcherName: "Dr. Low",
        experiments: [
          makeExperiment({ id: "1", qualityScore: 2.0 }),
        ],
      }),
      makeResearcher({
        researcherId: "r-high",
        researcherName: "Dr. High",
        experiments: [
          makeExperiment({ id: "2", qualityScore: 5.0 }),
          makeExperiment({ id: "3", qualityScore: 5.0 }),
          makeExperiment({ id: "4", qualityScore: 5.0 }),
        ],
      }),
      makeResearcher({
        researcherId: "r-mid",
        researcherName: "Dr. Mid",
        experiments: [
          makeExperiment({ id: "5", qualityScore: 4.0 }),
          makeExperiment({ id: "6", qualityScore: 3.0 }),
        ],
      }),
    ];

    const profiles = computeAllExpertise(researchers);

    expect(profiles[0].researcherName).toBe("Dr. High");
    expect(profiles[1].researcherName).toBe("Dr. Mid");
    expect(profiles[2].researcherName).toBe("Dr. Low");
  });

  it("should handle empty researcher list", () => {
    const profiles = computeAllExpertise([]);
    expect(profiles).toHaveLength(0);
  });

  it("should handle researchers with no experiments", () => {
    const researchers: ResearcherWithExperiments[] = [
      makeResearcher({ researcherId: "r-1", experiments: [] }),
      makeResearcher({
        researcherId: "r-2",
        experiments: [makeExperiment({ id: "1", qualityScore: 4.0 })],
      }),
    ];

    const profiles = computeAllExpertise(researchers);

    expect(profiles).toHaveLength(2);
    expect(profiles[0].contributionScore).toBe(100);
    expect(profiles[1].contributionScore).toBe(0);
  });

  it("should normalize across multiple researchers with realistic data", () => {
    const researchers: ResearcherWithExperiments[] = [
      makeResearcher({
        researcherId: "anna",
        researcherName: "Dr. Anna Mueller",
        experiments: Array.from({ length: 12 }, (_, i) =>
          makeExperiment({
            id: `anna-${i}`,
            reactionType: i < 6 ? "Suzuki Coupling" : "Buchwald-Hartwig",
            qualityScore: 4.0 + (i % 3) * 0.5,
            yieldPercent: 80 + i,
            date: new Date(`2026-0${(i % 3) + 1}-${(i % 28) + 1}`),
          })
        ),
      }),
      makeResearcher({
        researcherId: "markus",
        researcherName: "Dr. Markus Weber",
        experiments: Array.from({ length: 5 }, (_, i) =>
          makeExperiment({
            id: `markus-${i}`,
            reactionType: "Negishi Coupling",
            qualityScore: 3.0 + i * 0.5,
            yieldPercent: 75 + i * 3,
            date: new Date(`2026-02-${(i % 28) + 1}`),
          })
        ),
      }),
    ];

    const now = new Date("2026-03-21");
    const profiles = computeAllExpertise(researchers, now);

    expect(profiles).toHaveLength(2);
    expect(profiles[0].researcherName).toBe("Dr. Anna Mueller");
    expect(profiles[0].contributionScore).toBe(100);
    expect(profiles[1].contributionScore).toBeGreaterThan(0);
    expect(profiles[1].contributionScore).toBeLessThan(100);
  });
});
