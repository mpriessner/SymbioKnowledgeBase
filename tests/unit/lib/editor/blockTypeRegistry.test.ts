import { describe, it, expect } from "vitest";
import {
  blockTypeRegistry,
  filterBlockTypes,
} from "@/lib/editor/blockTypeRegistry";

describe("blockTypeRegistry", () => {
  it("should contain all 14 block types", () => {
    expect(blockTypeRegistry).toHaveLength(14);
  });

  it("should have unique IDs for all block types", () => {
    const ids = blockTypeRegistry.map((item) => item.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("should have non-empty name, description, icon, and keywords for all items", () => {
    blockTypeRegistry.forEach((item) => {
      expect(item.name).toBeTruthy();
      expect(item.description).toBeTruthy();
      expect(item.icon).toBeTruthy();
      expect(item.keywords.length).toBeGreaterThan(0);
      expect(typeof item.command).toBe("function");
    });
  });

  it("should include expected block types", () => {
    const names = blockTypeRegistry.map((item) => item.name);
    expect(names).toContain("Paragraph");
    expect(names).toContain("Heading 1");
    expect(names).toContain("Heading 2");
    expect(names).toContain("Heading 3");
    expect(names).toContain("Bulleted List");
    expect(names).toContain("Numbered List");
    expect(names).toContain("To-Do List");
    expect(names).toContain("Toggle");
    expect(names).toContain("Quote");
    expect(names).toContain("Divider");
    expect(names).toContain("Callout");
    expect(names).toContain("Code Block");
    expect(names).toContain("Image");
    expect(names).toContain("Bookmark");
  });
});

describe("filterBlockTypes", () => {
  it("should return all items when query is empty", () => {
    expect(filterBlockTypes("")).toHaveLength(14);
    expect(filterBlockTypes("  ")).toHaveLength(14);
  });

  it("should filter by name (case-insensitive)", () => {
    const results = filterBlockTypes("heading");
    expect(results.length).toBe(3);
    expect(results.map((r) => r.id)).toEqual([
      "heading1",
      "heading2",
      "heading3",
    ]);
  });

  it("should filter by partial name match", () => {
    const results = filterBlockTypes("hea");
    expect(results.length).toBe(3);
  });

  it("should filter by keywords", () => {
    const results = filterBlockTypes("checkbox");
    expect(results.length).toBe(1);
    expect(results[0].id).toBe("taskList");
  });

  it("should filter by description", () => {
    const results = filterBlockTypes("syntax");
    expect(results.length).toBe(1);
    expect(results[0].id).toBe("codeBlock");
  });

  it("should return empty array when no matches", () => {
    const results = filterBlockTypes("xyznonexistent");
    expect(results).toHaveLength(0);
  });

  it("should be case-insensitive", () => {
    const lower = filterBlockTypes("paragraph");
    const upper = filterBlockTypes("PARAGRAPH");
    const mixed = filterBlockTypes("ParaGraph");
    expect(lower).toEqual(upper);
    expect(upper).toEqual(mixed);
  });

  it("should match 'todo' keyword for To-Do List", () => {
    const results = filterBlockTypes("todo");
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("To-Do List");
  });

  it("should match 'code' for Code Block", () => {
    const results = filterBlockTypes("code");
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("Code Block");
  });

  it("should match 'list' for multiple list types", () => {
    const results = filterBlockTypes("list");
    const names = results.map((r) => r.name);
    expect(names).toContain("Bulleted List");
    expect(names).toContain("Numbered List");
    expect(names).toContain("To-Do List");
  });
});
