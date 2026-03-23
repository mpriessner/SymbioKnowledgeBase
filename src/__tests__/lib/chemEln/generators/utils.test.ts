import { describe, it, expect } from "vitest";
import {
  buildFrontmatter,
  toTitleCase,
  experimentWikilink,
  chemicalWikilink,
  researcherWikilink,
  reactionTypeWikilink,
  buildTable,
} from "@/lib/chemEln/generators/utils";

describe("toTitleCase", () => {
  it("should capitalize the first letter of each word", () => {
    expect(toTitleCase("hello world")).toBe("Hello World");
  });

  it("should handle single word", () => {
    expect(toTitleCase("chemistry")).toBe("Chemistry");
  });

  it("should handle already title-cased strings", () => {
    expect(toTitleCase("Hello World")).toBe("Hello World");
  });

  it("should handle all uppercase strings", () => {
    expect(toTitleCase("HELLO WORLD")).toBe("Hello World");
  });

  it("should handle hyphenated words by splitting on hyphens", () => {
    expect(toTitleCase("cross-coupling")).toBe("Cross Coupling");
  });

  it("should handle empty string", () => {
    expect(toTitleCase("")).toBe("");
  });
});

describe("experimentWikilink", () => {
  it("should create valid [[wikilink]] syntax with id and title", () => {
    expect(experimentWikilink("EXP-001", "Suzuki coupling")).toBe(
      "[[EXP-001: Suzuki coupling]]"
    );
  });

  it("should handle special characters in title", () => {
    const result = experimentWikilink("EXP-002", "Pd(OAc)2 catalyzed reaction");
    expect(result).toBe("[[EXP-002: Pd(OAc)2 catalyzed reaction]]");
  });

  it("should handle empty title", () => {
    expect(experimentWikilink("EXP-003", "")).toBe("[[EXP-003: ]]");
  });
});

describe("chemicalWikilink", () => {
  it("should create wikilink with title-cased chemical name", () => {
    expect(chemicalWikilink({ name: "sodium chloride" })).toBe(
      "[[Sodium Chloride]]"
    );
  });
});

describe("researcherWikilink", () => {
  it("should create wikilink with title-cased researcher name", () => {
    expect(researcherWikilink("jane doe")).toBe("[[Jane Doe]]");
  });
});

describe("reactionTypeWikilink", () => {
  it("should create wikilink with title-cased reaction type", () => {
    expect(reactionTypeWikilink("suzuki coupling")).toBe("[[Suzuki Coupling]]");
  });
});

describe("buildFrontmatter", () => {
  it("should generate frontmatter delimited by ---", () => {
    const result = buildFrontmatter({ title: "Test" });
    expect(result).toMatch(/^---\n/);
    expect(result).toMatch(/\n---$/);
  });

  it("should include key-value pairs", () => {
    const result = buildFrontmatter({
      "page-type": "experiment",
      title: "My Experiment",
    });
    expect(result).toContain("page-type: experiment");
    expect(result).toContain("title: My Experiment");
  });

  it("should format arrays with brackets", () => {
    const result = buildFrontmatter({
      tags: ["chemistry", "suzuki"],
    });
    expect(result).toContain("tags: [chemistry, suzuki]");
  });

  it("should quote string values containing colons", () => {
    const result = buildFrontmatter({
      description: "Step 1: mix reagents",
    });
    expect(result).toContain('description: "Step 1: mix reagents"');
  });

  it("should skip null and undefined values", () => {
    const result = buildFrontmatter({
      title: "Test",
      cas: null,
      formula: undefined,
    });
    expect(result).not.toContain("cas");
    expect(result).not.toContain("formula");
  });

  it("should handle numeric values", () => {
    const result = buildFrontmatter({ quality_score: 5 });
    expect(result).toContain("quality_score: 5");
  });

  it("should handle boolean values", () => {
    const result = buildFrontmatter({ published: true });
    expect(result).toContain("published: true");
  });

  it("should handle empty metadata", () => {
    const result = buildFrontmatter({});
    expect(result).toBe("---\n---");
  });
});

describe("buildTable", () => {
  it("should produce a markdown table with headers and rows", () => {
    const result = buildTable(
      ["Name", "Count"],
      [["Suzuki", "10"], ["Heck", "5"]]
    );
    expect(result).toContain("| Name | Count |");
    expect(result).toContain("| --- | --- |");
    expect(result).toContain("| Suzuki | 10 |");
    expect(result).toContain("| Heck | 5 |");
  });

  it("should handle empty rows", () => {
    const result = buildTable(["Name", "Count"], []);
    expect(result).toContain("| Name | Count |");
    expect(result).toContain("| --- | --- |");
    const lines = result.split("\n");
    expect(lines).toHaveLength(2);
  });
});
