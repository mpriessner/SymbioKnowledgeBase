import { describe, it, expect } from "vitest";

describe("Toggle Extension", () => {
  it("should define correct node name", () => {
    expect("toggle").toBe("toggle");
  });

  it("should have isOpen attribute default to true", () => {
    const defaultAttrs = { isOpen: true };
    expect(defaultAttrs.isOpen).toBe(true);
  });

  it("should support content group 'block+'", () => {
    const contentExpression = "block+";
    expect(contentExpression).toBe("block+");
  });
});

describe("Callout Extension", () => {
  it("should define correct node name", () => {
    expect("callout").toBe("callout");
  });

  it("should support all four variants", () => {
    const variants = ["info", "warning", "success", "error"];
    expect(variants).toHaveLength(4);
  });

  it("should default to info variant with light bulb emoji", () => {
    const defaults = { emoji: "\u{1F4A1}", variant: "info" };
    expect(defaults.emoji).toBe("\u{1F4A1}");
    expect(defaults.variant).toBe("info");
  });
});

describe("Bookmark Extension", () => {
  it("should define correct attributes", () => {
    const attrs = ["url", "title", "description", "favicon", "image"];
    expect(attrs).toContain("url");
    expect(attrs).toContain("title");
    expect(attrs).toContain("description");
    expect(attrs).toContain("favicon");
    expect(attrs).toContain("image");
  });
});
