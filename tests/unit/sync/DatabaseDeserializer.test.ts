import { describe, it, expect } from "vitest";
import {
  markdownToDatabase,
  type ParsedDatabase,
} from "../../../src/lib/sync/DatabaseDeserializer";

function makeMarkdown(
  frontmatterFields: Record<string, unknown>,
  columns: Record<string, unknown>[],
  tableRows?: string[]
): string {
  const fm: Record<string, unknown> = {
    id: "db-001",
    type: "database",
    title: "Test DB",
    page_id: "page-001",
    icon: null,
    default_view: "table",
    columns,
    ...frontmatterFields,
  };

  // Build YAML by hand for test clarity
  let yaml = "";
  for (const [key, value] of Object.entries(fm)) {
    if (key === "columns") continue;
    if (value === null) {
      yaml += `${key}: null\n`;
    } else if (typeof value === "string") {
      yaml += `${key}: ${value}\n`;
    } else {
      yaml += `${key}: ${value}\n`;
    }
  }
  yaml += "columns:\n";
  for (const col of columns) {
    yaml += `  - id: ${col.id}\n`;
    yaml += `    name: ${col.name}\n`;
    yaml += `    type: ${col.type}\n`;
    if (col.options) {
      yaml += `    options:\n`;
      for (const opt of col.options as string[]) {
        yaml += `      - ${opt}\n`;
      }
    }
  }

  let md = `---\n${yaml}---\n\n`;

  if (tableRows) {
    md += tableRows.join("\n") + "\n";
  }

  return md;
}

const TITLE_COL = { id: "col-title", name: "Title", type: "TITLE" };

describe("markdownToDatabase", () => {
  describe("frontmatter parsing", () => {
    it("extracts metadata from YAML frontmatter", () => {
      const md = makeMarkdown({ title: "My DB", icon: "📋" }, [TITLE_COL]);
      const result = markdownToDatabase(md);

      expect(result.metadata.id).toBe("db-001");
      expect(result.metadata.title).toBe("My DB");
      expect(result.metadata.icon).toBe("📋");
      expect(result.metadata.pageId).toBe("page-001");
      expect(result.metadata.defaultView).toBe("table");
    });

    it("missing id indicates new database (not an error)", () => {
      const md = makeMarkdown({}, [TITLE_COL]).replace("id: db-001\n", "");
      const result = markdownToDatabase(md);

      expect(result.metadata.id).toBeUndefined();
      expect(result.errors.filter((e) => e.type === "error")).toHaveLength(0);
    });

    it("returns error for missing frontmatter", () => {
      const result = markdownToDatabase("# No frontmatter here");
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain("Missing YAML frontmatter");
    });

    it("returns error for invalid YAML", () => {
      const result = markdownToDatabase("---\n: : bad yaml [\n---\n\n");
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain("Invalid YAML");
    });
  });

  describe("column parsing", () => {
    it("parses column definitions with options", () => {
      const cols = [
        TITLE_COL,
        {
          id: "col-status",
          name: "Status",
          type: "SELECT",
          options: ["Todo", "Done"],
        },
      ];
      const md = makeMarkdown({}, cols);
      const result = markdownToDatabase(md);

      expect(result.columns).toHaveLength(2);
      expect(result.columns[1].type).toBe("SELECT");
      expect(result.columns[1].options).toEqual(["Todo", "Done"]);
    });

    it("returns error for no columns", () => {
      const md = "---\ntitle: Test\ncolumns: []\n---\n\n";
      const result = markdownToDatabase(md);
      expect(result.errors[0].message).toContain("at least one column");
    });

    it("returns error for missing TITLE column", () => {
      const md = makeMarkdown({}, [
        { id: "col-text", name: "Notes", type: "TEXT" },
      ]);
      const result = markdownToDatabase(md);
      expect(result.errors.some((e) => e.message.includes("TITLE"))).toBe(
        true
      );
    });

    it("returns error for invalid column type", () => {
      const md = makeMarkdown({}, [
        TITLE_COL,
        { id: "col-bad", name: "Bad", type: "INVALID_TYPE" },
      ]);
      const result = markdownToDatabase(md);
      expect(
        result.errors.some((e) => e.message.includes("Invalid column type"))
      ).toBe(true);
    });
  });

  describe("property type deserialization", () => {
    it("deserializes TITLE type", () => {
      const md = makeMarkdown({}, [TITLE_COL], [
        "| Title |",
        "| --- |",
        "| Build feature |",
      ]);
      const result = markdownToDatabase(md);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].properties["col-title"]).toEqual({
        type: "TITLE",
        value: "Build feature",
      });
    });

    it("deserializes TEXT type", () => {
      const cols = [
        TITLE_COL,
        { id: "col-text", name: "Notes", type: "TEXT" },
      ];
      const md = makeMarkdown({}, cols, [
        "| Title | Notes |",
        "| --- | --- |",
        "| Item | Some text here |",
      ]);
      const result = markdownToDatabase(md);

      expect(result.rows[0].properties["col-text"]).toEqual({
        type: "TEXT",
        value: "Some text here",
      });
    });

    it("deserializes NUMBER type", () => {
      const cols = [
        TITLE_COL,
        { id: "col-num", name: "Count", type: "NUMBER" },
      ];
      const md = makeMarkdown({}, cols, [
        "| Title | Count |",
        "| --- | --- |",
        "| Item | 42.5 |",
      ]);
      const result = markdownToDatabase(md);

      expect(result.rows[0].properties["col-num"]).toEqual({
        type: "NUMBER",
        value: 42.5,
      });
    });

    it("deserializes SELECT type", () => {
      const cols = [
        TITLE_COL,
        {
          id: "col-status",
          name: "Status",
          type: "SELECT",
          options: ["Todo", "Done"],
        },
      ];
      const md = makeMarkdown({}, cols, [
        "| Title | Status |",
        "| --- | --- |",
        "| Item | Done |",
      ]);
      const result = markdownToDatabase(md);

      expect(result.rows[0].properties["col-status"]).toEqual({
        type: "SELECT",
        value: "Done",
      });
    });

    it("deserializes MULTI_SELECT type", () => {
      const cols = [
        TITLE_COL,
        {
          id: "col-tags",
          name: "Tags",
          type: "MULTI_SELECT",
          options: ["frontend", "backend", "design"],
        },
      ];
      const md = makeMarkdown({}, cols, [
        "| Title | Tags |",
        "| --- | --- |",
        "| Item | frontend, backend |",
      ]);
      const result = markdownToDatabase(md);

      expect(result.rows[0].properties["col-tags"]).toEqual({
        type: "MULTI_SELECT",
        value: ["frontend", "backend"],
      });
    });

    it("deserializes DATE type", () => {
      const cols = [
        TITLE_COL,
        { id: "col-date", name: "Due", type: "DATE" },
      ];
      const md = makeMarkdown({}, cols, [
        "| Title | Due |",
        "| --- | --- |",
        "| Item | 2026-03-30 |",
      ]);
      const result = markdownToDatabase(md);

      expect(result.rows[0].properties["col-date"]).toEqual({
        type: "DATE",
        value: "2026-03-30",
      });
    });

    it("deserializes CHECKBOX type", () => {
      const cols = [
        TITLE_COL,
        { id: "col-done", name: "Done", type: "CHECKBOX" },
      ];
      const md = makeMarkdown({}, cols, [
        "| Title | Done |",
        "| --- | --- |",
        "| Item A | true |",
        "| Item B | false |",
        "| Item C | True |",
      ]);
      const result = markdownToDatabase(md);

      expect(result.rows[0].properties["col-done"]).toEqual({
        type: "CHECKBOX",
        value: true,
      });
      expect(result.rows[1].properties["col-done"]).toEqual({
        type: "CHECKBOX",
        value: false,
      });
      expect(result.rows[2].properties["col-done"]).toEqual({
        type: "CHECKBOX",
        value: true,
      });
    });

    it("deserializes URL type", () => {
      const cols = [
        TITLE_COL,
        { id: "col-url", name: "Link", type: "URL" },
      ];
      const md = makeMarkdown({}, cols, [
        "| Title | Link |",
        "| --- | --- |",
        "| Item | https://example.com |",
      ]);
      const result = markdownToDatabase(md);

      expect(result.rows[0].properties["col-url"]).toEqual({
        type: "URL",
        value: "https://example.com",
      });
    });
  });

  describe("null handling", () => {
    it("parses em-dash as null (skips property)", () => {
      const cols = [
        TITLE_COL,
        { id: "col-text", name: "Notes", type: "TEXT" },
      ];
      const md = makeMarkdown({}, cols, [
        "| Title | Notes |",
        "| --- | --- |",
        "| Item | \u2014 |",
      ]);
      const result = markdownToDatabase(md);

      expect(result.rows[0].properties["col-text"]).toBeUndefined();
    });

    it("parses empty cell as null (skips property)", () => {
      const cols = [
        TITLE_COL,
        { id: "col-text", name: "Notes", type: "TEXT" },
      ];
      const md = makeMarkdown({}, cols, [
        "| Title | Notes |",
        "| --- | --- |",
        "| Item |  |",
      ]);
      const result = markdownToDatabase(md);

      expect(result.rows[0].properties["col-text"]).toBeUndefined();
    });
  });

  describe("escaped pipes", () => {
    it("handles escaped pipes in cell values", () => {
      const cols = [
        TITLE_COL,
        { id: "col-text", name: "Notes", type: "TEXT" },
      ];
      const md = makeMarkdown({}, cols, [
        "| Title | Notes |",
        "| --- | --- |",
        "| Item | value with \\| pipe |",
      ]);
      const result = markdownToDatabase(md);

      expect(result.rows[0].properties["col-text"]).toEqual({
        type: "TEXT",
        value: "value with | pipe",
      });
    });
  });

  describe("validation errors", () => {
    it("reports error for invalid SELECT value", () => {
      const cols = [
        TITLE_COL,
        {
          id: "col-status",
          name: "Status",
          type: "SELECT",
          options: ["Todo", "Done"],
        },
      ];
      const md = makeMarkdown({}, cols, [
        "| Title | Status |",
        "| --- | --- |",
        "| Item | Invalid |",
      ]);
      const result = markdownToDatabase(md);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe("error");
      expect(result.errors[0].row).toBe(1);
      expect(result.errors[0].column).toBe("Status");
      expect(result.errors[0].message).toContain("not a valid option");
    });

    it("reports error for invalid MULTI_SELECT values", () => {
      const cols = [
        TITLE_COL,
        {
          id: "col-tags",
          name: "Tags",
          type: "MULTI_SELECT",
          options: ["frontend", "backend"],
        },
      ];
      const md = makeMarkdown({}, cols, [
        "| Title | Tags |",
        "| --- | --- |",
        "| Item | frontend, nope |",
      ]);
      const result = markdownToDatabase(md);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain("nope");
    });

    it("reports error for invalid NUMBER", () => {
      const cols = [
        TITLE_COL,
        { id: "col-num", name: "Count", type: "NUMBER" },
      ];
      const md = makeMarkdown({}, cols, [
        "| Title | Count |",
        "| --- | --- |",
        "| Item | abc |",
      ]);
      const result = markdownToDatabase(md);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain("Invalid number");
    });

    it("reports error for invalid CHECKBOX value", () => {
      const cols = [
        TITLE_COL,
        { id: "col-done", name: "Done", type: "CHECKBOX" },
      ];
      const md = makeMarkdown({}, cols, [
        "| Title | Done |",
        "| --- | --- |",
        "| Item | yes |",
      ]);
      const result = markdownToDatabase(md);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain("Invalid checkbox");
    });

    it("reports error for invalid DATE", () => {
      const cols = [
        TITLE_COL,
        { id: "col-date", name: "Due", type: "DATE" },
      ];
      const md = makeMarkdown({}, cols, [
        "| Title | Due |",
        "| --- | --- |",
        "| Item | not-a-date |",
      ]);
      const result = markdownToDatabase(md);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain("Invalid date");
    });

    it("reports error for invalid URL", () => {
      const cols = [
        TITLE_COL,
        { id: "col-url", name: "Link", type: "URL" },
      ];
      const md = makeMarkdown({}, cols, [
        "| Title | Link |",
        "| --- | --- |",
        "| Item | not a url |",
      ]);
      const result = markdownToDatabase(md);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain("Invalid URL");
    });

    it("warns for empty TITLE", () => {
      const md = makeMarkdown({}, [TITLE_COL], [
        "| Title |",
        "| --- |",
        "| \u2014 |",
      ]);
      const result = markdownToDatabase(md);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe("warning");
      expect(result.errors[0].message).toContain("TITLE is empty");
    });

    it("does not abort valid rows when another row has errors", () => {
      const cols = [
        TITLE_COL,
        { id: "col-num", name: "Count", type: "NUMBER" },
      ];
      const md = makeMarkdown({}, cols, [
        "| Title | Count |",
        "| --- | --- |",
        "| Good | 42 |",
        "| Bad | abc |",
        "| Also Good | 7 |",
      ]);
      const result = markdownToDatabase(md);

      expect(result.rows).toHaveLength(3);
      expect(result.rows[0].properties["col-num"]).toEqual({
        type: "NUMBER",
        value: 42,
      });
      expect(result.rows[2].properties["col-num"]).toEqual({
        type: "NUMBER",
        value: 7,
      });
      expect(result.errors).toHaveLength(1);
    });
  });

  describe("malformed tables", () => {
    it("handles extra columns in header not in schema", () => {
      const md = makeMarkdown({}, [TITLE_COL], [
        "| Title | Extra |",
        "| --- | --- |",
        "| Item | value |",
      ]);
      const result = markdownToDatabase(md);

      expect(
        result.errors.some((e) => e.message.includes("Extra"))
      ).toBe(true);
    });

    it("warns for columns in schema missing from table headers", () => {
      const cols = [
        TITLE_COL,
        { id: "col-text", name: "Notes", type: "TEXT" },
      ];
      const md = makeMarkdown({}, cols, [
        "| Title |",
        "| --- |",
        "| Item |",
      ]);
      const result = markdownToDatabase(md);

      expect(
        result.errors.some(
          (e) => e.type === "warning" && e.message.includes("Notes")
        )
      ).toBe(true);
    });

    it("handles rows with fewer cells than headers", () => {
      const cols = [
        TITLE_COL,
        { id: "col-text", name: "Notes", type: "TEXT" },
      ];
      const md = makeMarkdown({}, cols, [
        "| Title | Notes |",
        "| --- | --- |",
        "| Item |",
      ]);
      const result = markdownToDatabase(md);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].properties["col-text"]).toBeUndefined();
    });

    it("handles empty table body", () => {
      const md = makeMarkdown({}, [TITLE_COL]);
      const result = markdownToDatabase(md);

      expect(result.rows).toHaveLength(0);
      expect(result.errors.filter((e) => e.type === "error")).toHaveLength(0);
    });
  });

  describe("round-trip with serializer output", () => {
    it("parses full serializer output correctly", () => {
      const md = `---
id: db-001
type: database
title: Tasks
page_id: page-001
icon: null
default_view: table
columns:
  - id: col-title
    name: Title
    type: TITLE
  - id: col-status
    name: Status
    type: SELECT
    options:
      - Todo
      - In Progress
      - Done
  - id: col-num
    name: Points
    type: NUMBER
  - id: col-done
    name: Complete
    type: CHECKBOX
created: 2026-03-01T10:00:00.000Z
updated: 2026-03-23T14:30:00.000Z
---

| Title | Status | Points | Complete |
| ----- | ------ | ------ | -------- |
| Task A | In Progress | 5 | false |
| Task B | Done | 3 | true |
| Task C | Todo | \u2014 | false |
`;
      const result = markdownToDatabase(md);

      expect(result.errors.filter((e) => e.type === "error")).toHaveLength(0);
      expect(result.metadata.title).toBe("Tasks");
      expect(result.columns).toHaveLength(4);
      expect(result.rows).toHaveLength(3);

      expect(result.rows[0].properties["col-title"]).toEqual({
        type: "TITLE",
        value: "Task A",
      });
      expect(result.rows[0].properties["col-status"]).toEqual({
        type: "SELECT",
        value: "In Progress",
      });
      expect(result.rows[0].properties["col-num"]).toEqual({
        type: "NUMBER",
        value: 5,
      });
      expect(result.rows[0].properties["col-done"]).toEqual({
        type: "CHECKBOX",
        value: false,
      });

      // Task C has em-dash for Points — should be skipped
      expect(result.rows[2].properties["col-num"]).toBeUndefined();
    });
  });
});
