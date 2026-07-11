import { describe, test, expect } from "vitest";
import {
  extractScopedTriple,
  scopedKeyString,
} from "@/lib/knowledge/subjectRelation";

describe("extractScopedTriple — clean measurement assertions", () => {
  test("a unit-bearing numeric claim extracts subject/relation/object/units at high confidence", () => {
    const t = extractScopedTriple("The yield was 72%.");
    expect(t).not.toBeNull();
    expect(t!.key.subject).toBe("yield");
    expect(t!.key.relation).toBe("be");
    expect(t!.object).toBe("72%");
    expect(t!.key.scope.units).toBe("%");
    expect(t!.confidence).toBeGreaterThanOrEqual(0.9);
  });

  test("two same-subject/unit claims with different values share a scoped key (collision)", () => {
    const a = extractScopedTriple("The yield was 72%.");
    const b = extractScopedTriple("Yield is 87 %.");
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(scopedKeyString(a!.key)).toBe(scopedKeyString(b!.key));
    // Same key but DIFFERENT object — the supersession trigger.
    expect(a!.object).not.toBe(b!.object);
  });

  test("different units do NOT collide (units are part of the scoped key)", () => {
    const a = extractScopedTriple("The mass was 72 g.");
    const b = extractScopedTriple("The mass was 72%.");
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(scopedKeyString(a!.key)).not.toBe(scopedKeyString(b!.key));
  });

  test("an explicit experiment scope separates otherwise-colliding claims", () => {
    const a = extractScopedTriple("In experiment EXP-1 the yield was 72%.");
    const b = extractScopedTriple("In experiment EXP-2 the yield was 72%.");
    expect(a!.key.scope.experimentId).toBe("exp-1");
    expect(b!.key.scope.experimentId).toBe("exp-2");
    expect(scopedKeyString(a!.key)).not.toBe(scopedKeyString(b!.key));
  });
});

describe("extractScopedTriple — defers ambiguous text (returns null)", () => {
  test.each([
    ["negation", "The yield was not 72%."],
    ["modality", "The yield may be 72%."],
    ["range", "The yield was 70-75%."],
    ["approx marker", "The yield was approximately 72%."],
    ["multi-clause", "The yield was 72% and the temperature was 25 °C."],
    ["no relation verb", "A high-yielding palladium reaction."],
  ])("%s → null (defer to C1)", (_label, text) => {
    expect(extractScopedTriple(text)).toBeNull();
  });
});

describe("scopedKeyString — stable + sortable", () => {
  test("is deterministic for the same key", () => {
    const a = extractScopedTriple("The yield was 72%.")!;
    const b = extractScopedTriple("The yield was 99%.")!;
    expect(scopedKeyString(a.key)).toBe(scopedKeyString(b.key));
  });
});
