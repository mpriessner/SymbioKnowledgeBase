import { describe, it, expect } from "vitest";
import {
  validateProperties,
  extractTitleFromProperties,
} from "@/lib/database/propertyValidators";
import type { Column, RowProperties } from "@/types/database";

const testColumns: Column[] = [
  { id: "col_title", name: "Title", type: "TITLE" },
  {
    id: "col_status",
    name: "Status",
    type: "SELECT",
    options: ["Todo", "Done"],
  },
  { id: "col_count", name: "Count", type: "NUMBER" },
  {
    id: "col_tags",
    name: "Tags",
    type: "MULTI_SELECT",
    options: ["A", "B", "C"],
  },
];

describe("validateProperties", () => {
  it("should accept valid properties", () => {
    const props: RowProperties = {
      col_title: { type: "TITLE", value: "Task 1" },
      col_status: { type: "SELECT", value: "Todo" },
      col_count: { type: "NUMBER", value: 5 },
    };
    const result = validateProperties(props, testColumns);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should reject unknown column IDs", () => {
    const props: RowProperties = {
      col_title: { type: "TITLE", value: "Task" },
      unknown_col: { type: "TEXT", value: "bad" },
    };
    const result = validateProperties(props, testColumns);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("Unknown column");
  });

  it("should reject type mismatches", () => {
    const props: RowProperties = {
      col_title: { type: "TITLE", value: "Task" },
      col_count: { type: "TEXT", value: "not a number" },
    };
    const result = validateProperties(props, testColumns);
    expect(result.valid).toBe(false);
  });

  it("should reject invalid SELECT options", () => {
    const props: RowProperties = {
      col_title: { type: "TITLE", value: "Task" },
      col_status: { type: "SELECT", value: "Invalid" },
    };
    const result = validateProperties(props, testColumns);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("not a valid option");
  });

  it("should reject invalid MULTI_SELECT options", () => {
    const props: RowProperties = {
      col_title: { type: "TITLE", value: "Task" },
      col_tags: { type: "MULTI_SELECT", value: ["A", "Z"] },
    };
    const result = validateProperties(props, testColumns);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("invalid options");
  });

  it("should require TITLE property", () => {
    const props: RowProperties = {
      col_status: { type: "SELECT", value: "Todo" },
    };
    const result = validateProperties(props, testColumns);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("TITLE property is required");
  });

  it("should accept valid MULTI_SELECT values", () => {
    const props: RowProperties = {
      col_title: { type: "TITLE", value: "Task" },
      col_tags: { type: "MULTI_SELECT", value: ["A", "B"] },
    };
    const result = validateProperties(props, testColumns);
    expect(result.valid).toBe(true);
  });
});

describe("extractTitleFromProperties", () => {
  it("should extract title from TITLE column", () => {
    const props: RowProperties = {
      col_title: { type: "TITLE", value: "My Task" },
    };
    expect(extractTitleFromProperties(props, testColumns)).toBe("My Task");
  });

  it('should return "Untitled" when TITLE property is missing', () => {
    expect(extractTitleFromProperties({}, testColumns)).toBe("Untitled");
  });

  it('should return "Untitled" when TITLE value is empty string', () => {
    const props: RowProperties = {
      col_title: { type: "TITLE", value: "" },
    };
    expect(extractTitleFromProperties(props, testColumns)).toBe("Untitled");
  });

  it('should return "Untitled" when no TITLE column exists in schema', () => {
    const columns: Column[] = [
      { id: "col_text", name: "Text", type: "TEXT" },
    ];
    expect(extractTitleFromProperties({}, columns)).toBe("Untitled");
  });
});
