import { describe, test, expect } from "vitest";
import { normalizeText, tokenize, toNameKey } from "@/lib/aok/normalize";

describe("normalizeText", () => {
  test("lowercases, maps -_/ to space, and collapses whitespace", () => {
    expect(normalizeText("Main Shut-Off Valve")).toBe("main shut off valve");
    expect(normalizeText("A/B_C-D")).toBe("a b c d");
    expect(normalizeText("  extra   space  ")).toBe("extra space");
  });

  // AC-4: "shut off" (typed query) must match "shut-off" (stored name).
  test("normalizes hyphenated and space-separated forms to the same string", () => {
    expect(normalizeText("shut off")).toBe(normalizeText("shut-off"));
  });
});

describe("tokenize", () => {
  test("splits normalized text into tokens", () => {
    expect(tokenize("Main Shut-Off Valve")).toEqual(["main", "shut", "off", "valve"]);
  });

  test("returns an empty array for empty/whitespace-only input", () => {
    expect(tokenize("   ")).toEqual([]);
    expect(tokenize("")).toEqual([]);
  });
});

describe("toNameKey", () => {
  test("lowercases and trims without dash/slash normalization", () => {
    expect(toNameKey("  Main Lab  ")).toBe("main lab");
    expect(toNameKey("Shut-Off")).toBe("shut-off"); // NOT space-normalized — distinct from search normalization
  });
});
