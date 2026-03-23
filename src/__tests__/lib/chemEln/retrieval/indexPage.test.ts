import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateEnhancedIndexPage,
  type KbStats,
} from "@/lib/chemEln/retrieval/indexPage";
import { aggregateKbStats } from "@/lib/chemEln/retrieval/statsAggregator";
import type { AggregatorInput } from "@/lib/chemEln/retrieval/statsAggregator";

function makeStats(overrides: Partial<KbStats> = {}): KbStats {
  return {
    totalExperiments: 237,
    totalChemicals: 142,
    totalResearchers: 18,
    reactionTypes: [
      { name: "Suzuki-Coupling", experimentCount: 42 },
      { name: "Grignard-Reaction", experimentCount: 28 },
      { name: "Buchwald-Hartwig-Amination", experimentCount: 31 },
      { name: "Negishi-Coupling", experimentCount: 18 },
      { name: "Heck-Reaction", experimentCount: 15 },
    ],
    recentExperiments: [
      {
        title: "EXP-2026-0042",
        date: "2026-03-15",
        reactionType: "Suzuki-Coupling",
      },
      {
        title: "EXP-2026-0041",
        date: "2026-03-14",
        reactionType: "Grignard-Reaction",
      },
      {
        title: "EXP-2026-0040",
        date: "2026-03-13",
        reactionType: "Buchwald-Hartwig-Amination",
      },
    ],
    topResearchers: [
      { name: "Dr. Jane Mueller", experimentCount: 18 },
      { name: "Dr. Wei Chen", experimentCount: 15 },
      { name: "Dr. Anika Patel", experimentCount: 12 },
    ],
    ...overrides,
  };
}

describe("generateEnhancedIndexPage", () => {
  it("should generate a valid index page with realistic stats", () => {
    const stats = makeStats();
    const result = generateEnhancedIndexPage(stats);

    expect(result).toContain("# Chemistry KB Index");
    expect(result).toContain("**Total Experiments:** 237");
    expect(result).toContain("**Total Chemicals:** 142");
    expect(result).toContain("**Total Researchers:** 18");
  });

  it("should contain all required sections", () => {
    const stats = makeStats();
    const result = generateEnhancedIndexPage(stats);

    expect(result).toContain("## Quick Stats");
    expect(result).toContain("## Reaction Types");
    expect(result).toContain("## Recent Experiments");
    expect(result).toContain("## Researcher Directory");
    expect(result).toContain("## How Agents Should Use This KB");
    expect(result).toContain("## Tag Taxonomy Quick Reference");
    expect(result).toContain("## Navigation Tips");
  });

  it("should sort reaction types alphabetically", () => {
    const stats = makeStats();
    const result = generateEnhancedIndexPage(stats);

    const buchwaldPos = result.indexOf("[[Buchwald-Hartwig-Amination]]");
    const grignardPos = result.indexOf("[[Grignard-Reaction]]");
    const heckPos = result.indexOf("[[Heck-Reaction]]");
    const negishiPos = result.indexOf("[[Negishi-Coupling]]");
    const suzukiPos = result.indexOf("[[Suzuki-Coupling]]");

    expect(buchwaldPos).toBeLessThan(grignardPos);
    expect(grignardPos).toBeLessThan(heckPos);
    expect(heckPos).toBeLessThan(negishiPos);
    expect(negishiPos).toBeLessThan(suzukiPos);
  });

  it("should use wikilink format for reaction types", () => {
    const stats = makeStats();
    const result = generateEnhancedIndexPage(stats);

    expect(result).toContain("[[Suzuki-Coupling]] (42 experiments)");
    expect(result).toContain("[[Grignard-Reaction]] (28 experiments)");
  });

  it("should use wikilink format for recent experiments", () => {
    const stats = makeStats();
    const result = generateEnhancedIndexPage(stats);

    expect(result).toContain("[[EXP-2026-0042]]");
    expect(result).toContain("[[EXP-2026-0041]]");
    expect(result).toContain("[[EXP-2026-0040]]");
  });

  it("should use wikilink format for researchers", () => {
    const stats = makeStats();
    const result = generateEnhancedIndexPage(stats);

    expect(result).toContain("[[Dr. Jane Mueller]] (18 experiments)");
    expect(result).toContain("[[Dr. Wei Chen]] (15 experiments)");
    expect(result).toContain("[[Dr. Anika Patel]] (12 experiments)");
  });

  it("should include frontmatter with type, category, and updated date", () => {
    const stats = makeStats();
    const result = generateEnhancedIndexPage(stats);

    expect(result).toContain("type: index");
    expect(result).toContain("category: chemistry");
    expect(result).toContain("title: Chemistry KB Index");
    expect(result).toMatch(/updated: \d{4}-\d{2}-\d{2}/);
  });

  it("should handle empty stats gracefully", () => {
    const emptyStats: KbStats = {
      totalExperiments: 0,
      totalChemicals: 0,
      totalResearchers: 0,
      reactionTypes: [],
      recentExperiments: [],
      topResearchers: [],
    };
    const result = generateEnhancedIndexPage(emptyStats);

    expect(result).toContain("# Chemistry KB Index");
    expect(result).toContain("**Total Experiments:** 0");
    expect(result).toContain("**Total Chemicals:** 0");
    expect(result).toContain("**Total Researchers:** 0");
    expect(result).toContain("No reaction types yet");
    expect(result).toContain("No recent experiments");
    expect(result).toContain("No researchers yet");
  });

  it("should limit recent experiments to 5", () => {
    const stats = makeStats({
      recentExperiments: Array.from({ length: 8 }, (_, i) => ({
        title: `EXP-2026-00${50 + i}`,
        date: `2026-03-${String(20 - i).padStart(2, "0")}`,
        reactionType: "Suzuki-Coupling",
      })),
    });
    const result = generateEnhancedIndexPage(stats);

    expect(result).toContain("[[EXP-2026-0050]]");
    expect(result).toContain("[[EXP-2026-0054]]");
    expect(result).not.toContain("[[EXP-2026-0055]]");
  });

  it("should include agent navigation instructions", () => {
    const stats = makeStats();
    const result = generateEnhancedIndexPage(stats);

    expect(result).toContain("Start with the reaction type");
    expect(result).toContain("Read Key Learnings");
    expect(result).toContain("Filter by context");
    expect(result).toContain("Read top experiments");
    expect(result).toContain("Extract citations");
    expect(result).toContain('Check "Who To Ask"');
  });

  it("should include tag taxonomy table", () => {
    const stats = makeStats();
    const result = generateEnhancedIndexPage(stats);

    expect(result).toContain("`eln:`");
    expect(result).toContain("`cas:`");
    expect(result).toContain("`reaction:`");
    expect(result).toContain("`researcher:`");
    expect(result).toContain("`substrate-class:`");
    expect(result).toContain("`scale:`");
    expect(result).toContain("`challenge:`");
    expect(result).toContain("`quality:`");
  });
});

describe("aggregateKbStats", () => {
  it("should compute totals correctly", () => {
    const input: AggregatorInput = {
      experiments: [
        {
          id: "1",
          title: "Exp 1",
          date: "2026-03-15",
          reactionType: "Suzuki-Coupling",
          researcher: "Dr. Mueller",
        },
        {
          id: "2",
          title: "Exp 2",
          date: "2026-03-14",
          reactionType: "Grignard-Reaction",
          researcher: "Dr. Chen",
        },
      ],
      chemicals: [{ name: "Boronic acid" }, { name: "Pd catalyst" }],
      reactionTypes: [
        { name: "Suzuki-Coupling" },
        { name: "Grignard-Reaction" },
      ],
      researchers: [{ name: "Dr. Mueller" }, { name: "Dr. Chen" }],
    };

    const result = aggregateKbStats(input);

    expect(result.totalExperiments).toBe(2);
    expect(result.totalChemicals).toBe(2);
    expect(result.totalResearchers).toBe(2);
  });

  it("should sort reaction types alphabetically", () => {
    const input: AggregatorInput = {
      experiments: [
        {
          id: "1",
          title: "Exp 1",
          date: "2026-03-15",
          reactionType: "Suzuki-Coupling",
          researcher: "Dr. Mueller",
        },
        {
          id: "2",
          title: "Exp 2",
          date: "2026-03-14",
          reactionType: "Grignard-Reaction",
          researcher: "Dr. Chen",
        },
      ],
      chemicals: [],
      reactionTypes: [
        { name: "Suzuki-Coupling" },
        { name: "Grignard-Reaction" },
      ],
      researchers: [],
    };

    const result = aggregateKbStats(input);

    expect(result.reactionTypes[0].name).toBe("Grignard-Reaction");
    expect(result.reactionTypes[1].name).toBe("Suzuki-Coupling");
  });

  it("should count experiments per reaction type", () => {
    const input: AggregatorInput = {
      experiments: [
        {
          id: "1",
          title: "Exp 1",
          date: "2026-03-15",
          reactionType: "Suzuki-Coupling",
          researcher: "Dr. Mueller",
        },
        {
          id: "2",
          title: "Exp 2",
          date: "2026-03-14",
          reactionType: "Suzuki-Coupling",
          researcher: "Dr. Chen",
        },
        {
          id: "3",
          title: "Exp 3",
          date: "2026-03-13",
          reactionType: "Grignard-Reaction",
          researcher: "Dr. Mueller",
        },
      ],
      chemicals: [],
      reactionTypes: [
        { name: "Suzuki-Coupling" },
        { name: "Grignard-Reaction" },
      ],
      researchers: [],
    };

    const result = aggregateKbStats(input);

    const grignard = result.reactionTypes.find(
      (rt) => rt.name === "Grignard-Reaction"
    );
    const suzuki = result.reactionTypes.find(
      (rt) => rt.name === "Suzuki-Coupling"
    );

    expect(grignard?.experimentCount).toBe(1);
    expect(suzuki?.experimentCount).toBe(2);
  });

  it("should rank researchers by experiment count descending", () => {
    const input: AggregatorInput = {
      experiments: [
        {
          id: "1",
          title: "Exp 1",
          date: "2026-03-15",
          reactionType: "Suzuki-Coupling",
          researcher: "Dr. Chen",
        },
        {
          id: "2",
          title: "Exp 2",
          date: "2026-03-14",
          reactionType: "Suzuki-Coupling",
          researcher: "Dr. Mueller",
        },
        {
          id: "3",
          title: "Exp 3",
          date: "2026-03-13",
          reactionType: "Grignard-Reaction",
          researcher: "Dr. Mueller",
        },
        {
          id: "4",
          title: "Exp 4",
          date: "2026-03-12",
          reactionType: "Grignard-Reaction",
          researcher: "Dr. Mueller",
        },
      ],
      chemicals: [],
      reactionTypes: [],
      researchers: [],
    };

    const result = aggregateKbStats(input);

    expect(result.topResearchers[0].name).toBe("Dr. Mueller");
    expect(result.topResearchers[0].experimentCount).toBe(3);
    expect(result.topResearchers[1].name).toBe("Dr. Chen");
    expect(result.topResearchers[1].experimentCount).toBe(1);
  });

  it("should return top 5 most recent experiments sorted by date descending", () => {
    const experiments = Array.from({ length: 8 }, (_, i) => ({
      id: String(i + 1),
      title: `Exp ${i + 1}`,
      date: `2026-03-${String(20 - i).padStart(2, "0")}`,
      reactionType: "Suzuki-Coupling",
      researcher: "Dr. Mueller",
    }));

    const input: AggregatorInput = {
      experiments,
      chemicals: [],
      reactionTypes: [],
      researchers: [],
    };

    const result = aggregateKbStats(input);

    expect(result.recentExperiments).toHaveLength(5);
    expect(result.recentExperiments[0].date).toBe("2026-03-20");
    expect(result.recentExperiments[4].date).toBe("2026-03-16");
  });

  it("should handle empty input", () => {
    const input: AggregatorInput = {
      experiments: [],
      chemicals: [],
      reactionTypes: [],
      researchers: [],
    };

    const result = aggregateKbStats(input);

    expect(result.totalExperiments).toBe(0);
    expect(result.totalChemicals).toBe(0);
    expect(result.totalResearchers).toBe(0);
    expect(result.reactionTypes).toEqual([]);
    expect(result.recentExperiments).toEqual([]);
    expect(result.topResearchers).toEqual([]);
  });

  it("should handle reaction types with no matching experiments", () => {
    const input: AggregatorInput = {
      experiments: [],
      chemicals: [],
      reactionTypes: [
        { name: "Suzuki-Coupling" },
        { name: "Grignard-Reaction" },
      ],
      researchers: [],
    };

    const result = aggregateKbStats(input);

    expect(result.reactionTypes).toHaveLength(2);
    expect(result.reactionTypes[0].experimentCount).toBe(0);
    expect(result.reactionTypes[1].experimentCount).toBe(0);
  });
});
