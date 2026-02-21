import { describe, it, expect } from "vitest";
import {
  conversionOptions,
  getAvailableConversions,
} from "@/lib/editor/blockConversion";

describe("conversionOptions", () => {
  it("should include all expected block types", () => {
    const ids = conversionOptions.map((o) => o.id);
    expect(ids).toContain("paragraph");
    expect(ids).toContain("heading1");
    expect(ids).toContain("heading2");
    expect(ids).toContain("heading3");
    expect(ids).toContain("bulletList");
    expect(ids).toContain("orderedList");
    expect(ids).toContain("taskList");
    expect(ids).toContain("blockquote");
    expect(ids).toContain("callout");
    expect(ids).toContain("codeBlock");
  });

  it("should have 10 conversion options", () => {
    expect(conversionOptions).toHaveLength(10);
  });

  it("should have unique IDs", () => {
    const ids = conversionOptions.map((o) => o.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("should have non-empty name, icon, and description for all options", () => {
    conversionOptions.forEach((option) => {
      expect(option.name.length).toBeGreaterThan(0);
      expect(option.icon.length).toBeGreaterThan(0);
      expect(option.description.length).toBeGreaterThan(0);
    });
  });
});

describe("getAvailableConversions", () => {
  it("should return all options when editor state cannot be determined", () => {
    const mockEditor = {
      isActive: () => false,
    } as unknown as import("@tiptap/react").Editor;

    const result = getAvailableConversions(mockEditor);
    expect(result.length).toBe(conversionOptions.length);
  });

  it("should exclude the current block type from results", () => {
    const mockEditor = {
      isActive: (name: string) => name === "paragraph",
    } as unknown as import("@tiptap/react").Editor;

    const result = getAvailableConversions(mockEditor);
    const ids = result.map((o) => o.id);
    expect(ids).not.toContain("paragraph");
    expect(result.length).toBe(conversionOptions.length - 1);
  });

  it("should exclude heading1 when H1 is active", () => {
    const mockEditor = {
      isActive: (name: string, attrs?: Record<string, unknown>) =>
        name === "heading" && attrs?.level === 1,
    } as unknown as import("@tiptap/react").Editor;

    const result = getAvailableConversions(mockEditor);
    const ids = result.map((o) => o.id);
    expect(ids).not.toContain("heading1");
    expect(ids).toContain("heading2");
    expect(ids).toContain("heading3");
  });
});
