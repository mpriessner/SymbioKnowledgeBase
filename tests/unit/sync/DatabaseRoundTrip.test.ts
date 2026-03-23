import { describe, it, expect } from "vitest";
import {
  databaseToMarkdown,
  type DatabaseSerializeInput,
  type DatabaseRowInput,
} from "../../../src/lib/sync/DatabaseSerializer";
import { markdownToDatabase } from "../../../src/lib/sync/DatabaseDeserializer";
import type { Column, PropertyValue } from "../../../src/types/database";

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

function makeRow(
  id: string,
  properties: Record<string, PropertyValue>,
  createdAt?: Date
): DatabaseRowInput {
  return {
    id,
    properties,
    createdAt: createdAt ?? BASE_DATE,
  };
}

function roundTrip(
  database: DatabaseSerializeInput,
  rows: DatabaseRowInput[]
) {
  const markdown = databaseToMarkdown(database, rows);
  const parsed = markdownToDatabase(markdown);
  return parsed;
}

function expectNoErrors(parsed: ReturnType<typeof markdownToDatabase>) {
  const errors = parsed.errors.filter((e) => e.type === "error");
  expect(errors).toStrictEqual([]);
}

function expectRowPropertiesMatch(
  originalRows: DatabaseRowInput[],
  parsedRows: ReturnType<typeof markdownToDatabase>["rows"],
  columns: Column[]
) {
  expect(parsedRows.length).toBe(originalRows.length);

  // Rows are sorted by createdAt in the serializer
  const sorted = [...originalRows].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );

  for (let i = 0; i < sorted.length; i++) {
    const origProps = sorted[i].properties;
    const parsedProps = parsedRows[i].properties;

    for (const col of columns) {
      const origVal = origProps[col.id];
      const parsedVal = parsedProps[col.id];

      if (origVal == null) {
        // Null values should not appear in parsed output
        expect(parsedVal).toBeUndefined();
      } else {
        expect(parsedVal).toStrictEqual(origVal);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Per-Type Round-Trip Tests
// ---------------------------------------------------------------------------

describe("DatabaseRoundTrip", () => {
  describe("Per-type round-trips", () => {
    it("1. TITLE round-trips correctly", () => {
      const columns: Column[] = [
        { id: "col-title", name: "Title", type: "TITLE" },
      ];
      const db = makeDatabase(columns);
      const rows = [
        makeRow("r1", {
          "col-title": { type: "TITLE", value: "Project Alpha" },
        }),
      ];

      const parsed = roundTrip(db, rows);
      expectNoErrors(parsed);
      expectRowPropertiesMatch(rows, parsed.rows, columns);
    });

    it("2. TEXT round-trips with special chars", () => {
      const columns: Column[] = [
        { id: "col-title", name: "Title", type: "TITLE" },
        { id: "col-text", name: "Description", type: "TEXT" },
      ];
      const db = makeDatabase(columns);
      const rows = [
        makeRow("r1", {
          "col-title": { type: "TITLE", value: "Row1" },
          "col-text": { type: "TEXT", value: 'Line one with special chars: <>&"' },
        }),
      ];

      const parsed = roundTrip(db, rows);
      expectNoErrors(parsed);
      expectRowPropertiesMatch(rows, parsed.rows, columns);
    });

    it("3. NUMBER round-trips various values", () => {
      const columns: Column[] = [
        { id: "col-title", name: "Title", type: "TITLE" },
        { id: "col-num", name: "Value", type: "NUMBER" },
      ];
      const db = makeDatabase(columns);
      const testValues = [42, 0, -3.14, 1000000];

      for (const num of testValues) {
        const rows = [
          makeRow("r1", {
            "col-title": { type: "TITLE", value: `Num ${num}` },
            "col-num": { type: "NUMBER", value: num },
          }),
        ];
        const parsed = roundTrip(db, rows);
        expectNoErrors(parsed);
        expectRowPropertiesMatch(rows, parsed.rows, columns);
      }
    });

    it("4. SELECT round-trips correctly", () => {
      const columns: Column[] = [
        { id: "col-title", name: "Title", type: "TITLE" },
        {
          id: "col-status",
          name: "Status",
          type: "SELECT",
          options: ["Not Started", "In Progress", "Done"],
        },
      ];
      const db = makeDatabase(columns);
      const rows = [
        makeRow("r1", {
          "col-title": { type: "TITLE", value: "Task 1" },
          "col-status": { type: "SELECT", value: "In Progress" },
        }),
      ];

      const parsed = roundTrip(db, rows);
      expectNoErrors(parsed);
      expectRowPropertiesMatch(rows, parsed.rows, columns);
    });

    it("5. MULTI_SELECT round-trips multiple values", () => {
      const columns: Column[] = [
        { id: "col-title", name: "Title", type: "TITLE" },
        {
          id: "col-tags",
          name: "Tags",
          type: "MULTI_SELECT",
          options: ["frontend", "backend", "design"],
        },
      ];
      const db = makeDatabase(columns);
      const rows = [
        makeRow("r1", {
          "col-title": { type: "TITLE", value: "Feature" },
          "col-tags": { type: "MULTI_SELECT", value: ["frontend", "backend"] },
        }),
      ];

      const parsed = roundTrip(db, rows);
      expectNoErrors(parsed);
      expectRowPropertiesMatch(rows, parsed.rows, columns);
    });

    it("6. MULTI_SELECT round-trips single value as array", () => {
      const columns: Column[] = [
        { id: "col-title", name: "Title", type: "TITLE" },
        {
          id: "col-tags",
          name: "Tags",
          type: "MULTI_SELECT",
          options: ["frontend", "backend"],
        },
      ];
      const db = makeDatabase(columns);
      const rows = [
        makeRow("r1", {
          "col-title": { type: "TITLE", value: "Feature" },
          "col-tags": { type: "MULTI_SELECT", value: ["frontend"] },
        }),
      ];

      const parsed = roundTrip(db, rows);
      expectNoErrors(parsed);
      expect(parsed.rows[0].properties["col-tags"]).toStrictEqual({
        type: "MULTI_SELECT",
        value: ["frontend"],
      });
    });

    it("7. DATE round-trips correctly", () => {
      const columns: Column[] = [
        { id: "col-title", name: "Title", type: "TITLE" },
        { id: "col-date", name: "Due", type: "DATE" },
      ];
      const db = makeDatabase(columns);
      const rows = [
        makeRow("r1", {
          "col-title": { type: "TITLE", value: "Task" },
          "col-date": { type: "DATE", value: "2026-03-30" },
        }),
      ];

      const parsed = roundTrip(db, rows);
      expectNoErrors(parsed);
      expectRowPropertiesMatch(rows, parsed.rows, columns);
    });

    it("8. CHECKBOX round-trips true and false", () => {
      const columns: Column[] = [
        { id: "col-title", name: "Title", type: "TITLE" },
        { id: "col-done", name: "Done", type: "CHECKBOX" },
      ];
      const db = makeDatabase(columns);
      const rows = [
        makeRow("r1", {
          "col-title": { type: "TITLE", value: "A" },
          "col-done": { type: "CHECKBOX", value: true },
        }),
        makeRow("r2", {
          "col-title": { type: "TITLE", value: "B" },
          "col-done": { type: "CHECKBOX", value: false },
        }),
      ];

      const parsed = roundTrip(db, rows);
      expectNoErrors(parsed);
      expectRowPropertiesMatch(rows, parsed.rows, columns);
    });

    it("9. URL round-trips with query params", () => {
      const columns: Column[] = [
        { id: "col-title", name: "Title", type: "TITLE" },
        { id: "col-url", name: "Link", type: "URL" },
      ];
      const db = makeDatabase(columns);
      const rows = [
        makeRow("r1", {
          "col-title": { type: "TITLE", value: "Site" },
          "col-url": {
            type: "URL",
            value: "https://example.com/path?q=1&r=2",
          },
        }),
      ];

      const parsed = roundTrip(db, rows);
      expectNoErrors(parsed);
      expectRowPropertiesMatch(rows, parsed.rows, columns);
    });
  });

  // ---------------------------------------------------------------------------
  // Combined Tests
  // ---------------------------------------------------------------------------

  describe("Combined tests", () => {
    const allTypesColumns: Column[] = [
      { id: "col-title", name: "Title", type: "TITLE" },
      { id: "col-text", name: "Description", type: "TEXT" },
      { id: "col-num", name: "Count", type: "NUMBER" },
      {
        id: "col-status",
        name: "Status",
        type: "SELECT",
        options: ["Open", "Closed"],
      },
      {
        id: "col-tags",
        name: "Tags",
        type: "MULTI_SELECT",
        options: ["alpha", "beta", "gamma"],
      },
      { id: "col-date", name: "Due", type: "DATE" },
      { id: "col-done", name: "Done", type: "CHECKBOX" },
      { id: "col-url", name: "Link", type: "URL" },
    ];

    it("10. All 8 types in one database, 5 rows", () => {
      const db = makeDatabase(allTypesColumns);
      const rows: DatabaseRowInput[] = [];

      for (let i = 0; i < 5; i++) {
        rows.push(
          makeRow(
            `r${i}`,
            {
              "col-title": { type: "TITLE", value: `Row ${i}` },
              "col-text": { type: "TEXT", value: `Text for row ${i}` },
              "col-num": { type: "NUMBER", value: i * 10 },
              "col-status": {
                type: "SELECT",
                value: i % 2 === 0 ? "Open" : "Closed",
              },
              "col-tags": {
                type: "MULTI_SELECT",
                value: i % 2 === 0 ? ["alpha", "beta"] : ["gamma"],
              },
              "col-date": { type: "DATE", value: `2026-04-0${i + 1}` },
              "col-done": { type: "CHECKBOX", value: i % 2 === 0 },
              "col-url": {
                type: "URL",
                value: `https://example.com/${i}`,
              },
            },
            new Date(BASE_DATE.getTime() + i * 1000)
          )
        );
      }

      const parsed = roundTrip(db, rows);
      expectNoErrors(parsed);
      expectRowPropertiesMatch(rows, parsed.rows, allTypesColumns);
    });

    it("11. Multiple SELECT columns with different options", () => {
      const columns: Column[] = [
        { id: "col-title", name: "Title", type: "TITLE" },
        {
          id: "col-priority",
          name: "Priority",
          type: "SELECT",
          options: ["Low", "Medium", "High"],
        },
        {
          id: "col-status",
          name: "Status",
          type: "SELECT",
          options: ["Open", "Closed", "Blocked"],
        },
      ];
      const db = makeDatabase(columns);
      const rows = [
        makeRow("r1", {
          "col-title": { type: "TITLE", value: "Task" },
          "col-priority": { type: "SELECT", value: "High" },
          "col-status": { type: "SELECT", value: "Open" },
        }),
      ];

      const parsed = roundTrip(db, rows);
      expectNoErrors(parsed);
      expectRowPropertiesMatch(rows, parsed.rows, columns);
    });

    it("12. Multiple MULTI_SELECT columns", () => {
      const columns: Column[] = [
        { id: "col-title", name: "Title", type: "TITLE" },
        {
          id: "col-labels",
          name: "Labels",
          type: "MULTI_SELECT",
          options: ["bug", "feature", "docs"],
        },
        {
          id: "col-envs",
          name: "Environments",
          type: "MULTI_SELECT",
          options: ["dev", "staging", "prod"],
        },
      ];
      const db = makeDatabase(columns);
      const rows = [
        makeRow("r1", {
          "col-title": { type: "TITLE", value: "Issue" },
          "col-labels": { type: "MULTI_SELECT", value: ["bug", "docs"] },
          "col-envs": { type: "MULTI_SELECT", value: ["staging", "prod"] },
        }),
      ];

      const parsed = roundTrip(db, rows);
      expectNoErrors(parsed);
      expectRowPropertiesMatch(rows, parsed.rows, columns);
    });
  });

  // ---------------------------------------------------------------------------
  // Edge Cases
  // ---------------------------------------------------------------------------

  describe("Edge cases", () => {
    const columns: Column[] = [
      { id: "col-title", name: "Title", type: "TITLE" },
      { id: "col-text", name: "Notes", type: "TEXT" },
      { id: "col-num", name: "Count", type: "NUMBER" },
      {
        id: "col-status",
        name: "Status",
        type: "SELECT",
        options: ["Open", "Closed"],
      },
    ];

    it("13. Empty database — zero rows, schema intact", () => {
      const db = makeDatabase(columns);
      const parsed = roundTrip(db, []);
      expectNoErrors(parsed);
      expect(parsed.rows).toStrictEqual([]);
      expect(parsed.columns.length).toBe(columns.length);
      for (let i = 0; i < columns.length; i++) {
        expect(parsed.columns[i].id).toBe(columns[i].id);
        expect(parsed.columns[i].name).toBe(columns[i].name);
        expect(parsed.columns[i].type).toBe(columns[i].type);
      }
    });

    it("14. Single row with all types", () => {
      const allCols: Column[] = [
        { id: "col-title", name: "Title", type: "TITLE" },
        { id: "col-text", name: "Notes", type: "TEXT" },
        { id: "col-num", name: "Value", type: "NUMBER" },
        {
          id: "col-sel",
          name: "Status",
          type: "SELECT",
          options: ["A", "B"],
        },
        {
          id: "col-msel",
          name: "Tags",
          type: "MULTI_SELECT",
          options: ["x", "y"],
        },
        { id: "col-date", name: "Date", type: "DATE" },
        { id: "col-cb", name: "Done", type: "CHECKBOX" },
        { id: "col-url", name: "Link", type: "URL" },
      ];
      const db = makeDatabase(allCols);
      const rows = [
        makeRow("r1", {
          "col-title": { type: "TITLE", value: "Only row" },
          "col-text": { type: "TEXT", value: "Some text" },
          "col-num": { type: "NUMBER", value: 99 },
          "col-sel": { type: "SELECT", value: "A" },
          "col-msel": { type: "MULTI_SELECT", value: ["x", "y"] },
          "col-date": { type: "DATE", value: "2026-01-01" },
          "col-cb": { type: "CHECKBOX", value: true },
          "col-url": { type: "URL", value: "https://example.com" },
        }),
      ];

      const parsed = roundTrip(db, rows);
      expectNoErrors(parsed);
      expectRowPropertiesMatch(rows, parsed.rows, allCols);
    });

    it("15. 100 rows — correctness at scale (< 500ms)", () => {
      const db = makeDatabase(columns);
      const rows: DatabaseRowInput[] = [];
      for (let i = 0; i < 100; i++) {
        rows.push(
          makeRow(
            `r${i}`,
            {
              "col-title": { type: "TITLE", value: `Row ${i}` },
              "col-text": { type: "TEXT", value: `Description ${i}` },
              "col-num": { type: "NUMBER", value: i },
              "col-status": {
                type: "SELECT",
                value: i % 2 === 0 ? "Open" : "Closed",
              },
            },
            new Date(BASE_DATE.getTime() + i * 1000)
          )
        );
      }

      const start = performance.now();
      const parsed = roundTrip(db, rows);
      const elapsed = performance.now() - start;

      expectNoErrors(parsed);
      expect(parsed.rows.length).toBe(100);
      expectRowPropertiesMatch(rows, parsed.rows, columns);
      expect(elapsed).toBeLessThan(500);
    });

    it("16. Null values — some properties null", () => {
      const db = makeDatabase(columns);
      const rows = [
        makeRow("r1", {
          "col-title": { type: "TITLE", value: "Sparse row" },
          // col-text, col-num, col-status are all missing (null)
        }),
      ];

      const parsed = roundTrip(db, rows);
      expectNoErrors(parsed);
      expect(parsed.rows.length).toBe(1);
      expect(parsed.rows[0].properties["col-title"]).toStrictEqual({
        type: "TITLE",
        value: "Sparse row",
      });
      // Null properties should be absent
      expect(parsed.rows[0].properties["col-text"]).toBeUndefined();
      expect(parsed.rows[0].properties["col-num"]).toBeUndefined();
      expect(parsed.rows[0].properties["col-status"]).toBeUndefined();
    });

    it("17. All null row — only TITLE filled", () => {
      const allCols: Column[] = [
        { id: "col-title", name: "Title", type: "TITLE" },
        { id: "col-text", name: "Notes", type: "TEXT" },
        { id: "col-num", name: "Count", type: "NUMBER" },
        { id: "col-date", name: "Date", type: "DATE" },
        { id: "col-cb", name: "Done", type: "CHECKBOX" },
        { id: "col-url", name: "Link", type: "URL" },
      ];
      const db = makeDatabase(allCols);
      const rows = [
        makeRow("r1", {
          "col-title": { type: "TITLE", value: "Minimal" },
        }),
      ];

      const parsed = roundTrip(db, rows);
      expectNoErrors(parsed);
      expect(parsed.rows.length).toBe(1);
      expect(parsed.rows[0].properties["col-title"]).toStrictEqual({
        type: "TITLE",
        value: "Minimal",
      });
      for (const col of allCols.filter((c) => c.id !== "col-title")) {
        expect(parsed.rows[0].properties[col.id]).toBeUndefined();
      }
    });

    it("18. Pipe in text — escaped and restored", () => {
      const cols: Column[] = [
        { id: "col-title", name: "Title", type: "TITLE" },
        { id: "col-text", name: "Notes", type: "TEXT" },
      ];
      const db = makeDatabase(cols);
      const rows = [
        makeRow("r1", {
          "col-title": { type: "TITLE", value: "Pipe test" },
          "col-text": { type: "TEXT", value: "A | B" },
        }),
      ];

      const parsed = roundTrip(db, rows);
      expectNoErrors(parsed);
      expectRowPropertiesMatch(rows, parsed.rows, cols);
    });

    it("19. Comma in SELECT option", () => {
      const cols: Column[] = [
        { id: "col-title", name: "Title", type: "TITLE" },
        {
          id: "col-color",
          name: "Color",
          type: "SELECT",
          options: ["Red, Blue", "Green"],
        },
      ];
      const db = makeDatabase(cols);
      const rows = [
        makeRow("r1", {
          "col-title": { type: "TITLE", value: "Test" },
          "col-color": { type: "SELECT", value: "Red, Blue" },
        }),
      ];

      const parsed = roundTrip(db, rows);
      expectNoErrors(parsed);
      expectRowPropertiesMatch(rows, parsed.rows, cols);
    });

    it("20. Long text — 1000+ characters", () => {
      const longText = "A".repeat(1200);
      const cols: Column[] = [
        { id: "col-title", name: "Title", type: "TITLE" },
        { id: "col-text", name: "Content", type: "TEXT" },
      ];
      const db = makeDatabase(cols);
      const rows = [
        makeRow("r1", {
          "col-title": { type: "TITLE", value: "Long" },
          "col-text": { type: "TEXT", value: longText },
        }),
      ];

      const parsed = roundTrip(db, rows);
      expectNoErrors(parsed);
      expectRowPropertiesMatch(rows, parsed.rows, cols);
    });

    it("21. Unicode — emoji, CJK, accented chars in values", () => {
      const cols: Column[] = [
        { id: "col-title", name: "Title", type: "TITLE" },
        { id: "col-text", name: "Notes", type: "TEXT" },
      ];
      const db = makeDatabase(cols);
      const rows = [
        makeRow("r1", {
          "col-title": { type: "TITLE", value: "Cafe\u0301" },
          "col-text": {
            type: "TEXT",
            value: "\u{1F680} \u4F60\u597D \u00FC\u00F6\u00E4",
          },
        }),
      ];

      const parsed = roundTrip(db, rows);
      expectNoErrors(parsed);
      expectRowPropertiesMatch(rows, parsed.rows, cols);
    });

    it("22. Column name with special chars", () => {
      const cols: Column[] = [
        { id: "col-title", name: "Title", type: "TITLE" },
        { id: "col-due", name: "Due Date (UTC)", type: "DATE" },
      ];
      const db = makeDatabase(cols);
      const rows = [
        makeRow("r1", {
          "col-title": { type: "TITLE", value: "Task" },
          "col-due": { type: "DATE", value: "2026-06-15" },
        }),
      ];

      const parsed = roundTrip(db, rows);
      expectNoErrors(parsed);
      expectRowPropertiesMatch(rows, parsed.rows, cols);
    });

    it("23. URL with special chars (encoded)", () => {
      const cols: Column[] = [
        { id: "col-title", name: "Title", type: "TITLE" },
        { id: "col-url", name: "Link", type: "URL" },
      ];
      const db = makeDatabase(cols);
      const rows = [
        makeRow("r1", {
          "col-title": { type: "TITLE", value: "Encoded" },
          "col-url": {
            type: "URL",
            value: "https://example.com/path?a=1&b=foo%20bar",
          },
        }),
      ];

      const parsed = roundTrip(db, rows);
      expectNoErrors(parsed);
      expectRowPropertiesMatch(rows, parsed.rows, cols);
    });
  });

  // ---------------------------------------------------------------------------
  // Schema Preservation
  // ---------------------------------------------------------------------------

  describe("Schema preservation", () => {
    it("24. Column order preserved", () => {
      const cols: Column[] = [
        { id: "col-title", name: "Title", type: "TITLE" },
        { id: "col-z", name: "Zebra", type: "TEXT" },
        { id: "col-a", name: "Apple", type: "TEXT" },
        { id: "col-m", name: "Mango", type: "NUMBER" },
      ];
      const db = makeDatabase(cols);
      const parsed = roundTrip(db, []);
      expectNoErrors(parsed);

      expect(parsed.columns.map((c) => c.id)).toStrictEqual(
        cols.map((c) => c.id)
      );
    });

    it("25. Column IDs preserved", () => {
      const cols: Column[] = [
        { id: "col-title-abc", name: "Title", type: "TITLE" },
        {
          id: "col-custom-xyz-123",
          name: "Custom",
          type: "TEXT",
        },
      ];
      const db = makeDatabase(cols);
      const parsed = roundTrip(db, []);
      expectNoErrors(parsed);

      for (let i = 0; i < cols.length; i++) {
        expect(parsed.columns[i].id).toBe(cols[i].id);
      }
    });

    it("26. Options order preserved", () => {
      const options = ["Low", "Medium", "High"];
      const cols: Column[] = [
        { id: "col-title", name: "Title", type: "TITLE" },
        {
          id: "col-pri",
          name: "Priority",
          type: "SELECT",
          options: [...options],
        },
      ];
      const db = makeDatabase(cols);
      const parsed = roundTrip(db, []);
      expectNoErrors(parsed);

      const parsedOptions = parsed.columns.find(
        (c) => c.id === "col-pri"
      )?.options;
      expect(parsedOptions).toStrictEqual(options);
    });

    it("27. Database metadata preserved", () => {
      const cols: Column[] = [
        { id: "col-title", name: "Title", type: "TITLE" },
      ];
      const db = makeDatabase(cols, {
        id: "db-meta-test",
        title: "Metadata DB",
        icon: "\u{1F4DA}",
        pageId: "page-xyz",
        defaultView: "board",
      });

      const parsed = roundTrip(db, []);
      expectNoErrors(parsed);

      expect(parsed.metadata.id).toBe("db-meta-test");
      expect(parsed.metadata.title).toBe("Metadata DB");
      expect(parsed.metadata.icon).toBe("\u{1F4DA}");
      expect(parsed.metadata.pageId).toBe("page-xyz");
      expect(parsed.metadata.defaultView).toBe("board");
    });
  });
});
