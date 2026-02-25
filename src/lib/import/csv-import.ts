import type { Column, DatabaseSchema, RowProperties, PropertyValue } from "@/types/database";

/**
 * Parse a CSV string into a database schema + rows.
 */
export function parseCSVToDatabase(csvText: string): {
  schema: DatabaseSchema;
  rows: RowProperties[];
} {
  const lines = parseCSVLines(csvText);
  if (lines.length === 0) {
    return {
      schema: { columns: [{ id: "col-title", name: "Title", type: "TITLE" }] },
      rows: [],
    };
  }

  const headers = lines[0];
  const dataLines = lines.slice(1);

  // Infer column types from the first 10 data rows
  const columns: Column[] = headers.map((header, i) => {
    const id = `col-${i}`;
    const name = header.trim() || `Column ${i + 1}`;
    const type = i === 0 ? "TITLE" : inferColumnType(dataLines, i);
    return { id, name, type };
  });

  // Ensure exactly one TITLE column (first column)
  const hasTitleCol = columns.some((c) => c.type === "TITLE");
  if (!hasTitleCol && columns.length > 0) {
    columns[0].type = "TITLE";
  }

  // Parse rows
  const rows: RowProperties[] = dataLines.map((fields) => {
    const properties: RowProperties = {};
    columns.forEach((col, i) => {
      const rawValue = fields[i]?.trim() ?? "";
      if (!rawValue) return;

      const propValue = parseValue(rawValue, col.type);
      if (propValue) {
        properties[col.id] = propValue;
      }
    });
    return properties;
  });

  return { schema: { columns }, rows };
}

/**
 * Parse CSV text into an array of field arrays, handling quoted fields.
 */
function parseCSVLines(text: string): string[][] {
  const result: string[][] = [];
  const lines = text.split(/\r?\n/);
  let currentRow: string[] = [];
  let inQuote = false;
  let currentField = "";

  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (inQuote) {
        if (char === '"' && nextChar === '"') {
          currentField += '"';
          i++; // skip escaped quote
        } else if (char === '"') {
          inQuote = false;
        } else {
          currentField += char;
        }
      } else {
        if (char === '"') {
          inQuote = true;
        } else if (char === ",") {
          currentRow.push(currentField);
          currentField = "";
        } else {
          currentField += char;
        }
      }
    }

    if (inQuote) {
      // Field spans multiple lines
      currentField += "\n";
    } else {
      currentRow.push(currentField);
      currentField = "";
      if (currentRow.some((f) => f.trim())) {
        result.push(currentRow);
      }
      currentRow = [];
    }
  }

  // Handle trailing content
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some((f) => f.trim())) {
      result.push(currentRow);
    }
  }

  return result;
}

/**
 * Infer column type from sample data.
 */
function inferColumnType(
  dataLines: string[][],
  columnIndex: number
): Column["type"] {
  const samples = dataLines
    .slice(0, 10)
    .map((row) => row[columnIndex]?.trim())
    .filter(Boolean);

  if (samples.length === 0) return "TEXT";

  // Check if all are dates (ISO format or common date patterns)
  const datePattern = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/;
  if (samples.every((s) => s && datePattern.test(s))) return "DATE";

  // Check if all are numbers
  if (samples.every((s) => s && !isNaN(Number(s)))) return "NUMBER";

  // Check if all are booleans
  const boolValues = new Set(["true", "false", "yes", "no", "1", "0"]);
  if (samples.every((s) => s && boolValues.has(s.toLowerCase()))) return "CHECKBOX";

  // Check if values repeat (SELECT-like)
  const uniqueValues = new Set(samples);
  if (uniqueValues.size <= 5 && samples.length >= 3) return "SELECT";

  return "TEXT";
}

/**
 * Parse a raw string value into a typed PropertyValue.
 */
function parseValue(
  raw: string,
  type: Column["type"]
): PropertyValue | null {
  switch (type) {
    case "TITLE":
      return { type: "TITLE", value: raw };
    case "TEXT":
      return { type: "TEXT", value: raw };
    case "NUMBER": {
      const num = Number(raw);
      return isNaN(num) ? { type: "TEXT", value: raw } : { type: "NUMBER", value: num };
    }
    case "DATE":
      return { type: "DATE", value: raw };
    case "CHECKBOX": {
      const lower = raw.toLowerCase();
      return {
        type: "CHECKBOX",
        value: lower === "true" || lower === "yes" || lower === "1",
      };
    }
    case "SELECT":
      return { type: "SELECT", value: raw };
    case "URL":
      return { type: "URL", value: raw };
    default:
      return { type: "TEXT", value: raw };
  }
}
