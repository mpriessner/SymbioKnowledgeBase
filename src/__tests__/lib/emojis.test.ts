import { describe, test, expect } from "vitest";
import {
  EMOJI_CATEGORIES,
  ALL_EMOJIS,
  searchEmojis,
} from "@/lib/emojis";

describe("Emoji Data", () => {
  test("EMOJI_CATEGORIES has categories with non-empty emoji arrays", () => {
    expect(EMOJI_CATEGORIES.length).toBeGreaterThan(0);
    for (const category of EMOJI_CATEGORIES) {
      expect(category.name).toBeTruthy();
      expect(category.emojis.length).toBeGreaterThan(0);
    }
  });

  test("ALL_EMOJIS is the flat list of all emojis", () => {
    const totalFromCategories = EMOJI_CATEGORIES.reduce(
      (sum, cat) => sum + cat.emojis.length,
      0
    );
    expect(ALL_EMOJIS.length).toBe(totalFromCategories);
  });

  test("every emoji is a string", () => {
    for (const emoji of ALL_EMOJIS) {
      expect(typeof emoji).toBe("string");
      expect(emoji.length).toBeGreaterThan(0);
    }
  });
});

describe("searchEmojis", () => {
  test("returns all emojis for empty query", () => {
    const results = searchEmojis("");
    expect(results.length).toBe(ALL_EMOJIS.length);
  });

  test("returns all emojis for whitespace-only query", () => {
    const results = searchEmojis("   ");
    expect(results.length).toBe(ALL_EMOJIS.length);
  });

  test("returns category emojis when searching by category name", () => {
    const results = searchEmojis("Science");
    const scienceCategory = EMOJI_CATEGORIES.find((c) => c.name === "Science");
    expect(scienceCategory).toBeDefined();
    expect(results.length).toBe(scienceCategory!.emojis.length);
    expect(results).toEqual(scienceCategory!.emojis);
  });

  test("category search is case-insensitive", () => {
    const results = searchEmojis("science");
    const scienceCategory = EMOJI_CATEGORIES.find((c) => c.name === "Science");
    expect(results.length).toBe(scienceCategory!.emojis.length);
  });

  test("returns all emojis when query does not match any category", () => {
    const results = searchEmojis("xyznonexistent");
    expect(results.length).toBe(ALL_EMOJIS.length);
  });
});
