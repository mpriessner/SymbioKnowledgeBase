import { describe, it, expect } from "vitest";
import { SUPPORTED_LANGUAGES } from "@/components/editor/extensions/codeBlock";

describe("Code Block Configuration", () => {
  it("should support all required languages", () => {
    const labels = SUPPORTED_LANGUAGES.map((l) => l.label);
    expect(labels).toContain("JavaScript");
    expect(labels).toContain("TypeScript");
    expect(labels).toContain("Python");
    expect(labels).toContain("Go");
    expect(labels).toContain("Rust");
    expect(labels).toContain("SQL");
    expect(labels).toContain("JSON");
    expect(labels).toContain("HTML");
    expect(labels).toContain("CSS");
    expect(labels).toContain("Bash");
    expect(labels).toContain("Markdown");
    expect(labels).toContain("Plain Text");
  });

  it("should have unique values for all languages", () => {
    const values = SUPPORTED_LANGUAGES.map((l) => l.value);
    // Plain Text has empty string value, all others should be unique
    const nonEmpty = values.filter((v) => v !== "");
    const unique = new Set(nonEmpty);
    expect(unique.size).toBe(nonEmpty.length);
  });
});
