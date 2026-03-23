import { describe, test, expect } from "vitest";
import {
  classifyReactions,
  classifySingleExperiment,
  REACTION_TYPE_TABLE,
} from "@/lib/chemEln/normalizers/reactions";
import type { RawExperimentData } from "@/lib/chemEln/fetcherTypes";

function makeExperiment(
  overrides: Partial<RawExperimentData> = {}
): RawExperimentData {
  return {
    id: "exp-001",
    title: "Test Experiment",
    researcher_name: "Dr. Test",
    researcher_email: "test@lab.org",
    date: "2026-03-21",
    status: "completed",
    reaction_type: null,
    substrate_class: null,
    chemicals: [],
    procedure: null,
    results: null,
    yield_percent: null,
    practical_notes: null,
    ...overrides,
  };
}

describe("Reaction Type Classification", () => {
  describe("classifySingleExperiment", () => {
    test("classifies from reaction_type field with high confidence", () => {
      const exp = makeExperiment({
        id: "exp-rt-1",
        reaction_type: "Suzuki-Miyaura Cross-Coupling",
      });

      const result = classifySingleExperiment(exp);

      expect(result.experimentId).toBe("exp-rt-1");
      expect(result.reactionType).toBe("Suzuki");
      expect(result.confidence).toBe("high");
    });

    test("classifies Grignard from reaction_type field", () => {
      const exp = makeExperiment({
        reaction_type: "Grignard Reaction",
      });

      const result = classifySingleExperiment(exp);

      expect(result.reactionType).toBe("Grignard");
      expect(result.confidence).toBe("high");
    });

    test("classifies from title keywords with medium confidence", () => {
      const exp = makeExperiment({
        id: "exp-title-1",
        title: "Buchwald-Hartwig Amination of Aryl Chloride",
        reaction_type: null,
      });

      const result = classifySingleExperiment(exp);

      expect(result.experimentId).toBe("exp-title-1");
      expect(result.reactionType).toBe("Buchwald-Hartwig");
      expect(result.confidence).toBe("medium");
    });

    test("classifies from title when reaction_type is Unknown", () => {
      const exp = makeExperiment({
        title: "Grignard Reaction with Magnesium",
        reaction_type: "Unknown",
      });

      const result = classifySingleExperiment(exp);

      expect(result.reactionType).toBe("Grignard");
      expect(result.confidence).toBe("medium");
    });

    test("classifies from results field as fallback", () => {
      const exp = makeExperiment({
        title: "Organic Synthesis Experiment #42",
        reaction_type: null,
        results: "The Sonogashira coupling proceeded smoothly",
      });

      const result = classifySingleExperiment(exp);

      expect(result.reactionType).toBe("Sonogashira");
      expect(result.confidence).toBe("medium");
    });

    test("returns Unclassified with low confidence when no match", () => {
      const exp = makeExperiment({
        id: "exp-unknown",
        title: "Novel Reaction Pathway Exploration",
        reaction_type: null,
      });

      const result = classifySingleExperiment(exp);

      expect(result.experimentId).toBe("exp-unknown");
      expect(result.reactionType).toBe("Unclassified");
      expect(result.confidence).toBe("low");
    });

    test("returns Unclassified when reaction_type is empty string", () => {
      const exp = makeExperiment({
        reaction_type: "",
        title: "Random Lab Work",
      });

      const result = classifySingleExperiment(exp);

      expect(result.reactionType).toBe("Unclassified");
    });

    test("matching is case-insensitive", () => {
      const exp1 = makeExperiment({
        reaction_type: "SUZUKI COUPLING",
      });
      const exp2 = makeExperiment({
        reaction_type: "suzuki coupling",
      });
      const exp3 = makeExperiment({
        title: "DIELS-ALDER Cycloaddition",
        reaction_type: null,
      });

      expect(classifySingleExperiment(exp1).reactionType).toBe("Suzuki");
      expect(classifySingleExperiment(exp2).reactionType).toBe("Suzuki");
      expect(classifySingleExperiment(exp3).reactionType).toBe("Diels-Alder");
    });

    test("classifies each cross-coupling reaction type", () => {
      const cases: Array<{ keyword: string; expected: string }> = [
        { keyword: "Suzuki", expected: "Suzuki" },
        { keyword: "Heck reaction", expected: "Heck" },
        { keyword: "Sonogashira coupling", expected: "Sonogashira" },
        { keyword: "Stille coupling", expected: "Stille" },
        { keyword: "Negishi coupling", expected: "Negishi" },
        { keyword: "Kumada coupling", expected: "Kumada" },
        { keyword: "Buchwald-Hartwig", expected: "Buchwald-Hartwig" },
      ];

      for (const { keyword, expected } of cases) {
        const exp = makeExperiment({ reaction_type: keyword });
        expect(classifySingleExperiment(exp).reactionType).toBe(expected);
      }
    });

    test("classifies classical reaction types", () => {
      const cases: Array<{ keyword: string; expected: string }> = [
        { keyword: "Grignard", expected: "Grignard" },
        { keyword: "Aldol condensation", expected: "Aldol" },
        { keyword: "Wittig reaction", expected: "Wittig" },
        { keyword: "Diels-Alder", expected: "Diels-Alder" },
        { keyword: "Friedel-Crafts Acylation", expected: "Friedel-Crafts Acylation" },
      ];

      for (const { keyword, expected } of cases) {
        const exp = makeExperiment({ reaction_type: keyword });
        expect(classifySingleExperiment(exp).reactionType).toBe(expected);
      }
    });

    test("classifies functional group transformations", () => {
      const cases: Array<{ keyword: string; expected: string }> = [
        { keyword: "Hydrogenation", expected: "Hydrogenation" },
        { keyword: "Swern Oxidation", expected: "Oxidation" },
        { keyword: "NaBH4 Reduction", expected: "Reduction" },
        { keyword: "Fischer Esterification", expected: "Esterification" },
        { keyword: "Amide formation via amidation", expected: "Amidation" },
        { keyword: "Bromination of toluene", expected: "Halogenation" },
      ];

      for (const { keyword, expected } of cases) {
        const exp = makeExperiment({ reaction_type: keyword });
        expect(classifySingleExperiment(exp).reactionType).toBe(expected);
      }
    });

    test("classifies other reaction types", () => {
      const cases: Array<{ keyword: string; expected: string }> = [
        { keyword: "CuAAC click chemistry", expected: "Click Chemistry" },
        { keyword: "Olefin metathesis with Grubbs", expected: "Metathesis" },
        { keyword: "Radical polymerization", expected: "Polymerization" },
      ];

      for (const { keyword, expected } of cases) {
        const exp = makeExperiment({ reaction_type: keyword });
        expect(classifySingleExperiment(exp).reactionType).toBe(expected);
      }
    });

    test("prefers reaction_type field over title keywords", () => {
      const exp = makeExperiment({
        title: "Aldol Condensation Product Analysis",
        reaction_type: "Suzuki Coupling",
      });

      const result = classifySingleExperiment(exp);

      expect(result.reactionType).toBe("Suzuki");
      expect(result.confidence).toBe("high");
    });

    test("each experiment gets exactly one classification", () => {
      const exp = makeExperiment({
        title: "Suzuki and Heck Coupling Comparison",
        reaction_type: null,
      });

      const result = classifySingleExperiment(exp);

      expect(typeof result.reactionType).toBe("string");
      expect(result.reactionType).toBe("Suzuki");
    });
  });

  describe("classifyReactions", () => {
    test("groups experiments by reaction type", () => {
      const experiments = [
        makeExperiment({ id: "exp-1", reaction_type: "Suzuki" }),
        makeExperiment({ id: "exp-2", reaction_type: "Suzuki" }),
        makeExperiment({ id: "exp-3", reaction_type: "Grignard" }),
      ];

      const stats = classifyReactions(experiments);

      const suzuki = stats.find((s) => s.reactionType === "Suzuki");
      const grignard = stats.find((s) => s.reactionType === "Grignard");

      expect(suzuki?.experimentCount).toBe(2);
      expect(suzuki?.experiments).toEqual(["exp-1", "exp-2"]);
      expect(grignard?.experimentCount).toBe(1);
      expect(grignard?.experiments).toEqual(["exp-3"]);
    });

    test("sorts stats by experiment count descending", () => {
      const experiments = [
        makeExperiment({ id: "exp-1", reaction_type: "Suzuki" }),
        makeExperiment({ id: "exp-2", reaction_type: "Grignard" }),
        makeExperiment({ id: "exp-3", reaction_type: "Grignard" }),
        makeExperiment({ id: "exp-4", reaction_type: "Grignard" }),
      ];

      const stats = classifyReactions(experiments);

      expect(stats[0].reactionType).toBe("Grignard");
      expect(stats[0].experimentCount).toBe(3);
      expect(stats[1].reactionType).toBe("Suzuki");
      expect(stats[1].experimentCount).toBe(1);
    });

    test("computes avgYield across grouped experiments", () => {
      const experiments = [
        makeExperiment({ id: "exp-1", reaction_type: "Suzuki", yield_percent: 80 }),
        makeExperiment({ id: "exp-2", reaction_type: "Suzuki", yield_percent: 90 }),
        makeExperiment({ id: "exp-3", reaction_type: "Suzuki", yield_percent: null }),
      ];

      const stats = classifyReactions(experiments);
      const suzuki = stats.find((s) => s.reactionType === "Suzuki");

      expect(suzuki?.avgYield).toBe(85);
    });

    test("returns null avgYield when no yields available", () => {
      const experiments = [
        makeExperiment({ id: "exp-1", reaction_type: "Suzuki", yield_percent: null }),
      ];

      const stats = classifyReactions(experiments);

      expect(stats[0].avgYield).toBeNull();
    });

    test("collects unique researchers per reaction type", () => {
      const experiments = [
        makeExperiment({
          id: "exp-1",
          reaction_type: "Suzuki",
          researcher_name: "Dr. Chen",
        }),
        makeExperiment({
          id: "exp-2",
          reaction_type: "Suzuki",
          researcher_name: "Dr. Smith",
        }),
        makeExperiment({
          id: "exp-3",
          reaction_type: "Suzuki",
          researcher_name: "Dr. Chen",
        }),
      ];

      const stats = classifyReactions(experiments);
      const suzuki = stats.find((s) => s.reactionType === "Suzuki");

      expect(suzuki?.researchers).toEqual(["Dr. Chen", "Dr. Smith"]);
    });

    test("all experiments are accounted for in stats", () => {
      const experiments = [
        makeExperiment({ id: "exp-1", reaction_type: "Suzuki" }),
        makeExperiment({ id: "exp-2", title: "Novel experiment", reaction_type: null }),
        makeExperiment({ id: "exp-3", reaction_type: "Grignard" }),
      ];

      const stats = classifyReactions(experiments);
      const totalClassified = stats.reduce(
        (sum, s) => sum + s.experimentCount,
        0
      );

      expect(totalClassified).toBe(experiments.length);
    });

    test("handles empty experiment list", () => {
      const stats = classifyReactions([]);

      expect(stats).toEqual([]);
    });

    test("handles realistic mixed experiment data", () => {
      const experiments = [
        makeExperiment({
          id: "exp-001",
          title: "Suzuki Coupling of 4-Bromoanisole",
          reaction_type: "Suzuki Coupling",
          researcher_name: "Dr. Sarah Chen",
          yield_percent: 85,
        }),
        makeExperiment({
          id: "exp-002",
          title: "Pd-catalyzed Suzuki-Miyaura reaction",
          reaction_type: "Suzuki-Miyaura",
          researcher_name: "Dr. Sarah Chen",
          yield_percent: 92,
        }),
        makeExperiment({
          id: "exp-003",
          title: "Grignard Addition to Benzaldehyde",
          reaction_type: "Grignard",
          researcher_name: "Dr. James Wilson",
          yield_percent: 78,
        }),
        makeExperiment({
          id: "exp-004",
          title: "Optimization of Diels-Alder Cycloaddition",
          reaction_type: null,
          researcher_name: "Dr. Maria Lopez",
          yield_percent: 65,
        }),
        makeExperiment({
          id: "exp-005",
          title: "New Synthetic Route",
          reaction_type: null,
          researcher_name: "Dr. James Wilson",
          yield_percent: null,
        }),
        makeExperiment({
          id: "exp-006",
          title: "Heck Reaction with Styrene",
          reaction_type: "Heck",
          researcher_name: "Dr. Sarah Chen",
          yield_percent: 71,
        }),
      ];

      const stats = classifyReactions(experiments);

      expect(stats.length).toBe(5);

      const suzuki = stats.find((s) => s.reactionType === "Suzuki");
      expect(suzuki?.experimentCount).toBe(2);
      expect(suzuki?.avgYield).toBe(88.5);
      expect(suzuki?.researchers).toEqual(["Dr. Sarah Chen"]);

      const dielsAlder = stats.find((s) => s.reactionType === "Diels-Alder");
      expect(dielsAlder?.experimentCount).toBe(1);
      expect(dielsAlder?.avgYield).toBe(65);

      const unclassified = stats.find(
        (s) => s.reactionType === "Unclassified"
      );
      expect(unclassified?.experimentCount).toBe(1);
      expect(unclassified?.experiments).toEqual(["exp-005"]);

      const totalClassified = stats.reduce(
        (sum, s) => sum + s.experimentCount,
        0
      );
      expect(totalClassified).toBe(6);
    });
  });

  describe("REACTION_TYPE_TABLE", () => {
    test("contains approximately 30 reaction types", () => {
      expect(REACTION_TYPE_TABLE.length).toBeGreaterThanOrEqual(28);
      expect(REACTION_TYPE_TABLE.length).toBeLessThanOrEqual(40);
    });

    test("every entry has canonicalName, keywords, and category", () => {
      for (const entry of REACTION_TYPE_TABLE) {
        expect(entry.canonicalName).toBeTruthy();
        expect(entry.keywords.length).toBeGreaterThan(0);
        expect(entry.category).toBeTruthy();
      }
    });

    test("canonical names are unique", () => {
      const names = REACTION_TYPE_TABLE.map((e) => e.canonicalName);
      expect(new Set(names).size).toBe(names.length);
    });
  });
});
