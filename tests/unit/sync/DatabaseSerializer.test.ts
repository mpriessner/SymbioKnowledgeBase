import { describe, it, expect } from "vitest";
import {
  databaseToMarkdown,
  type DatabaseSerializeInput,
  type DatabaseRowInput,
} from "../../../src/lib/sync/DatabaseSerializer";
import type { Column } from "../../../src/types/database";

const BASE_DATE = new Date("2026-03-01T10:00:00.000Z");
const UPDATED_DATE = new Date("2026-03-23T14:30:00.000Z");

function makeDatabase(
  columns: Column[],
  overrides: Partial<DatabaseSerializeInput> = {}
): DatabaseSerializeInput {
  return {
    id: "db-001",
    title: "Test DB",
    icon: null,
    pageId: "page-001",
    defaultView: "table",
    columns,
    createdAt: BASE_DATE,
    updatedAt: UPDATED_DATE,
    ...overrides,
  };
}

describe("databaseToMarkdown", () => {
  describe("frontmatter", () => {
    it("generates correct YAML frontmatter with metadata", () => {
      const db = makeDatabase(
        [{ id: "col-title", name: "Title", type: "TITLE" }],
        { icon: "\u2705", title: "Tasks" }
      );
      const md = databaseToMarkdown(db, []);

      expect(md).toContain("---\n");
      expect(md).toContain("id: db-001");
      expect(md).toContain("type: database");
      expect(md).toContain("title: Tasks");
      expect(md).toContain("page_id: page-001");
      expect(md).toContain("default_view: table");
      expect(md).toContain("created: 2026-03-01T10:00:00.000Z");
      expect(md).toContain("updated: 2026-03-23T14:30:00.000Z");
    });

    it("includes column definitions with options for SELECT columns", () => {
      const db = makeDatabase([
        { id: "col-title", name: "Title", type: "TITLE" },
        {
          id: "col-status",
          name: "Status",
          type: "SELECT",
          options: ["Not Started", "In Progress", "Done"],
        },
      ]);
      const md = databaseToMarkdown(db, []);

      expect(md).toContain("name: Status");
      expect(md).toContain("type: SELECT");
      expect(md).toContain("- Not Started");
      expect(md).toContain("- In Progress");
      expect(md).toContain("- Done");
    });

    it("includes options for MULTI_SELECT columns", () => {
      const db = makeDatabase([
        { id: "col-title", name: "Title", type: "TITLE" },
        {
          id: "col-tags",
          name: "Tags",
          type: "MULTI_SELECT",
          options: ["frontend", "backend"],
        },
      ]);
      const md = databaseToMarkdown(db, []);

      expect(md).toContain("type: MULTI_SELECT");
      expect(md).toContain("- frontend");
      expect(md).toContain("- backend");
    });

    it("omits options key for columns without options", () => {
      const db = makeDatabase([
        { id: "col-title", name: "Title", type: "TITLE" },
        { id: "col-num", name: "Count", type: "NUMBER" },
      ]);
      const md = databaseToMarkdown(db, []);
      const frontmatter = md.split("---")[1];
      const countSection = frontmatter.split("name: Count")[1].split("created:")[0];
      expect(countSection).not.toContain("options");
    });
  });

  describe("property type serialization", () => {
    const columns: Column[] = [
      { id: "col-title", name: "Title", type: "TITLE" },
      { id: "col-text", name: "Notes", type: "TEXT" },
      { id: "col-num", name: "Count", type: "NUMBER" },
      {
        id: "col-sel",
        name: "Status",
        type: "SELECT",
        options: ["Active", "Done"],
      },
      {
        id: "col-multi",
        name: "Tags",
        type: "MULTI_SELECT",
        options: ["a", "b", "c"],
      },
      { id: "col-date", name: "Due", type: "DATE" },
      { id: "col-check", name: "Done", type: "CHECKBOX" },
      { id: "col-url", name: "Link", type: "URL" },
    ];

    const row: DatabaseRowInput = {
      id: "row-1",
      createdAt: BASE_DATE,
      properties: {
        "col-title": { type: "TITLE", value: "Build feature" },
        "col-text": { type: "TEXT", value: "Some notes" },
        "col-num": { type: "NUMBER", value: 42.5 },
        "col-sel": { type: "SELECT", value: "Active" },
        "col-multi": { type: "MULTI_SELECT", value: ["frontend", "backend"] },
        "col-date": { type: "DATE", value: "2026-03-30" },
        "col-check": { type: "CHECKBOX", value: true },
        "col-url": { type: "URL", value: "https://example.com" },
      },
    };

    it("serializes TITLE type", () => {
      const md = databaseToMarkdown(makeDatabase(columns), [row]);
      expect(md).toContain("Build feature");
    });

    it("serializes TEXT type", () => {
      const md = databaseToMarkdown(makeDatabase(columns), [row]);
      expect(md).toContain("Some notes");
    });

    it("serializes NUMBER type", () => {
      const md = databaseToMarkdown(makeDatabase(columns), [row]);
      expect(md).toContain("42.5");
    });

    it("serializes SELECT type", () => {
      const md = databaseToMarkdown(makeDatabase(columns), [row]);
      expect(md).toContain("Active");
    });

    it("serializes MULTI_SELECT as comma-space separated", () => {
      const md = databaseToMarkdown(makeDatabase(columns), [row]);
      expect(md).toContain("frontend, backend");
    });

    it("serializes DATE type as ISO date string", () => {
      const md = databaseToMarkdown(makeDatabase(columns), [row]);
      expect(md).toContain("2026-03-30");
    });

    it("serializes CHECKBOX true", () => {
      const md = databaseToMarkdown(makeDatabase(columns), [row]);
      const tableLines = md.split("\n").filter((l) => l.startsWith("|"));
      const dataRow = tableLines[2];
      expect(dataRow).toContain("true");
    });

    it("serializes CHECKBOX false", () => {
      const falseRow: DatabaseRowInput = {
        id: "row-2",
        createdAt: BASE_DATE,
        properties: {
          "col-title": { type: "TITLE", value: "Other" },
          "col-check": { type: "CHECKBOX", value: false },
        },
      };
      const md = databaseToMarkdown(
        makeDatabase([
          { id: "col-title", name: "Title", type: "TITLE" },
          { id: "col-check", name: "Done", type: "CHECKBOX" },
        ]),
        [falseRow]
      );
      const tableLines = md.split("\n").filter((l) => l.startsWith("|"));
      const dataRow = tableLines[2];
      expect(dataRow).toContain("false");
    });

    it("serializes URL type", () => {
      const md = databaseToMarkdown(makeDatabase(columns), [row]);
      expect(md).toContain("https://example.com");
    });
  });

  describe("null and undefined values", () => {
    it("renders null/missing properties as em-dash", () => {
      const columns: Column[] = [
        { id: "col-title", name: "Title", type: "TITLE" },
        { id: "col-text", name: "Notes", type: "TEXT" },
      ];
      const row: DatabaseRowInput = {
        id: "row-1",
        createdAt: BASE_DATE,
        properties: {
          "col-title": { type: "TITLE", value: "Test" },
        },
      };
      const md = databaseToMarkdown(makeDatabase(columns), [row]);
      const tableLines = md.split("\n").filter((l) => l.startsWith("|"));
      const dataRow = tableLines[2];
      expect(dataRow).toContain("\u2014");
    });
  });

  describe("empty database", () => {
    it("produces headers-only table when no rows", () => {
      const columns: Column[] = [
        { id: "col-title", name: "Title", type: "TITLE" },
        { id: "col-num", name: "Count", type: "NUMBER" },
      ];
      const md = databaseToMarkdown(makeDatabase(columns), []);
      const tableLines = md.split("\n").filter((l) => l.startsWith("|"));
      expect(tableLines).toHaveLength(2); // header + separator
      expect(tableLines[0]).toBe("| Title | Count |");
      expect(tableLines[1]).toBe("| ----- | ----- |");
    });
  });

  describe("special characters", () => {
    it("escapes pipe characters in cell values", () => {
      const columns: Column[] = [
        { id: "col-title", name: "Title", type: "TITLE" },
      ];
      const row: DatabaseRowInput = {
        id: "row-1",
        createdAt: BASE_DATE,
        properties: {
          "col-title": { type: "TITLE", value: "A | B" },
        },
      };
      const md = databaseToMarkdown(makeDatabase(columns), [row]);
      const tableLines = md.split("\n").filter((l) => l.startsWith("|"));
      expect(tableLines[2]).toContain("A \\| B");
    });

    it("replaces newlines with spaces in text values", () => {
      const columns: Column[] = [
        { id: "col-title", name: "Title", type: "TITLE" },
        { id: "col-text", name: "Notes", type: "TEXT" },
      ];
      const row: DatabaseRowInput = {
        id: "row-1",
        createdAt: BASE_DATE,
        properties: {
          "col-title": { type: "TITLE", value: "Test" },
          "col-text": { type: "TEXT", value: "Line1\nLine2\nLine3" },
        },
      };
      const md = databaseToMarkdown(makeDatabase(columns), [row]);
      const tableLines = md.split("\n").filter((l) => l.startsWith("|"));
      expect(tableLines[2]).toContain("Line1 Line2 Line3");
    });
  });

  describe("column ordering", () => {
    it("puts TITLE column first regardless of schema position", () => {
      const columns: Column[] = [
        { id: "col-num", name: "Count", type: "NUMBER" },
        { id: "col-title", name: "Title", type: "TITLE" },
        { id: "col-text", name: "Notes", type: "TEXT" },
      ];
      const md = databaseToMarkdown(makeDatabase(columns), []);
      const tableLines = md.split("\n").filter((l) => l.startsWith("|"));
      const headers = tableLines[0];
      const colNames = headers
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean);
      expect(colNames[0]).toBe("Title");
    });
  });

  describe("row ordering", () => {
    it("orders rows by createdAt ASC", () => {
      const columns: Column[] = [
        { id: "col-title", name: "Title", type: "TITLE" },
      ];
      const rows: DatabaseRowInput[] = [
        {
          id: "row-2",
          createdAt: new Date("2026-03-03T00:00:00Z"),
          properties: { "col-title": { type: "TITLE", value: "Second" } },
        },
        {
          id: "row-1",
          createdAt: new Date("2026-03-01T00:00:00Z"),
          properties: { "col-title": { type: "TITLE", value: "First" } },
        },
        {
          id: "row-3",
          createdAt: new Date("2026-03-05T00:00:00Z"),
          properties: { "col-title": { type: "TITLE", value: "Third" } },
        },
      ];
      const md = databaseToMarkdown(makeDatabase(columns), rows);
      const tableLines = md.split("\n").filter((l) => l.startsWith("|"));
      expect(tableLines[2]).toContain("First");
      expect(tableLines[3]).toContain("Second");
      expect(tableLines[4]).toContain("Third");
    });
  });

  describe("deterministic output", () => {
    it("produces identical output for identical input", () => {
      const columns: Column[] = [
        { id: "col-title", name: "Title", type: "TITLE" },
        {
          id: "col-sel",
          name: "Status",
          type: "SELECT",
          options: ["A", "B"],
        },
      ];
      const rows: DatabaseRowInput[] = [
        {
          id: "row-1",
          createdAt: BASE_DATE,
          properties: {
            "col-title": { type: "TITLE", value: "Task 1" },
            "col-sel": { type: "SELECT", value: "A" },
          },
        },
      ];
      const db = makeDatabase(columns);
      const result1 = databaseToMarkdown(db, rows);
      const result2 = databaseToMarkdown(db, rows);
      expect(result1).toBe(result2);
    });
  });
});
