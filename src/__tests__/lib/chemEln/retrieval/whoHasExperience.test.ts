import { describe, it, expect } from "vitest";
import {
  findWhoHasExperience,
  formatExperienceResultsForAgent,
  type ExperienceQuery,
  type ExperienceDataSources,
} from "@/lib/chemEln/retrieval/whoHasExperience";
import type {
  ExpertiseProfile,
  ExperimentRef,
  ActivityStatus,
} from "@/lib/chemEln/enrichment/types";

function makeProfile(
  overrides: Partial<ExpertiseProfile> & {
    researcherId: string;
    researcherName: string;
  }
): ExpertiseProfile {
  return {
    totalExperiments: 0,
    primaryExpertise: [],
    allExpertise: [],
    contributionScore: 0,
    activityStatus: "active",
    topContributions: [],
    ...overrides,
  };
}

function makeExperimentRef(
  overrides: Partial<ExperimentRef> & { experimentId: string }
): ExperimentRef {
  return {
    researcherName: "Dr. Test",
    reactionType: "Suzuki Coupling",
    substrateClasses: [],
    date: new Date("2026-02-01"),
    qualityScore: 3.0,
    yieldPercent: 80,
    ...overrides,
  };
}

const REFERENCE_DATE = new Date("2026-03-21");

const PROFILES: ExpertiseProfile[] = [
  makeProfile({
    researcherId: "r-1",
    researcherName: "Dr. Anna Mueller",
    activityStatus: "active",
    totalExperiments: 18,
    allExpertise: [
      {
        reactionType: "Suzuki Coupling",
        experimentCount: 6,
        avgQualityScore: 4.2,
        avgYield: 84,
        highQualityCount: 4,
        firstExperimentDate: new Date("2025-01-01"),
        lastExperimentDate: new Date("2026-03-15"),
        weightedExpertiseScore: 25.2,
      },
      {
        reactionType: "Buchwald-Hartwig",
        experimentCount: 5,
        avgQualityScore: 3.8,
        avgYield: 79,
        highQualityCount: 3,
        firstExperimentDate: new Date("2025-03-01"),
        lastExperimentDate: new Date("2026-02-10"),
        weightedExpertiseScore: 19.0,
      },
    ],
    topContributions: [
      {
        title: "Suzuki coupling optimization",
        experimentId: "EXP-2026-0042",
        experimentTitle: "Suzuki Coupling on 2-bromopyridine",
        date: new Date("2026-03-15"),
        qualityScore: 4.5,
        reactionType: "Suzuki Coupling",
      },
    ],
  }),
  makeProfile({
    researcherId: "r-2",
    researcherName: "Dr. Wei Chen",
    activityStatus: "occasional",
    totalExperiments: 15,
    allExpertise: [
      {
        reactionType: "Suzuki Coupling",
        experimentCount: 4,
        avgQualityScore: 3.9,
        avgYield: 81,
        highQualityCount: 2,
        firstExperimentDate: new Date("2025-05-01"),
        lastExperimentDate: new Date("2025-11-08"),
        weightedExpertiseScore: 15.6,
      },
      {
        reactionType: "Grignard Reaction",
        experimentCount: 8,
        avgQualityScore: 4.0,
        avgYield: 83,
        highQualityCount: 5,
        firstExperimentDate: new Date("2024-06-01"),
        lastExperimentDate: new Date("2026-03-14"),
        weightedExpertiseScore: 32.0,
      },
    ],
    topContributions: [
      {
        title: "Grignard scale-up optimization",
        experimentId: "EXP-2026-0041",
        experimentTitle: "Grignard Reaction at Scale",
        date: new Date("2026-03-14"),
        qualityScore: 4.2,
        reactionType: "Grignard Reaction",
      },
    ],
  }),
  makeProfile({
    researcherId: "r-3",
    researcherName: "Dr. Inactive Smith",
    activityStatus: "inactive",
    totalExperiments: 5,
    allExpertise: [
      {
        reactionType: "Suzuki Coupling",
        experimentCount: 3,
        avgQualityScore: 3.5,
        avgYield: 75,
        highQualityCount: 1,
        firstExperimentDate: new Date("2023-01-01"),
        lastExperimentDate: new Date("2023-06-15"),
        weightedExpertiseScore: 10.5,
      },
    ],
    topContributions: [],
  }),
];

const EXPERIMENTS: ExperimentRef[] = [
  makeExperimentRef({
    experimentId: "EXP-2026-0042",
    researcherName: "Dr. Anna Mueller",
    reactionType: "Suzuki Coupling",
    substrateClasses: ["heteroaryl"],
    date: new Date("2026-03-15"),
    qualityScore: 4.5,
    yieldPercent: 89,
  }),
  makeExperimentRef({
    experimentId: "EXP-2026-0038",
    researcherName: "Dr. Anna Mueller",
    reactionType: "Suzuki Coupling",
    substrateClasses: ["heteroaryl"],
    date: new Date("2026-03-10"),
    qualityScore: 4.0,
    yieldPercent: 82,
  }),
  makeExperimentRef({
    experimentId: "EXP-2025-0312",
    researcherName: "Dr. Wei Chen",
    reactionType: "Suzuki Coupling",
    substrateClasses: ["aryl"],
    date: new Date("2025-11-08"),
    qualityScore: 3.8,
    yieldPercent: 84,
  }),
  makeExperimentRef({
    experimentId: "EXP-2026-0041",
    researcherName: "Dr. Wei Chen",
    reactionType: "Grignard Reaction",
    substrateClasses: ["alkyl"],
    date: new Date("2026-03-14"),
    qualityScore: 4.2,
    yieldPercent: 85,
  }),
  makeExperimentRef({
    experimentId: "EXP-2023-0100",
    researcherName: "Dr. Inactive Smith",
    reactionType: "Suzuki Coupling",
    substrateClasses: ["heteroaryl"],
    date: new Date("2023-06-15"),
    qualityScore: 3.5,
    yieldPercent: 75,
  }),
];

function makeDataSources(
  overrides?: Partial<ExperienceDataSources>
): ExperienceDataSources {
  return {
    profiles: PROFILES,
    experiments: EXPERIMENTS,
    referenceDate: REFERENCE_DATE,
    ...overrides,
  };
}

describe("findWhoHasExperience", () => {
  describe("reaction type matching", () => {
    it("should find researchers with matching reaction type expertise", () => {
      const query: ExperienceQuery = {
        topic: "Suzuki Coupling",
        topicType: "reaction",
      };

      const results = findWhoHasExperience(query, makeDataSources());

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].researcherName).toBe("Dr. Anna Mueller");
      expect(results[0].experimentCount).toBe(6);
    });

    it("should rank researchers by expertise score", () => {
      const query: ExperienceQuery = {
        topic: "Suzuki Coupling",
        topicType: "reaction",
      };

      const results = findWhoHasExperience(query, makeDataSources());

      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].expertiseScore).toBeGreaterThanOrEqual(
          results[i].expertiseScore
        );
      }
    });

    it("should include relevant experiments for each researcher", () => {
      const query: ExperienceQuery = {
        topic: "Suzuki Coupling",
        topicType: "reaction",
      };

      const results = findWhoHasExperience(query, makeDataSources());
      const mueller = results.find(
        (r) => r.researcherName === "Dr. Anna Mueller"
      );
      expect(mueller).toBeDefined();
      expect(mueller!.relevantExperiments.length).toBeGreaterThanOrEqual(1);
    });

    it("should apply recency bonus for recent experiments", () => {
      const query: ExperienceQuery = {
        topic: "Suzuki Coupling",
        topicType: "reaction",
      };

      const results = findWhoHasExperience(query, makeDataSources());

      const mueller = results.find(
        (r) => r.researcherName === "Dr. Anna Mueller"
      );
      expect(mueller).toBeDefined();
      // Mueller has a recent experiment (within 6 months) -> 1.5x recency
      // Active -> 1.5x activity bonus
      // weightedExpertiseScore=25.2 * 1.5 * 1.5 = 56.7
      expect(mueller!.expertiseScore).toBeCloseTo(25.2 * 1.5 * 1.5, 1);
    });
  });

  describe("substrate matching", () => {
    it("should find researchers with experiments matching substrate class", () => {
      const query: ExperienceQuery = {
        topic: "heteroaryl",
        topicType: "substrate",
      };

      const results = findWhoHasExperience(query, makeDataSources());

      expect(results.length).toBeGreaterThanOrEqual(1);
      const mueller = results.find(
        (r) => r.researcherName === "Dr. Anna Mueller"
      );
      expect(mueller).toBeDefined();
      expect(mueller!.experimentCount).toBe(2);
    });

    it("should not include researchers without matching substrate", () => {
      const query: ExperienceQuery = {
        topic: "heteroaryl",
        topicType: "substrate",
      };

      const results = findWhoHasExperience(query, makeDataSources());

      const chen = results.find(
        (r) => r.researcherName === "Dr. Wei Chen"
      );
      // Chen has no heteroaryl experiments (only aryl and alkyl)
      expect(chen).toBeUndefined();
    });
  });

  describe("chemical matching", () => {
    it("should find researchers using a specific chemical via usages", () => {
      const query: ExperienceQuery = {
        topic: "Pd(PPh3)4",
        topicType: "chemical",
      };

      const dataSources = makeDataSources({
        chemicalUsages: [
          {
            experimentId: "EXP-2026-0042",
            experimentTitle: "EXP-2026-0042",
            role: "catalyst",
            amount: 0.05,
            unit: "mmol",
            yield: 89,
          },
          {
            experimentId: "EXP-2025-0312",
            experimentTitle: "EXP-2025-0312",
            role: "catalyst",
            amount: 0.05,
            unit: "mmol",
            yield: 84,
          },
        ],
      });

      const results = findWhoHasExperience(query, dataSources);

      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("technique keyword search", () => {
    it("should find researchers by keyword match in experiment data", () => {
      const query: ExperienceQuery = {
        topic: "Grignard scale",
        topicType: "technique",
      };

      const results = findWhoHasExperience(query, makeDataSources());

      expect(results.length).toBeGreaterThanOrEqual(1);
      const chen = results.find(
        (r) => r.researcherName === "Dr. Wei Chen"
      );
      expect(chen).toBeDefined();
    });

    it("should match keywords across experiment titles and reaction types", () => {
      const query: ExperienceQuery = {
        topic: "Suzuki",
        topicType: "technique",
      };

      const results = findWhoHasExperience(query, makeDataSources());

      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("inactive filtering", () => {
    it("should exclude inactive researchers by default", () => {
      const query: ExperienceQuery = {
        topic: "Suzuki Coupling",
        topicType: "reaction",
      };

      const results = findWhoHasExperience(query, makeDataSources());

      const inactive = results.find(
        (r) => r.researcherName === "Dr. Inactive Smith"
      );
      expect(inactive).toBeUndefined();
    });

    it("should include inactive researchers when includeInactive is true", () => {
      const query: ExperienceQuery = {
        topic: "Suzuki Coupling",
        topicType: "reaction",
        includeInactive: true,
      };

      const results = findWhoHasExperience(query, makeDataSources());

      const inactive = results.find(
        (r) => r.researcherName === "Dr. Inactive Smith"
      );
      expect(inactive).toBeDefined();
    });
  });

  describe("scoring with recency bonus", () => {
    it("should apply 1.5x recency bonus for experiments within 6 months", () => {
      const query: ExperienceQuery = {
        topic: "Suzuki Coupling",
        topicType: "reaction",
      };

      // Mueller's most recent Suzuki experiment is 2026-03-15, ref date 2026-03-21 -> within 6 months
      const results = findWhoHasExperience(query, makeDataSources());
      const mueller = results.find(
        (r) => r.researcherName === "Dr. Anna Mueller"
      );
      expect(mueller).toBeDefined();

      // 25.2 (weighted) * 1.5 (active) * 1.5 (recent)
      const expectedScore = 25.2 * 1.5 * 1.5;
      expect(mueller!.expertiseScore).toBeCloseTo(expectedScore, 1);
    });

    it("should apply 1.0x recency bonus for experiments within 1 year", () => {
      const query: ExperienceQuery = {
        topic: "Suzuki Coupling",
        topicType: "reaction",
      };

      // Chen's most recent Suzuki experiment is 2025-11-08, ref 2026-03-21 -> ~4.5 months -> within 6 months
      const results = findWhoHasExperience(query, makeDataSources());
      const chen = results.find(
        (r) => r.researcherName === "Dr. Wei Chen"
      );
      expect(chen).toBeDefined();

      // 15.6 (weighted) * 1.0 (occasional) * 1.5 (within 6 months)
      const expectedScore = 15.6 * 1.0 * 1.5;
      expect(chen!.expertiseScore).toBeCloseTo(expectedScore, 1);
    });

    it("should apply 0.7x recency bonus for experiments older than 1 year", () => {
      const query: ExperienceQuery = {
        topic: "Suzuki Coupling",
        topicType: "reaction",
        includeInactive: true,
      };

      const results = findWhoHasExperience(query, makeDataSources());
      const smith = results.find(
        (r) => r.researcherName === "Dr. Inactive Smith"
      );
      expect(smith).toBeDefined();

      // 10.5 (weighted) * 0.5 (inactive) * 0.7 (older than 1 year)
      const expectedScore = 10.5 * 0.5 * 0.7;
      expect(smith!.expertiseScore).toBeCloseTo(expectedScore, 1);
    });
  });

  describe("minExperiments filter", () => {
    it("should filter researchers below minExperiments threshold", () => {
      const query: ExperienceQuery = {
        topic: "Suzuki Coupling",
        topicType: "reaction",
        minExperiments: 5,
        includeInactive: true,
      };

      const results = findWhoHasExperience(query, makeDataSources());

      expect(results.every((r) => r.experimentCount >= 5)).toBe(true);
      expect(results.length).toBe(1); // Only Mueller has 6
    });
  });
});

describe("formatExperienceResultsForAgent", () => {
  it("should format empty results with suggestion", () => {
    const query: ExperienceQuery = {
      topic: "Unknown Reaction",
      topicType: "reaction",
    };

    const output = formatExperienceResultsForAgent([], query);

    expect(output).toContain("No researchers found");
    expect(output).toContain("Unknown Reaction");
    expect(output).toContain("broadening");
  });

  it("should format results with wikilinks and details", () => {
    const query: ExperienceQuery = {
      topic: "Suzuki Coupling",
      topicType: "reaction",
    };

    const results = findWhoHasExperience(query, makeDataSources());
    const output = formatExperienceResultsForAgent(results, query);

    expect(output).toContain("## Who Has Experience: Suzuki Coupling");
    expect(output).toContain("[[Dr. Anna Mueller]]");
    expect(output).toContain("Expertise Score:");
    expect(output).toContain("Experiments:");
    expect(output).toContain("Avg Quality:");
    expect(output).toContain("Status:");
  });

  it("should include recommendation with top researcher", () => {
    const query: ExperienceQuery = {
      topic: "Suzuki Coupling",
      topicType: "reaction",
    };

    const results = findWhoHasExperience(query, makeDataSources());
    const output = formatExperienceResultsForAgent(results, query);

    expect(output).toContain("Recommendation:");
    expect(output).toContain("Consider reaching out to");
    expect(output).toContain("[[Dr. Anna Mueller]]");
  });

  it("should include most recent experiment with date", () => {
    const query: ExperienceQuery = {
      topic: "Suzuki Coupling",
      topicType: "reaction",
    };

    const results = findWhoHasExperience(query, makeDataSources());
    const output = formatExperienceResultsForAgent(results, query);

    expect(output).toContain("Most Recent:");
    expect(output).toContain("2026-03-15");
  });

  it("should include researcher email when available", () => {
    const query: ExperienceQuery = {
      topic: "Suzuki Coupling",
      topicType: "reaction",
    };

    const dataSources = makeDataSources({
      researcherEmails: {
        "Dr. Anna Mueller": "mueller@lab.org",
      },
    });

    const results = findWhoHasExperience(query, dataSources);
    const output = formatExperienceResultsForAgent(results, query);

    expect(output).toContain("mueller@lab.org");
  });

  it("should list relevant experiments with yield data", () => {
    const query: ExperienceQuery = {
      topic: "Suzuki Coupling",
      topicType: "reaction",
    };

    const results = findWhoHasExperience(query, makeDataSources());
    const output = formatExperienceResultsForAgent(results, query);

    expect(output).toContain("Relevant Experiments:");
    expect(output).toContain("89% yield");
  });
});
