import { describe, it, expect } from "vitest";
import {
  deduplicateChemicals,
  normalizeChemicalName,
  toTitleCase,
} from "@/lib/chemEln/normalizers/chemicals";
import type { RawExperimentData } from "@/lib/chemEln/fetcherTypes";

function makeExperiment(
  overrides: Partial<RawExperimentData> & { id: string },
): RawExperimentData {
  return {
    title: "Test Experiment",
    researcher_name: "Dr. Test",
    researcher_email: "test@lab.com",
    date: "2026-01-15",
    status: "completed",
    reaction_type: "suzuki coupling",
    substrate_class: "aryl halides",
    chemicals: [],
    procedure: null,
    results: null,
    yield_percent: null,
    practical_notes: null,
    ...overrides,
  };
}

describe("normalizeChemicalName", () => {
  it("should lowercase and strip special characters", () => {
    expect(normalizeChemicalName("Tetrahydrofuran")).toBe("tetrahydrofuran");
    expect(normalizeChemicalName("  THF  ")).toBe("thf");
    expect(normalizeChemicalName("N,N-Dimethylformamide")).toBe(
      "nndimethylformamide",
    );
  });

  it("should handle Unicode characters", () => {
    expect(normalizeChemicalName("cafe\u0301")).toBe("cafe");
    expect(normalizeChemicalName("\u00FCber-acid")).toBe("uberacid");
  });
});

describe("toTitleCase", () => {
  it("should convert to title case", () => {
    expect(toTitleCase("sodium chloride")).toBe("Sodium Chloride");
    expect(toTitleCase("ETHANOL")).toBe("Ethanol");
    expect(toTitleCase("tert-butyl methyl ether")).toBe(
      "Tert-butyl Methyl Ether",
    );
  });
});

describe("deduplicateChemicals", () => {
  it("should merge chemicals with the same CAS number", () => {
    const experiments = [
      makeExperiment({
        id: "exp1",
        chemicals: [
          {
            name: "THF",
            cas_number: "109-99-9",
            molecular_weight: 72.11,
            role: "solvent",
            amount: 10,
            unit: "mL",
          },
        ],
      }),
      makeExperiment({
        id: "exp2",
        chemicals: [
          {
            name: "Tetrahydrofuran",
            cas_number: "109-99-9",
            molecular_weight: 72.11,
            role: "solvent",
            amount: 15,
            unit: "mL",
          },
        ],
      }),
    ];

    const result = deduplicateChemicals(experiments);

    expect(result).toHaveLength(1);
    expect(result[0].casNumber).toBe("109-99-9");
    expect(result[0].canonicalName).toBe("Tetrahydrofuran");
    expect(result[0].synonyms).toContain("THF");
    expect(result[0].usageCount).toBe(2);
    expect(result[0].experiments).toContain("exp1");
    expect(result[0].experiments).toContain("exp2");
  });

  it("should normalize chemical names to Title Case", () => {
    const experiments = [
      makeExperiment({
        id: "exp1",
        chemicals: [
          {
            name: "sodium chloride",
            cas_number: "7647-14-5",
            molecular_weight: 58.44,
            role: "reagent",
            amount: 1,
            unit: "g",
          },
        ],
      }),
    ];

    const result = deduplicateChemicals(experiments);

    expect(result[0].canonicalName).toBe("Sodium Chloride");
  });

  it("should resolve common abbreviations via synonym registry", () => {
    const experiments = [
      makeExperiment({
        id: "exp1",
        chemicals: [
          {
            name: "DCM",
            cas_number: "75-09-2",
            molecular_weight: 84.93,
            role: "solvent",
            amount: 50,
            unit: "mL",
          },
        ],
      }),
    ];

    const result = deduplicateChemicals(experiments);

    expect(result[0].canonicalName).toBe("Dichloromethane");
    expect(result[0].synonyms).toContain("DCM");
  });

  it("should resolve abbreviations without CAS via synonym map", () => {
    const experiments = [
      makeExperiment({
        id: "exp1",
        chemicals: [
          {
            name: "DMSO",
            cas_number: null,
            molecular_weight: null,
            role: "solvent",
            amount: 5,
            unit: "mL",
          },
        ],
      }),
      makeExperiment({
        id: "exp2",
        chemicals: [
          {
            name: "dimethyl sulfoxide",
            cas_number: null,
            molecular_weight: 78.13,
            role: "solvent",
            amount: 10,
            unit: "mL",
          },
        ],
      }),
    ];

    const result = deduplicateChemicals(experiments);

    expect(result).toHaveLength(1);
    expect(result[0].canonicalName).toBe("Dimethyl Sulfoxide");
    expect(result[0].usageCount).toBe(2);
  });

  it("should handle chemicals without CAS numbers, deduplicating by name", () => {
    const experiments = [
      makeExperiment({
        id: "exp1",
        chemicals: [
          {
            name: "Custom Reagent A",
            cas_number: null,
            molecular_weight: null,
            role: "reagent",
            amount: 5,
            unit: "g",
          },
        ],
      }),
      makeExperiment({
        id: "exp2",
        chemicals: [
          {
            name: "custom reagent a",
            cas_number: null,
            molecular_weight: null,
            role: "reagent",
            amount: 3,
            unit: "g",
          },
        ],
      }),
    ];

    const result = deduplicateChemicals(experiments);

    expect(result).toHaveLength(1);
    expect(result[0].casNumber).toBeNull();
    expect(result[0].usageCount).toBe(2);
  });

  it("should aggregate usage count across experiments correctly", () => {
    const experiments = [
      makeExperiment({
        id: "exp1",
        chemicals: [
          {
            name: "Ethanol",
            cas_number: "64-17-5",
            molecular_weight: 46.07,
            role: "solvent",
            amount: 20,
            unit: "mL",
          },
          {
            name: "Ethanol",
            cas_number: "64-17-5",
            molecular_weight: 46.07,
            role: "reagent",
            amount: 5,
            unit: "mL",
          },
        ],
      }),
      makeExperiment({
        id: "exp2",
        chemicals: [
          {
            name: "EtOH",
            cas_number: "64-17-5",
            molecular_weight: 46.07,
            role: "solvent",
            amount: 30,
            unit: "mL",
          },
        ],
      }),
      makeExperiment({
        id: "exp3",
        chemicals: [
          {
            name: "Ethanol",
            cas_number: "64-17-5",
            molecular_weight: 46.07,
            role: "solvent",
            amount: 10,
            unit: "mL",
          },
        ],
      }),
    ];

    const result = deduplicateChemicals(experiments);
    const ethanol = result.find((r) => r.casNumber === "64-17-5");

    expect(ethanol).toBeDefined();
    expect(ethanol!.usageCount).toBe(3);
    expect(ethanol!.experiments).toHaveLength(3);
    expect(ethanol!.synonyms).toContain("EtOH");
  });

  it("should not double-count when same chemical appears as reagent and product in same experiment", () => {
    const experiments = [
      makeExperiment({
        id: "exp1",
        chemicals: [
          {
            name: "Methanol",
            cas_number: "67-56-1",
            molecular_weight: 32.04,
            role: "reagent",
            amount: 10,
            unit: "mL",
          },
          {
            name: "Methanol",
            cas_number: "67-56-1",
            molecular_weight: 32.04,
            role: "product",
            amount: 5,
            unit: "mL",
          },
        ],
      }),
    ];

    const result = deduplicateChemicals(experiments);
    const methanol = result.find((r) => r.casNumber === "67-56-1");

    expect(methanol!.usageCount).toBe(1);
  });

  it("should sort results by usage count descending", () => {
    const experiments = [
      makeExperiment({
        id: "exp1",
        chemicals: [
          {
            name: "Water",
            cas_number: "7732-18-5",
            molecular_weight: 18.015,
            role: "solvent",
            amount: 100,
            unit: "mL",
          },
          {
            name: "Sodium Hydroxide",
            cas_number: "1310-73-2",
            molecular_weight: 40.0,
            role: "reagent",
            amount: 2,
            unit: "g",
          },
        ],
      }),
      makeExperiment({
        id: "exp2",
        chemicals: [
          {
            name: "Water",
            cas_number: "7732-18-5",
            molecular_weight: 18.015,
            role: "solvent",
            amount: 50,
            unit: "mL",
          },
        ],
      }),
      makeExperiment({
        id: "exp3",
        chemicals: [
          {
            name: "Water",
            cas_number: "7732-18-5",
            molecular_weight: 18.015,
            role: "solvent",
            amount: 50,
            unit: "mL",
          },
        ],
      }),
    ];

    const result = deduplicateChemicals(experiments);

    expect(result[0].canonicalName).toBe("Water");
    expect(result[0].usageCount).toBe(3);
    expect(result[1].canonicalName).toBe("Sodium Hydroxide");
    expect(result[1].usageCount).toBe(1);
  });

  it("should add known abbreviations as synonyms even if not in data", () => {
    const experiments = [
      makeExperiment({
        id: "exp1",
        chemicals: [
          {
            name: "Acetonitrile",
            cas_number: "75-05-8",
            molecular_weight: 41.05,
            role: "solvent",
            amount: 25,
            unit: "mL",
          },
        ],
      }),
    ];

    const result = deduplicateChemicals(experiments);
    const acn = result.find((r) => r.casNumber === "75-05-8");

    expect(acn).toBeDefined();
    expect(acn!.canonicalName).toBe("Acetonitrile");
    expect(acn!.synonyms).toContain("ACN");
    expect(acn!.synonyms).toContain("MECN");
  });

  it("should handle realistic multi-experiment data", () => {
    const experiments = [
      makeExperiment({
        id: "exp-001",
        title: "Suzuki Coupling of 4-Bromoanisole",
        chemicals: [
          {
            name: "4-Bromoanisole",
            cas_number: "104-92-7",
            molecular_weight: 187.04,
            role: "reagent",
            amount: 1.0,
            unit: "mmol",
          },
          {
            name: "Phenylboronic acid",
            cas_number: "98-80-6",
            molecular_weight: 121.93,
            role: "reagent",
            amount: 1.2,
            unit: "mmol",
          },
          {
            name: "Pd(PPh3)4",
            cas_number: "14221-01-3",
            molecular_weight: 1155.56,
            role: "catalyst",
            amount: 0.05,
            unit: "mmol",
          },
          {
            name: "THF",
            cas_number: "109-99-9",
            molecular_weight: 72.11,
            role: "solvent",
            amount: 10,
            unit: "mL",
          },
          {
            name: "K2CO3",
            cas_number: "584-08-7",
            molecular_weight: 138.21,
            role: "reagent",
            amount: 2.0,
            unit: "mmol",
          },
        ],
      }),
      makeExperiment({
        id: "exp-002",
        title: "Suzuki Coupling of 4-Chlorotoluene",
        chemicals: [
          {
            name: "4-Chlorotoluene",
            cas_number: "106-43-4",
            molecular_weight: 126.58,
            role: "reagent",
            amount: 1.0,
            unit: "mmol",
          },
          {
            name: "Phenylboronic acid",
            cas_number: "98-80-6",
            molecular_weight: 121.93,
            role: "reagent",
            amount: 1.5,
            unit: "mmol",
          },
          {
            name: "Tetrakis(triphenylphosphine)palladium(0)",
            cas_number: "14221-01-3",
            molecular_weight: 1155.56,
            role: "catalyst",
            amount: 0.03,
            unit: "mmol",
          },
          {
            name: "Tetrahydrofuran",
            cas_number: "109-99-9",
            molecular_weight: 72.11,
            role: "solvent",
            amount: 15,
            unit: "mL",
          },
          {
            name: "Potassium carbonate",
            cas_number: "584-08-7",
            molecular_weight: 138.21,
            role: "reagent",
            amount: 3.0,
            unit: "mmol",
          },
        ],
      }),
      makeExperiment({
        id: "exp-003",
        title: "Grignard Reaction",
        chemicals: [
          {
            name: "Magnesium",
            cas_number: "7439-95-4",
            molecular_weight: 24.31,
            role: "reagent",
            amount: 2.0,
            unit: "mmol",
          },
          {
            name: "Bromobenzene",
            cas_number: "108-86-1",
            molecular_weight: 157.01,
            role: "reagent",
            amount: 1.5,
            unit: "mmol",
          },
          {
            name: "THF",
            cas_number: "109-99-9",
            molecular_weight: 72.11,
            role: "solvent",
            amount: 20,
            unit: "mL",
          },
          {
            name: "DCM",
            cas_number: "75-09-2",
            molecular_weight: 84.93,
            role: "solvent",
            amount: 30,
            unit: "mL",
          },
        ],
      }),
      makeExperiment({
        id: "exp-004",
        title: "Workup and Purification",
        chemicals: [
          {
            name: "Dichloromethane",
            cas_number: "75-09-2",
            molecular_weight: 84.93,
            role: "solvent",
            amount: 50,
            unit: "mL",
          },
          {
            name: "Ethyl acetate",
            cas_number: "141-78-6",
            molecular_weight: 88.11,
            role: "solvent",
            amount: 30,
            unit: "mL",
          },
          {
            name: "Hexane",
            cas_number: "110-54-3",
            molecular_weight: 86.18,
            role: "solvent",
            amount: 50,
            unit: "mL",
          },
        ],
      }),
    ];

    const result = deduplicateChemicals(experiments);

    // THF appears in exp-001, exp-002, exp-003 = 3 uses
    const thf = result.find((r) => r.casNumber === "109-99-9");
    expect(thf).toBeDefined();
    expect(thf!.canonicalName).toBe("Tetrahydrofuran");
    expect(thf!.usageCount).toBe(3);
    expect(thf!.synonyms).toContain("THF");

    // DCM appears in exp-003, exp-004 = 2 uses
    const dcm = result.find((r) => r.casNumber === "75-09-2");
    expect(dcm).toBeDefined();
    expect(dcm!.canonicalName).toBe("Dichloromethane");
    expect(dcm!.usageCount).toBe(2);
    expect(dcm!.synonyms).toContain("DCM");

    // Phenylboronic acid in exp-001, exp-002 = 2 uses
    const pba = result.find((r) => r.casNumber === "98-80-6");
    expect(pba).toBeDefined();
    expect(pba!.usageCount).toBe(2);

    // Pd catalyst merged despite different names (same CAS)
    const pd = result.find((r) => r.casNumber === "14221-01-3");
    expect(pd).toBeDefined();
    expect(pd!.usageCount).toBe(2);
    expect(pd!.synonyms.length).toBeGreaterThanOrEqual(1);

    // K2CO3 merged with Potassium carbonate (same CAS)
    const k2co3 = result.find((r) => r.casNumber === "584-08-7");
    expect(k2co3).toBeDefined();
    expect(k2co3!.usageCount).toBe(2);

    // Total unique chemicals: 4-Bromoanisole, Phenylboronic acid, Pd catalyst,
    // THF, K2CO3, 4-Chlorotoluene, Magnesium, Bromobenzene, DCM, EtOAc, Hexane = 11
    expect(result).toHaveLength(11);

    // Should be sorted by usage count descending
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].usageCount).toBeGreaterThanOrEqual(
        result[i].usageCount,
      );
    }
  });

  it("should preserve molecular weight from source data", () => {
    const experiments = [
      makeExperiment({
        id: "exp1",
        chemicals: [
          {
            name: "Benzaldehyde",
            cas_number: "100-52-7",
            molecular_weight: 106.12,
            role: "reagent",
            amount: 1,
            unit: "mmol",
          },
        ],
      }),
    ];

    const result = deduplicateChemicals(experiments);

    expect(result[0].molecularWeight).toBe(106.12);
  });

  it("should handle empty experiments array", () => {
    const result = deduplicateChemicals([]);
    expect(result).toEqual([]);
  });

  it("should handle experiments with no chemicals", () => {
    const experiments = [
      makeExperiment({ id: "exp1", chemicals: [] }),
      makeExperiment({ id: "exp2", chemicals: [] }),
    ];

    const result = deduplicateChemicals(experiments);
    expect(result).toEqual([]);
  });
});
