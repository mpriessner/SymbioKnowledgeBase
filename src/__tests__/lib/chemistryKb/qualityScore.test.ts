import { describe, test, expect } from "vitest";
import { computeQualityScore } from "@/lib/chemistryKb/qualityScore";

const baseInput = {
  yield: 0,
  hasPracticalNotes: false,
  hasProducts: false,
  hasCharacterization: false,
  hasFullProcedure: false,
};

describe("computeQualityScore", () => {
  test("returns 1 for yield below 60%", () => {
    expect(computeQualityScore({ ...baseInput, yield: 50 })).toBe(1);
    expect(computeQualityScore({ ...baseInput, yield: 0 })).toBe(1);
    expect(computeQualityScore({ ...baseInput, yield: 59 })).toBe(1);
  });

  test("returns 2 for yield 60-69%", () => {
    expect(computeQualityScore({ ...baseInput, yield: 60 })).toBe(2);
    expect(computeQualityScore({ ...baseInput, yield: 69 })).toBe(2);
  });

  test("returns 3 for yield 70-79%", () => {
    expect(computeQualityScore({ ...baseInput, yield: 70 })).toBe(3);
    expect(computeQualityScore({ ...baseInput, yield: 79 })).toBe(3);
  });

  test("returns 4 for yield 80-89%", () => {
    expect(computeQualityScore({ ...baseInput, yield: 80 })).toBe(4);
    expect(computeQualityScore({ ...baseInput, yield: 89 })).toBe(4);
  });

  test("returns 5 for yield >= 90%", () => {
    expect(computeQualityScore({ ...baseInput, yield: 90 })).toBe(5);
    expect(computeQualityScore({ ...baseInput, yield: 100 })).toBe(5);
  });

  test("adds 0.5 bonus for practical notes", () => {
    const result = computeQualityScore({
      ...baseInput,
      yield: 60,
      hasPracticalNotes: true,
    });
    expect(result).toBe(3); // 2 + 0.5 rounds to 3
  });

  test("adds 0.5 bonus for products with characterization", () => {
    const result = computeQualityScore({
      ...baseInput,
      yield: 60,
      hasProducts: true,
      hasCharacterization: true,
    });
    expect(result).toBe(3); // 2 + 0.5 rounds to 3
  });

  test("does not add bonus for products without characterization", () => {
    const result = computeQualityScore({
      ...baseInput,
      yield: 60,
      hasProducts: true,
      hasCharacterization: false,
    });
    expect(result).toBe(2);
  });

  test("adds 0.5 bonus for full procedure", () => {
    const result = computeQualityScore({
      ...baseInput,
      yield: 60,
      hasFullProcedure: true,
    });
    expect(result).toBe(3); // 2 + 0.5 rounds to 3
  });

  test("combines all completeness bonuses", () => {
    const result = computeQualityScore({
      yield: 70,
      hasPracticalNotes: true,
      hasProducts: true,
      hasCharacterization: true,
      hasFullProcedure: true,
    });
    expect(result).toBe(5); // 3 + 1.5 = 4.5 rounds to 5
  });

  test("clamps score to maximum of 5", () => {
    const result = computeQualityScore({
      yield: 95,
      hasPracticalNotes: true,
      hasProducts: true,
      hasCharacterization: true,
      hasFullProcedure: true,
    });
    expect(result).toBe(5);
  });

  test("clamps score to minimum of 1", () => {
    expect(computeQualityScore({ ...baseInput, yield: -10 })).toBe(1);
  });
});
