import { describe, it, expect, beforeEach } from "vitest";
import {
  CrossReferenceResolver,
  type LookupData,
} from "@/lib/chemEln/sync/resolver";

function makeLookupData(
  overrides: Partial<LookupData> = {},
): LookupData {
  return {
    chemicals: overrides.chemicals ?? [
      {
        id: "c1",
        name: "Palladium Acetate",
        casNumber: "3375-31-3",
        molecularFormula: "C4H6O4Pd",
      },
      {
        id: "c2",
        name: "N,N-Dimethylformamide",
        casNumber: "68-12-2",
        molecularFormula: "C3H7NO",
      },
    ],
    reactionTypes: overrides.reactionTypes ?? [
      {
        name: "Suzuki Coupling",
        experimentCount: 25,
        avgYield: 78,
        researcherCount: 3,
        experiments: [],
        keyLearnings: [],
        commonPitfalls: [],
        topResearchers: [],
      },
    ],
    researchers: overrides.researchers ?? [
      {
        name: "Jane Doe",
        totalExperiments: 45,
        topReactionTypes: [],
        recentExperiments: [],
        keyContributions: [],
      },
    ],
    substrateClasses: overrides.substrateClasses ?? [],
  };
}

describe("CrossReferenceResolver", () => {
  let resolver: CrossReferenceResolver;

  beforeEach(() => {
    resolver = new CrossReferenceResolver();
    resolver.buildLookupMap(makeLookupData());
  });

  describe("buildLookupMap", () => {
    it("should populate lookup map with chemicals, reaction types, and researchers", () => {
      expect(resolver.resolveWikilink("Palladium Acetate")).not.toBeNull();
      expect(resolver.resolveWikilink("Suzuki Coupling")).not.toBeNull();
      expect(resolver.resolveWikilink("Jane Doe")).not.toBeNull();
    });

    it("should populate lookup map with substrate classes", () => {
      const r = new CrossReferenceResolver();
      r.buildLookupMap(
        makeLookupData({
          substrateClasses: [{ name: "Aryl Halides", experimentCount: 10 }],
        }),
      );
      const result = r.resolveWikilink("Aryl Halides");
      expect(result).not.toBeNull();
      expect(result?.type).toBe("substrate-class");
    });
  });

  describe("name normalization", () => {
    it("should resolve chemical by name case-insensitively", () => {
      const result = resolver.resolveWikilink("palladium acetate");
      expect(result).not.toBeNull();
      expect(result?.name).toBe("Palladium Acetate");
      expect(result?.type).toBe("chemical");
    });

    it("should resolve with UPPER CASE input", () => {
      const result = resolver.resolveWikilink("PALLADIUM ACETATE");
      expect(result).not.toBeNull();
      expect(result?.name).toBe("Palladium Acetate");
    });

    it("should normalize extra whitespace", () => {
      const result = resolver.resolveWikilink("  palladium   acetate  ");
      expect(result).not.toBeNull();
      expect(result?.name).toBe("Palladium Acetate");
    });

    it("should handle special characters in chemical names", () => {
      const result = resolver.resolveWikilink("N,N-Dimethylformamide");
      expect(result).not.toBeNull();
      expect(result?.type).toBe("chemical");
    });
  });

  describe("resolveWikilink", () => {
    it("should resolve chemical by CAS number", () => {
      const result = resolver.resolveWikilink("3375-31-3");
      expect(result).not.toBeNull();
      expect(result?.name).toBe("Palladium Acetate");
    });

    it("should resolve reaction type by name", () => {
      const result = resolver.resolveWikilink("Suzuki Coupling");
      expect(result).not.toBeNull();
      expect(result?.type).toBe("reaction-type");
    });

    it("should resolve researcher by name", () => {
      const result = resolver.resolveWikilink("Jane Doe");
      expect(result).not.toBeNull();
      expect(result?.type).toBe("researcher");
    });

    it("should return null for unknown references", () => {
      const result = resolver.resolveWikilink("Unknown Chemical XYZ");
      expect(result).toBeNull();
    });
  });

  describe("findUnresolvedLinks", () => {
    it("should find unresolved links in markdown", () => {
      const markdown =
        "- [[Palladium Acetate]] -- catalyst\n- [[Unknown Chemical]] -- reagent\n- [[Suzuki Coupling]]";
      const unresolved = resolver.findUnresolvedLinks(markdown);
      expect(unresolved).toEqual(["Unknown Chemical"]);
    });

    it("should deduplicate unresolved links", () => {
      const markdown = "- [[Unknown A]]\n- [[Unknown A]]\n- [[Unknown B]]";
      const unresolved = resolver.findUnresolvedLinks(markdown);
      expect(unresolved).toHaveLength(2);
      expect(unresolved).toContain("Unknown A");
      expect(unresolved).toContain("Unknown B");
    });

    it("should handle wikilinks with display text", () => {
      const markdown = "Used [[Palladium Acetate|Pd(OAc)2]] as catalyst";
      const unresolved = resolver.findUnresolvedLinks(markdown);
      expect(unresolved).toHaveLength(0);
    });

    it("should return empty for markdown with no wikilinks", () => {
      const unresolved = resolver.findUnresolvedLinks("No links here.");
      expect(unresolved).toHaveLength(0);
    });
  });

  describe("createStubPage", () => {
    it("should generate stub page with needs-enrichment tag", () => {
      const stub = resolver.createStubPage("Mystery Reagent", "chemical");
      expect(stub).toContain("needs-enrichment");
      expect(stub).toContain("# Mystery Reagent");
      expect(stub).toContain("auto-generated");
    });

    it("should include page-type in frontmatter", () => {
      const stub = resolver.createStubPage("Test Chemical", "chemical");
      expect(stub).toContain('page-type: "chemical"');
    });

    it("should add stub to lookup map so it resolves afterwards", () => {
      expect(resolver.resolveWikilink("Mystery Reagent")).toBeNull();
      resolver.createStubPage("Mystery Reagent", "chemical");
      const resolved = resolver.resolveWikilink("Mystery Reagent");
      expect(resolved).not.toBeNull();
      expect(resolved?.stubbed).toBe(true);
    });

    it("should track stubs via getAllStubs", () => {
      resolver.createStubPage("Stub A", "chemical");
      resolver.createStubPage("Stub B", "reaction-type");
      const stubs = resolver.getAllStubs();
      expect(stubs).toHaveLength(2);
    });
  });

  describe("long name truncation", () => {
    it("should truncate very long names to 255 chars with hash", () => {
      const longName = "A".repeat(300);
      const stub = resolver.createStubPage(longName, "chemical");
      // The title line should not contain the full 300-char name
      const titleLine = stub
        .split("\n")
        .find((l) => l.startsWith("# "));
      expect(titleLine).toBeDefined();
      expect(titleLine!.length).toBeLessThan(300);
    });

    it("should not truncate names under 255 chars", () => {
      const name = "Short Chemical Name";
      const stub = resolver.createStubPage(name, "chemical");
      expect(stub).toContain("# Short Chemical Name");
    });
  });

  describe("duplicate name disambiguation", () => {
    it("should disambiguate chemicals with same name using CAS number", () => {
      const r = new CrossReferenceResolver();
      r.buildLookupMap(
        makeLookupData({
          chemicals: [
            { id: "c1", name: "Ethanol", casNumber: "64-17-5" },
            { id: "c2", name: "Ethanol", casNumber: "64-17-5-d" },
          ],
          reactionTypes: [],
          researchers: [],
          substrateClasses: [],
        }),
      );
      // First entry uses normal name
      const first = r.resolveWikilink("Ethanol");
      expect(first).not.toBeNull();
      expect(first?.id).toBe("c1");
      // Second entry disambiguated with CAS
      const second = r.resolveWikilink("Ethanol (64-17-5-d)");
      expect(second).not.toBeNull();
      expect(second?.id).toBe("c2");
    });
  });

  describe("chemical usage tracking", () => {
    it("should track chemical usages via registerUsage", () => {
      resolver.registerUsage("c1", {
        experimentId: "EXP-001",
        experimentTitle: "Test",
        role: "catalyst",
        amount: 5,
        unit: "mol%",
      });

      const usages = resolver.getChemicalUsages("c1");
      expect(usages).toHaveLength(1);
      expect(usages[0].role).toBe("catalyst");
    });

    it("should track usages via trackUsage helper", () => {
      resolver.trackUsage("Palladium Acetate", "EXP-002", "catalyst", 10);
      const usages = resolver.getUsages("Palladium Acetate");
      expect(usages).toHaveLength(1);
      expect(usages[0].experimentId).toBe("EXP-002");
    });

    it("should accumulate multiple usages", () => {
      resolver.registerUsage("c1", {
        experimentId: "EXP-001",
        experimentTitle: "Test 1",
        role: "catalyst",
        amount: 5,
        unit: "mol%",
      });
      resolver.registerUsage("c1", {
        experimentId: "EXP-002",
        experimentTitle: "Test 2",
        role: "reagent",
        amount: 10,
        unit: "mg",
      });

      const usages = resolver.getChemicalUsages("c1");
      expect(usages).toHaveLength(2);
    });

    it("should return empty array for chemicals with no usages", () => {
      expect(resolver.getChemicalUsages("nonexistent")).toEqual([]);
    });
  });

  describe("getUnresolvedCount", () => {
    it("should return 0 when no stubs exist", () => {
      expect(resolver.getUnresolvedCount()).toBe(0);
    });

    it("should count stub pages", () => {
      resolver.createStubPage("Unknown A", "chemical");
      resolver.createStubPage("Unknown B", "chemical");
      expect(resolver.getUnresolvedCount()).toBe(2);
    });
  });

  describe("researcher mapping", () => {
    it("should resolve researcher by userId", () => {
      resolver.setResearcherMapping("user-123", "Alice Smith");
      expect(resolver.resolveResearcher("user-123")).toBe("Alice Smith");
    });

    it("should return Unknown Researcher for unmapped userId", () => {
      expect(resolver.resolveResearcher("unknown-user")).toBe(
        "Unknown Researcher",
      );
    });
  });
});
