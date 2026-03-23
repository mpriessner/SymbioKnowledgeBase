import { describe, it, expect } from "vitest";
import {
  aggregateKbStats,
  type AggregatorInput,
} from "@/lib/chemEln/retrieval/statsAggregator";

describe("aggregateKbStats", () => {
  const baseInput: AggregatorInput = {
    experiments: [
      {
        id: "EXP-001",
        title: "Suzuki coupling of aryl bromide",
        date: "2026-03-15",
        reactionType: "Suzuki Coupling",
        researcher: "Jane Doe",
      },
      {
        id: "EXP-002",
        title: "Heck reaction optimization",
        date: "2026-03-10",
        reactionType: "Heck Reaction",
        researcher: "John Smith",
      },
      {
        id: "EXP-003",
        title: "Suzuki with aryl chloride",
        date: "2026-03-01",
        reactionType: "Suzuki Coupling",
        researcher: "Jane Doe",
      },
    ],
    chemicals: [{ name: "Palladium Acetate" }, { name: "Sodium Carbonate" }],
    reactionTypes: [
      { name: "Suzuki Coupling" },
      { name: "Heck Reaction" },
    ],
    researchers: [{ name: "Jane Doe" }, { name: "John Smith" }],
  };

  it("should count total experiments", () => {
    const stats = aggregateKbStats(baseInput);
    expect(stats.totalExperiments).toBe(3);
  });

  it("should count total chemicals", () => {
    const stats = aggregateKbStats(baseInput);
    expect(stats.totalChemicals).toBe(2);
  });

  it("should count total researchers", () => {
    const stats = aggregateKbStats(baseInput);
    expect(stats.totalResearchers).toBe(2);
  });

  it("should group experiments by reaction type with counts", () => {
    const stats = aggregateKbStats(baseInput);
    const suzuki = stats.reactionTypes.find(
      (rt) => rt.name === "Suzuki Coupling"
    );
    const heck = stats.reactionTypes.find(
      (rt) => rt.name === "Heck Reaction"
    );
    expect(suzuki?.experimentCount).toBe(2);
    expect(heck?.experimentCount).toBe(1);
  });

  it("should sort reaction types alphabetically", () => {
    const stats = aggregateKbStats(baseInput);
    expect(stats.reactionTypes[0].name).toBe("Heck Reaction");
    expect(stats.reactionTypes[1].name).toBe("Suzuki Coupling");
  });

  it("should rank researchers by experiment count descending", () => {
    const stats = aggregateKbStats(baseInput);
    expect(stats.topResearchers[0].name).toBe("Jane Doe");
    expect(stats.topResearchers[0].experimentCount).toBe(2);
    expect(stats.topResearchers[1].name).toBe("John Smith");
    expect(stats.topResearchers[1].experimentCount).toBe(1);
  });

  it("should return recent experiments sorted by date descending", () => {
    const stats = aggregateKbStats(baseInput);
    expect(stats.recentExperiments.length).toBeGreaterThan(0);
    expect(stats.recentExperiments[0].title).toBe(
      "Suzuki coupling of aryl bromide"
    );
  });

  it("should handle empty input", () => {
    const empty: AggregatorInput = {
      experiments: [],
      chemicals: [],
      reactionTypes: [],
      researchers: [],
    };
    const stats = aggregateKbStats(empty);
    expect(stats.totalExperiments).toBe(0);
    expect(stats.totalChemicals).toBe(0);
    expect(stats.totalResearchers).toBe(0);
    expect(stats.reactionTypes).toEqual([]);
    expect(stats.recentExperiments).toEqual([]);
    expect(stats.topResearchers).toEqual([]);
  });

  it("should initialize reaction type counts to 0 even if no experiments match", () => {
    const input: AggregatorInput = {
      experiments: [],
      chemicals: [],
      reactionTypes: [{ name: "Grignard Reaction" }],
      researchers: [],
    };
    const stats = aggregateKbStats(input);
    expect(stats.reactionTypes).toEqual([
      { name: "Grignard Reaction", experimentCount: 0 },
    ]);
  });

  it("should limit recent experiments to 5", () => {
    const manyExperiments: AggregatorInput = {
      experiments: Array.from({ length: 10 }, (_, i) => ({
        id: `EXP-${i}`,
        title: `Experiment ${i}`,
        date: `2026-03-${String(i + 1).padStart(2, "0")}`,
        reactionType: "Suzuki Coupling",
        researcher: "Jane Doe",
      })),
      chemicals: [],
      reactionTypes: [{ name: "Suzuki Coupling" }],
      researchers: [{ name: "Jane Doe" }],
    };
    const stats = aggregateKbStats(manyExperiments);
    expect(stats.recentExperiments.length).toBe(5);
  });
});
