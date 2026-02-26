import { describe, it, expect } from "vitest";
import { fileSlug } from "@/lib/sync/slug";

describe("fileSlug", () => {
  it("preserves casing", () => {
    expect(fileSlug("Hello World")).toBe("Hello World");
  });

  it("replaces path-unsafe characters", () => {
    expect(fileSlug("file/with\\bad:chars*?")).toBe("file-with-bad-chars");
  });

  it("trims leading/trailing dots and hyphens", () => {
    expect(fileSlug("...leading")).toBe("leading");
    expect(fileSlug("trailing---")).toBe("trailing");
  });

  it("normalizes whitespace to single spaces", () => {
    expect(fileSlug("hello   world")).toBe("hello world");
  });

  it("truncates to 100 characters", () => {
    const long = "A".repeat(150);
    expect(fileSlug(long).length).toBe(100);
  });

  it("returns Untitled for empty input", () => {
    expect(fileSlug("")).toBe("Untitled");
    expect(fileSlug("---")).toBe("Untitled");
  });

  it("handles emoji in title", () => {
    expect(fileSlug("🚀 Project Alpha")).toBe("🚀 Project Alpha");
  });

  it("handles brackets and special chars", () => {
    expect(fileSlug("Page [draft] #1")).toBe("Page -draft- -1");
  });
});
