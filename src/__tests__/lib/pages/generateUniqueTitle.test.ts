import { describe, test, expect } from "vitest";
import { computeNextUntitledTitle } from "@/lib/pages/generateUniqueTitle";

describe("computeNextUntitledTitle", () => {
  test('returns "Untitled" when no existing titles', () => {
    expect(computeNextUntitledTitle([])).toBe("Untitled");
  });

  test('returns "Untitled 2" when "Untitled" exists', () => {
    expect(computeNextUntitledTitle(["Untitled"])).toBe("Untitled 2");
  });

  test('returns "Untitled 3" when "Untitled" and "Untitled 2" exist', () => {
    expect(computeNextUntitledTitle(["Untitled", "Untitled 2"])).toBe("Untitled 3");
  });

  test("fills gaps in numbering", () => {
    // If "Untitled" and "Untitled 3" exist, should return "Untitled 2"
    expect(computeNextUntitledTitle(["Untitled", "Untitled 3"])).toBe("Untitled 2");
  });

  test('returns "Untitled" when only numbered versions exist', () => {
    // If only "Untitled 5" exists, should return "Untitled" (slot 1 is free)
    expect(computeNextUntitledTitle(["Untitled 5"])).toBe("Untitled");
  });

  test("handles unrelated titles (ignores them)", () => {
    // Titles that don't match the "Untitled" or "Untitled N" pattern are ignored
    expect(computeNextUntitledTitle(["My Page", "Another Page"])).toBe("Untitled");
  });

  test("handles mixed relevant and irrelevant titles", () => {
    expect(computeNextUntitledTitle([
      "Untitled",
      "My Page",
      "Untitled 2",
      "Random Title",
    ])).toBe("Untitled 3");
  });

  test("handles large gaps correctly", () => {
    expect(computeNextUntitledTitle(["Untitled", "Untitled 100"])).toBe("Untitled 2");
  });

  test('ignores titles with "Untitled" prefix but non-numeric suffix', () => {
    // "Untitled Page" should be ignored (not "Untitled N" pattern)
    expect(computeNextUntitledTitle(["Untitled Page", "Untitled Notes"])).toBe("Untitled");
  });

  test("handles consecutive sequence correctly", () => {
    expect(computeNextUntitledTitle([
      "Untitled",
      "Untitled 2",
      "Untitled 3",
      "Untitled 4",
      "Untitled 5",
    ])).toBe("Untitled 6");
  });

  test("fills first available gap in sequence", () => {
    expect(computeNextUntitledTitle([
      "Untitled",
      "Untitled 3",
      "Untitled 5",
    ])).toBe("Untitled 2");
  });
});
