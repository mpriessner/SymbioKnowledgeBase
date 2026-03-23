import { describe, test, expect } from "vitest";
import {
  createTag,
  parseTag,
  isNamespacedTag,
  isValidTagFormat,
  getTagsByNamespace,
} from "@/lib/chemistryKb/tags";
import { TAG_NAMESPACES } from "@/lib/chemistryKb/types";

describe("createTag", () => {
  test("creates a namespaced tag", () => {
    expect(createTag(TAG_NAMESPACES.ELN, "EXP-2026-0042")).toBe(
      "eln:EXP-2026-0042"
    );
    expect(createTag(TAG_NAMESPACES.CAS, "14221-01-3")).toBe(
      "cas:14221-01-3"
    );
    expect(createTag(TAG_NAMESPACES.REACTION, "suzuki-coupling")).toBe(
      "reaction:suzuki-coupling"
    );
    expect(createTag(TAG_NAMESPACES.QUALITY, "4")).toBe("quality:4");
  });

  test("throws on empty value", () => {
    expect(() => createTag(TAG_NAMESPACES.ELN, "")).toThrow(
      "Tag value must not be empty"
    );
    expect(() => createTag(TAG_NAMESPACES.ELN, "   ")).toThrow(
      "Tag value must not be empty"
    );
  });
});

describe("parseTag", () => {
  test("parses a namespaced tag", () => {
    expect(parseTag("eln:EXP-2026-0042")).toEqual({
      namespace: "eln:",
      value: "EXP-2026-0042",
    });
    expect(parseTag("cas:14221-01-3")).toEqual({
      namespace: "cas:",
      value: "14221-01-3",
    });
    expect(parseTag("substrate-class:heteroaryl")).toEqual({
      namespace: "substrate-class:",
      value: "heteroaryl",
    });
  });

  test("returns empty namespace for bare tags", () => {
    expect(parseTag("chemical")).toEqual({
      namespace: "",
      value: "chemical",
    });
  });
});

describe("isNamespacedTag", () => {
  test("returns true for namespaced tags", () => {
    expect(isNamespacedTag("eln:EXP-2026-0042")).toBe(true);
    expect(isNamespacedTag("cas:14221-01-3")).toBe(true);
    expect(isNamespacedTag("quality:4")).toBe(true);
    expect(isNamespacedTag("substrate-class:heteroaryl")).toBe(true);
  });

  test("returns false for bare tags", () => {
    expect(isNamespacedTag("chemical")).toBe(false);
    expect(isNamespacedTag("some-tag")).toBe(false);
  });
});

describe("isValidTagFormat", () => {
  test("returns true for valid namespaced tags", () => {
    expect(isValidTagFormat("eln:EXP-2026-0042")).toBe(true);
    expect(isValidTagFormat("quality:4")).toBe(true);
  });

  test("returns true for bare tags", () => {
    expect(isValidTagFormat("chemical")).toBe(true);
  });

  test("returns false for empty strings", () => {
    expect(isValidTagFormat("")).toBe(false);
    expect(isValidTagFormat("   ")).toBe(false);
  });

  test("returns false for namespace without value", () => {
    expect(isValidTagFormat("eln:")).toBe(false);
    expect(isValidTagFormat("cas:")).toBe(false);
  });
});

describe("getTagsByNamespace", () => {
  const tags = [
    "eln:EXP-2026-0042",
    "reaction:suzuki-coupling",
    "researcher:mueller",
    "quality:4",
    "chemical",
    "reaction:buchwald-hartwig",
  ];

  test("filters tags by namespace and returns values", () => {
    expect(getTagsByNamespace(tags, TAG_NAMESPACES.REACTION)).toEqual([
      "suzuki-coupling",
      "buchwald-hartwig",
    ]);
  });

  test("returns empty array when no tags match", () => {
    expect(getTagsByNamespace(tags, TAG_NAMESPACES.SCALE)).toEqual([]);
  });

  test("returns single match", () => {
    expect(getTagsByNamespace(tags, TAG_NAMESPACES.QUALITY)).toEqual(["4"]);
  });
});
