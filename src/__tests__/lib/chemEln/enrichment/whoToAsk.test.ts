import { describe, it, expect } from "vitest";
import {
  getWhoToAsk,
  generateWhoToAskSection,
} from "@/lib/chemEln/enrichment/whoToAsk";
import type {
  ExpertiseProfile,
  ExperimentRef,
  WhoToAskContext,
} from "@/lib/chemEln/enrichment/types";
import type { ChemicalUsage } from "@/lib/chemEln/types";

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

describe("getWhoToAsk", () => {
  describe("reaction type recommendations", () => {
    it("should find researchers with matching reaction type expertise", () => {
      const profiles: ExpertiseProfile[] = [
        makeProfile({
          researcherId: "r-1",
          researcherName: "Dr. Anna Mueller",
          activityStatus: "active",
          allExpertise: [
            {
              reactionType: "Suzuki Coupling",
              experimentCount: 12,
              avgQualityScore: 4.2,
              avgYield: 86,
              highQualityCount: 8,
              firstExperimentDate: new Date("2025-01-01"),
              lastExperimentDate: new Date("2026-03-15"),
              weightedExpertiseScore: 50.4,
            },
          ],
        }),
        makeProfile({
          researcherId: "r-2",
          researcherName: "Dr. James Chen",
          activityStatus: "occasional",
          allExpertise: [
            {
              reactionType: "Suzuki Coupling",
              experimentCount: 8,
              avgQualityScore: 3.8,
              avgYield: 82,
              highQualityCount: 5,
              firstExperimentDate: new Date("2025-03-01"),
              lastExperimentDate: new Date("2026-01-20"),
              weightedExpertiseScore: 30.4,
            },
          ],
        }),
      ];

      const result = getWhoToAsk({
        type: "reaction",
        reactionType: "Suzuki Coupling",
        expertiseProfiles: profiles,
      });

      expect(result.recommendations).toHaveLength(2);
      expect(result.recommendations[0].researcherName).toBe(
        "Dr. Anna Mueller"
      );
      expect(result.recommendations[0].reason).toContain("12 experiments");
      expect(result.recommendations[0].reason).toContain("Suzuki Coupling");
      expect(result.context).toContain("Suzuki Coupling");
    });

    it("should apply activity bonus to ranking", () => {
      const profiles: ExpertiseProfile[] = [
        makeProfile({
          researcherId: "r-1",
          researcherName: "Dr. Inactive",
          activityStatus: "inactive",
          allExpertise: [
            {
              reactionType: "Grignard",
              experimentCount: 20,
              avgQualityScore: 4.0,
              avgYield: 90,
              highQualityCount: 15,
              firstExperimentDate: new Date("2024-01-01"),
              lastExperimentDate: new Date("2024-06-01"),
              weightedExpertiseScore: 80.0,
            },
          ],
        }),
        makeProfile({
          researcherId: "r-2",
          researcherName: "Dr. Active",
          activityStatus: "active",
          allExpertise: [
            {
              reactionType: "Grignard",
              experimentCount: 10,
              avgQualityScore: 4.0,
              avgYield: 85,
              highQualityCount: 8,
              firstExperimentDate: new Date("2025-06-01"),
              lastExperimentDate: new Date("2026-03-01"),
              weightedExpertiseScore: 40.0,
            },
          ],
        }),
      ];

      const result = getWhoToAsk({
        type: "reaction",
        reactionType: "Grignard",
        expertiseProfiles: profiles,
      });

      // Dr. Active: 40.0 * 1.5 = 60.0
      // Dr. Inactive: 80.0 * 0.5 = 40.0
      expect(result.recommendations[0].researcherName).toBe("Dr. Active");
      expect(result.recommendations[0].score).toBeCloseTo(60.0);
      expect(result.recommendations[1].researcherName).toBe("Dr. Inactive");
      expect(result.recommendations[1].score).toBeCloseTo(40.0);
    });

    it("should return empty when no researchers match reaction type", () => {
      const profiles: ExpertiseProfile[] = [
        makeProfile({
          researcherId: "r-1",
          researcherName: "Dr. Test",
          allExpertise: [
            {
              reactionType: "Suzuki Coupling",
              experimentCount: 5,
              avgQualityScore: 3.5,
              avgYield: 80,
              highQualityCount: 2,
              firstExperimentDate: new Date("2025-01-01"),
              lastExperimentDate: new Date("2026-01-01"),
              weightedExpertiseScore: 17.5,
            },
          ],
        }),
      ];

      const result = getWhoToAsk({
        type: "reaction",
        reactionType: "Nonexistent Reaction",
        expertiseProfiles: profiles,
      });

      expect(result.recommendations).toHaveLength(0);
    });
  });

  describe("substrate class recommendations", () => {
    it("should find researchers who worked with the substrate class", () => {
      const profiles: ExpertiseProfile[] = [
        makeProfile({
          researcherId: "r-1",
          researcherName: "Dr. Sarah Lee",
          activityStatus: "active",
        }),
        makeProfile({
          researcherId: "r-2",
          researcherName: "Dr. Tom Brown",
          activityStatus: "occasional",
        }),
      ];

      const experiments: ExperimentRef[] = [
        makeExperimentRef({
          experimentId: "e-1",
          researcherName: "Dr. Sarah Lee",
          substrateClasses: ["Heteroaryl"],
          qualityScore: 4.5,
          date: new Date("2026-03-01"),
        }),
        makeExperimentRef({
          experimentId: "e-2",
          researcherName: "Dr. Sarah Lee",
          substrateClasses: ["Heteroaryl"],
          qualityScore: 4.0,
          date: new Date("2026-02-15"),
        }),
        makeExperimentRef({
          experimentId: "e-3",
          researcherName: "Dr. Tom Brown",
          substrateClasses: ["Heteroaryl"],
          qualityScore: 3.0,
          date: new Date("2026-01-10"),
        }),
      ];

      const result = getWhoToAsk({
        type: "substrate",
        substrateClass: "Heteroaryl",
        experiments,
        expertiseProfiles: profiles,
      });

      expect(result.recommendations).toHaveLength(2);
      expect(result.recommendations[0].researcherName).toBe("Dr. Sarah Lee");
      expect(result.recommendations[0].reason).toContain("2 experiments");
      expect(result.recommendations[0].reason).toContain("Heteroaryl");
    });

    it("should return empty for unknown substrate class", () => {
      const result = getWhoToAsk({
        type: "substrate",
        substrateClass: "Unknown Class",
        experiments: [],
        expertiseProfiles: [],
      });

      expect(result.recommendations).toHaveLength(0);
    });
  });

  describe("chemical recommendations", () => {
    it("should find researchers who used the chemical", () => {
      const profiles: ExpertiseProfile[] = [
        makeProfile({
          researcherId: "r-1",
          researcherName: "Dr. Anna Mueller",
          activityStatus: "active",
          topContributions: [
            {
              title: "Suzuki optimization",
              experimentId: "e-1",
              experimentTitle: "Suzuki coupling of aryl bromides",
              date: new Date("2026-03-01"),
              qualityScore: 4.5,
              reactionType: "Suzuki Coupling",
            },
            {
              title: "Pd catalyst study",
              experimentId: "e-2",
              experimentTitle: "Pd-catalyzed cross-coupling",
              date: new Date("2026-02-01"),
              qualityScore: 4.0,
              reactionType: "Suzuki Coupling",
            },
          ],
        }),
      ];

      const usages: ChemicalUsage[] = [
        {
          experimentId: "e-1",
          experimentTitle: "Suzuki coupling of aryl bromides",
          role: "catalyst",
          amount: 5,
          unit: "mg",
          yield: 92,
        },
        {
          experimentId: "e-2",
          experimentTitle: "Pd-catalyzed cross-coupling",
          role: "catalyst",
          amount: 10,
          unit: "mg",
          yield: 85,
        },
      ];

      const result = getWhoToAsk({
        type: "chemical",
        chemicalName: "Pd(PPh3)4",
        usages,
        expertiseProfiles: profiles,
      });

      expect(result.recommendations).toHaveLength(1);
      expect(result.recommendations[0].researcherName).toBe(
        "Dr. Anna Mueller"
      );
      expect(result.recommendations[0].reason).toContain("2 uses");
      expect(result.recommendations[0].reason).toContain("Pd(PPh3)4");
      expect(result.context).toContain("Pd(PPh3)4");
    });

    it("should return empty when no researcher matches usages", () => {
      const usages: ChemicalUsage[] = [
        {
          experimentId: "e-99",
          experimentTitle: "Unknown experiment",
          role: "reagent",
          amount: 10,
          unit: "mL",
        },
      ];

      const result = getWhoToAsk({
        type: "chemical",
        chemicalName: "Ethanol",
        usages,
        expertiseProfiles: [],
      });

      expect(result.recommendations).toHaveLength(0);
    });
  });

  describe("top-3 limit", () => {
    it("should limit recommendations to top 3", () => {
      const profiles: ExpertiseProfile[] = Array.from(
        { length: 6 },
        (_, i) =>
          makeProfile({
            researcherId: `r-${i}`,
            researcherName: `Dr. Researcher ${i}`,
            activityStatus: "active",
            allExpertise: [
              {
                reactionType: "Heck Reaction",
                experimentCount: 10 - i,
                avgQualityScore: 4.0,
                avgYield: 80,
                highQualityCount: 5,
                firstExperimentDate: new Date("2025-01-01"),
                lastExperimentDate: new Date("2026-03-01"),
                weightedExpertiseScore: (10 - i) * 4.0,
              },
            ],
          })
      );

      const result = getWhoToAsk({
        type: "reaction",
        reactionType: "Heck Reaction",
        expertiseProfiles: profiles,
      });

      expect(result.recommendations).toHaveLength(3);
      expect(result.recommendations[0].researcherName).toBe(
        "Dr. Researcher 0"
      );
      expect(result.recommendations[2].researcherName).toBe(
        "Dr. Researcher 2"
      );
    });
  });
});

describe("generateWhoToAskSection", () => {
  it("should render markdown with wikilinks and activity status", () => {
    const result = getWhoToAsk({
      type: "reaction",
      reactionType: "Suzuki Coupling",
      expertiseProfiles: [
        makeProfile({
          researcherId: "r-1",
          researcherName: "Dr. Anna Mueller",
          activityStatus: "active",
          allExpertise: [
            {
              reactionType: "Suzuki Coupling",
              experimentCount: 12,
              avgQualityScore: 4.2,
              avgYield: 86,
              highQualityCount: 8,
              firstExperimentDate: new Date("2025-01-01"),
              lastExperimentDate: new Date("2026-03-15"),
              weightedExpertiseScore: 50.4,
            },
          ],
        }),
      ],
    });

    const markdown = generateWhoToAskSection(result);

    expect(markdown).toContain("## Who To Ask");
    expect(markdown).toContain("**[[Dr. Anna Mueller]]**");
    expect(markdown).toContain("12 experiments");
    expect(markdown).toContain("(active)");
  });

  it("should display message when no researchers found", () => {
    const result = getWhoToAsk({
      type: "reaction",
      reactionType: "Nonexistent",
      expertiseProfiles: [],
    });

    const markdown = generateWhoToAskSection(result);

    expect(markdown).toContain("## Who To Ask");
    expect(markdown).toContain("No researchers with relevant experience found");
  });

  it("should show all recommended researchers", () => {
    const profiles: ExpertiseProfile[] = [
      makeProfile({
        researcherId: "r-1",
        researcherName: "Dr. Alpha",
        activityStatus: "active",
        allExpertise: [
          {
            reactionType: "Test",
            experimentCount: 10,
            avgQualityScore: 4.0,
            avgYield: 85,
            highQualityCount: 7,
            firstExperimentDate: new Date("2025-01-01"),
            lastExperimentDate: new Date("2026-03-01"),
            weightedExpertiseScore: 40.0,
          },
        ],
      }),
      makeProfile({
        researcherId: "r-2",
        researcherName: "Dr. Beta",
        activityStatus: "occasional",
        allExpertise: [
          {
            reactionType: "Test",
            experimentCount: 5,
            avgQualityScore: 3.5,
            avgYield: 78,
            highQualityCount: 2,
            firstExperimentDate: new Date("2025-06-01"),
            lastExperimentDate: new Date("2025-12-01"),
            weightedExpertiseScore: 17.5,
          },
        ],
      }),
    ];

    const result = getWhoToAsk({
      type: "reaction",
      reactionType: "Test",
      expertiseProfiles: profiles,
    });
    const markdown = generateWhoToAskSection(result);

    expect(markdown).toContain("**[[Dr. Alpha]]**");
    expect(markdown).toContain("(active)");
    expect(markdown).toContain("**[[Dr. Beta]]**");
    expect(markdown).toContain("(occasional)");
  });
});
