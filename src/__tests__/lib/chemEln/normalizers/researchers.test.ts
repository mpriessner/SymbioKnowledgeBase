import { describe, it, expect } from "vitest";
import {
  extractResearchers,
  getResearcherById,
  getResearchersByExpertise,
} from "@/lib/chemEln/normalizers/researchers";
import type {
  ChemElnExperiment,
  ClassifiedExperiment,
} from "@/lib/chemEln/types";

function makeExperiment(
  overrides: Partial<ChemElnExperiment> & { id: string }
): ChemElnExperiment {
  return {
    title: `Experiment ${overrides.id}`,
    researcher: {
      name: "Default Researcher",
      email: "default@lab.org",
      department: "Chemistry",
    },
    date: "2026-01-15",
    status: "completed",
    reaction_type: "Suzuki",
    chemicals: [],
    procedure: "",
    results: "",
    yield: 0,
    notes: "",
    ...overrides,
  };
}

describe("extractResearchers", () => {
  it("should extract researcher profiles from experiments", () => {
    const experiments: ChemElnExperiment[] = [
      makeExperiment({
        id: "exp-1",
        researcher: { name: "Alice Johnson", email: "alice@lab.org", department: "Organic" },
        reaction_type: "Suzuki",
      }),
      makeExperiment({
        id: "exp-2",
        researcher: { name: "Alice Johnson", email: "alice@lab.org", department: "Organic" },
        reaction_type: "Suzuki",
      }),
      makeExperiment({
        id: "exp-3",
        researcher: { name: "Bob Smith", email: "bob@lab.org", department: "Inorganic" },
        reaction_type: "Grignard",
      }),
    ];

    const profiles = extractResearchers(experiments);

    expect(profiles).toHaveLength(2);

    const alice = profiles.find((p) => p.name === "Alice Johnson");
    expect(alice).toBeDefined();
    expect(alice!.email).toBe("alice@lab.org");
    expect(alice!.totalExperiments).toBe(2);
    expect(alice!.experimentsByReactionType["Suzuki"]).toBe(2);

    const bob = profiles.find((p) => p.name === "Bob Smith");
    expect(bob).toBeDefined();
    expect(bob!.totalExperiments).toBe(1);
    expect(bob!.experimentsByReactionType["Grignard"]).toBe(1);
  });

  it("should deduplicate researchers by email", () => {
    const experiments: ChemElnExperiment[] = [
      makeExperiment({
        id: "exp-1",
        researcher: { name: "Alice Johnson", email: "alice@lab.org", department: "Organic" },
      }),
      makeExperiment({
        id: "exp-2",
        researcher: { name: "A. Johnson", email: "alice@lab.org", department: "Organic" },
      }),
      makeExperiment({
        id: "exp-3",
        researcher: { name: "Alice J.", email: "ALICE@lab.org", department: "Organic" },
      }),
    ];

    const profiles = extractResearchers(experiments);

    expect(profiles).toHaveLength(1);
    expect(profiles[0].totalExperiments).toBe(3);
    expect(profiles[0].name).toBe("Alice Johnson");
  });

  it("should handle missing email by grouping by name", () => {
    const experiments: ChemElnExperiment[] = [
      makeExperiment({
        id: "exp-1",
        researcher: { name: "Alice Johnson", email: "", department: "Organic" },
      }),
      makeExperiment({
        id: "exp-2",
        researcher: { name: "Alice Johnson", email: "", department: "Organic" },
      }),
    ];

    const profiles = extractResearchers(experiments);

    expect(profiles).toHaveLength(1);
    expect(profiles[0].email).toBeNull();
    expect(profiles[0].totalExperiments).toBe(2);
  });

  it("should handle missing name with 'Unknown Researcher'", () => {
    const experiments: ChemElnExperiment[] = [
      makeExperiment({
        id: "exp-1",
        researcher: { name: "", email: "mystery@lab.org", department: "" },
      }),
    ];

    const profiles = extractResearchers(experiments);

    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toBe("Unknown Researcher");
    expect(profiles[0].email).toBe("mystery@lab.org");
  });

  it("should compute primary expertise as top 3 reaction types", () => {
    const experiments: ChemElnExperiment[] = [
      makeExperiment({ id: "e1", reaction_type: "Suzuki" }),
      makeExperiment({ id: "e2", reaction_type: "Suzuki" }),
      makeExperiment({ id: "e3", reaction_type: "Suzuki" }),
      makeExperiment({ id: "e4", reaction_type: "Grignard" }),
      makeExperiment({ id: "e5", reaction_type: "Grignard" }),
      makeExperiment({ id: "e6", reaction_type: "Aldol" }),
      makeExperiment({ id: "e7", reaction_type: "Wittig" }),
    ];

    const profiles = extractResearchers(experiments);

    expect(profiles[0].primaryExpertise).toHaveLength(3);
    expect(profiles[0].primaryExpertise[0]).toBe("Suzuki");
    expect(profiles[0].primaryExpertise[1]).toBe("Grignard");
    expect(profiles[0].primaryExpertise[2]).toBe("Aldol");
  });

  it("should sort profiles by total experiment count descending", () => {
    const experiments: ChemElnExperiment[] = [
      makeExperiment({
        id: "exp-1",
        researcher: { name: "Alice", email: "alice@lab.org", department: "" },
      }),
      makeExperiment({
        id: "exp-2",
        researcher: { name: "Bob", email: "bob@lab.org", department: "" },
      }),
      makeExperiment({
        id: "exp-3",
        researcher: { name: "Bob", email: "bob@lab.org", department: "" },
      }),
      makeExperiment({
        id: "exp-4",
        researcher: { name: "Bob", email: "bob@lab.org", department: "" },
      }),
      makeExperiment({
        id: "exp-5",
        researcher: { name: "Charlie", email: "charlie@lab.org", department: "" },
      }),
      makeExperiment({
        id: "exp-6",
        researcher: { name: "Charlie", email: "charlie@lab.org", department: "" },
      }),
    ];

    const profiles = extractResearchers(experiments);

    expect(profiles[0].name).toBe("Bob");
    expect(profiles[0].totalExperiments).toBe(3);
    expect(profiles[1].name).toBe("Charlie");
    expect(profiles[1].totalExperiments).toBe(2);
    expect(profiles[2].name).toBe("Alice");
    expect(profiles[2].totalExperiments).toBe(1);
  });

  it("should build recent experiments list (last 5 by date)", () => {
    const experiments: ChemElnExperiment[] = [
      makeExperiment({ id: "e1", date: "2026-01-01", reaction_type: "Suzuki" }),
      makeExperiment({ id: "e2", date: "2026-02-01", reaction_type: "Grignard" }),
      makeExperiment({ id: "e3", date: "2026-03-01", reaction_type: "Aldol" }),
      makeExperiment({ id: "e4", date: "2026-04-01", reaction_type: "Wittig" }),
      makeExperiment({ id: "e5", date: "2026-05-01", reaction_type: "Diels-Alder" }),
      makeExperiment({ id: "e6", date: "2026-06-01", reaction_type: "Heck" }),
      makeExperiment({ id: "e7", date: "2026-07-01", reaction_type: "Sonogashira" }),
    ];

    const profiles = extractResearchers(experiments);

    expect(profiles[0].recentExperiments).toHaveLength(5);
    expect(profiles[0].recentExperiments[0].date).toBe("2026-07-01");
    expect(profiles[0].recentExperiments[0].reactionType).toBe("Sonogashira");
    expect(profiles[0].recentExperiments[4].date).toBe("2026-03-01");
  });

  it("should use classifications when provided", () => {
    const experiments: ChemElnExperiment[] = [
      makeExperiment({
        id: "exp-1",
        reaction_type: "Unknown",
      }),
      makeExperiment({
        id: "exp-2",
        reaction_type: "Unknown",
      }),
    ];

    const classifications: ClassifiedExperiment[] = [
      { experimentId: "exp-1", reactionType: "Suzuki", confidence: "high" },
      { experimentId: "exp-2", reactionType: "Grignard", confidence: "medium" },
    ];

    const profiles = extractResearchers(experiments, classifications);

    expect(profiles[0].experimentsByReactionType["Suzuki"]).toBe(1);
    expect(profiles[0].experimentsByReactionType["Grignard"]).toBe(1);
    expect(profiles[0].experimentsByReactionType["Unknown"]).toBeUndefined();
  });

  it("should handle experiments with no reaction type", () => {
    const experiments: ChemElnExperiment[] = [
      makeExperiment({
        id: "exp-1",
        reaction_type: undefined as unknown as string,
      }),
    ];

    const profiles = extractResearchers(experiments);

    expect(profiles[0].experimentsByReactionType["Unclassified"]).toBe(1);
    expect(profiles[0].primaryExpertise).toHaveLength(0);
  });

  it("should handle empty experiments array", () => {
    const profiles = extractResearchers([]);
    expect(profiles).toHaveLength(0);
  });

  it("should work with realistic multi-researcher data", () => {
    const experiments: ChemElnExperiment[] = [
      makeExperiment({
        id: "exp-001",
        title: "Suzuki coupling of 4-bromoanisole",
        researcher: { name: "Dr. Alice Johnson", email: "alice@uni.edu", department: "Organic Chemistry" },
        date: "2026-01-10",
        reaction_type: "Suzuki",
      }),
      makeExperiment({
        id: "exp-002",
        title: "Suzuki coupling of 2-chloropyridine",
        researcher: { name: "Dr. Alice Johnson", email: "alice@uni.edu", department: "Organic Chemistry" },
        date: "2026-01-15",
        reaction_type: "Suzuki",
      }),
      makeExperiment({
        id: "exp-003",
        title: "Grignard addition to benzaldehyde",
        researcher: { name: "Dr. Alice Johnson", email: "alice@uni.edu", department: "Organic Chemistry" },
        date: "2026-02-01",
        reaction_type: "Grignard",
      }),
      makeExperiment({
        id: "exp-004",
        title: "Hydrogenation of stilbene",
        researcher: { name: "Dr. Alice Johnson", email: "alice@uni.edu", department: "Organic Chemistry" },
        date: "2026-02-10",
        reaction_type: "Hydrogenation",
      }),
      makeExperiment({
        id: "exp-005",
        title: "Diels-Alder of cyclopentadiene",
        researcher: { name: "Bob Smith", email: "bob@uni.edu", department: "Materials" },
        date: "2026-01-20",
        reaction_type: "Diels-Alder",
      }),
      makeExperiment({
        id: "exp-006",
        title: "Diels-Alder of butadiene",
        researcher: { name: "Bob Smith", email: "bob@uni.edu", department: "Materials" },
        date: "2026-02-05",
        reaction_type: "Diels-Alder",
      }),
      makeExperiment({
        id: "exp-007",
        title: "Aldol condensation",
        researcher: { name: "Bob Smith", email: "bob@uni.edu", department: "Materials" },
        date: "2026-03-01",
        reaction_type: "Aldol",
      }),
    ];

    const profiles = extractResearchers(experiments);

    expect(profiles).toHaveLength(2);

    expect(profiles[0].name).toBe("Dr. Alice Johnson");
    expect(profiles[0].totalExperiments).toBe(4);
    expect(profiles[0].primaryExpertise).toEqual(["Suzuki", "Grignard", "Hydrogenation"]);

    expect(profiles[1].name).toBe("Bob Smith");
    expect(profiles[1].totalExperiments).toBe(3);
    expect(profiles[1].primaryExpertise).toEqual(["Diels-Alder", "Aldol"]);

    expect(profiles[1].recentExperiments[0].title).toBe("Aldol condensation");
    expect(profiles[1].recentExperiments[0].date).toBe("2026-03-01");
  });
});

describe("getResearcherById", () => {
  it("should find a researcher by userId", () => {
    const experiments: ChemElnExperiment[] = [
      makeExperiment({
        id: "exp-1",
        researcher: { name: "Alice", email: "alice@lab.org", department: "" },
      }),
    ];
    const profiles = extractResearchers(experiments);
    const found = getResearcherById(profiles, "alice@lab.org");
    expect(found).not.toBeNull();
    expect(found!.name).toBe("Alice");
  });

  it("should return null for unknown userId", () => {
    const result = getResearcherById([], "nonexistent");
    expect(result).toBeNull();
  });
});

describe("getResearchersByExpertise", () => {
  it("should return researchers with matching expertise", () => {
    const experiments: ChemElnExperiment[] = [
      makeExperiment({
        id: "exp-1",
        researcher: { name: "Alice", email: "alice@lab.org", department: "" },
        reaction_type: "Suzuki",
      }),
      makeExperiment({
        id: "exp-2",
        researcher: { name: "Bob", email: "bob@lab.org", department: "" },
        reaction_type: "Grignard",
      }),
    ];
    const profiles = extractResearchers(experiments);

    const suzukiExperts = getResearchersByExpertise(profiles, "Suzuki");
    expect(suzukiExperts).toHaveLength(1);
    expect(suzukiExperts[0].name).toBe("Alice");

    const noExperts = getResearchersByExpertise(profiles, "Wittig");
    expect(noExperts).toHaveLength(0);
  });
});
