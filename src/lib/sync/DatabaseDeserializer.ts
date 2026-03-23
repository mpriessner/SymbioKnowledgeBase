import YAML from "yaml";
import type { Column, PropertyValue, PropertyType } from "../../types/database";

export interface ParsedDatabase {
  metadata: {
    id?: string;
    title: string;
    icon?: string | null;
    pageId?: string;
    defaultView?: string;
  };
  columns: Column[];
  rows: ParsedRow[];
  errors: ParseError[];
}

export interface ParsedRow {
  rowIndex: number;
  properties: Record<string, PropertyValue>;
}

export interface ParseError {
  type: "warning" | "error";
  row?: number;
  column?: string;
  message: string;
}

const VALID_TYPES: PropertyType[] = [
  "TITLE",
  "TEXT",
  "NUMBER",
  "SELECT",
  "MULTI_SELECT",
  "DATE",
  "CHECKBOX",
  "URL",
];

export function markdownToDatabase(markdown: string): ParsedDatabase {
  const errors: ParseError[] = [];

  const { frontmatter, body } = splitFrontmatter(markdown);
  if (!frontmatter) {
    return {
      metadata: { title: "" },
      columns: [],
      rows: [],
      errors: [{ type: "error", message: "Missing YAML frontmatter" }],
    };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = YAML.parse(frontmatter);
  } catch {
    return {
      metadata: { title: "" },
      columns: [],
      rows: [],
      errors: [{ type: "error", message: "Invalid YAML frontmatter" }],
    };
  }

  const metadata: ParsedDatabase["metadata"] = {
    title: String(parsed.title ?? ""),
  };
  if (parsed.id != null) metadata.id = String(parsed.id);
  if (parsed.icon !== undefined) metadata.icon = parsed.icon as string | null;
  if (parsed.page_id != null) metadata.pageId = String(parsed.page_id);
  if (parsed.default_view != null)
    metadata.defaultView = String(parsed.default_view);

  const rawColumns = parsed.columns;
  if (!Array.isArray(rawColumns) || rawColumns.length === 0) {
    return {
      metadata,
      columns: [],
      rows: [],
      errors: [
        {
          type: "error",
          message: "Schema must define at least one column",
        },
      ],
    };
  }

  const columns: Column[] = [];
  for (const raw of rawColumns) {
    if (!raw || typeof raw !== "object") {
      errors.push({ type: "error", message: "Invalid column definition" });
      continue;
    }
    const r = raw as Record<string, unknown>;
    const type = String(r.type ?? "");
    if (!VALID_TYPES.includes(type as PropertyType)) {
      errors.push({
        type: "error",
        message: `Invalid column type "${type}" for column "${r.name}"`,
      });
      continue;
    }
    const col: Column = {
      id: String(r.id ?? ""),
      name: String(r.name ?? ""),
      type: type as PropertyType,
    };
    if (Array.isArray(r.options)) {
      col.options = r.options.map(String);
    }
    columns.push(col);
  }

  const titleColumns = columns.filter((c) => c.type === "TITLE");
  if (titleColumns.length !== 1) {
    return {
      metadata,
      columns,
      rows: [],
      errors: [
        ...errors,
        {
          type: "error",
          message:
            titleColumns.length === 0
              ? "Schema must have exactly one TITLE column"
              : "Schema must have exactly one TITLE column, found " +
                titleColumns.length,
        },
      ],
    };
  }

  if (errors.some((e) => e.type === "error")) {
    return { metadata, columns, rows: [], errors };
  }

  const rows = parseTable(body, columns, errors);

  return { metadata, columns, rows, errors };
}

function splitFrontmatter(markdown: string): {
  frontmatter: string | null;
  body: string;
} {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return { frontmatter: null, body: markdown };
  return {
    frontmatter: match[1],
    body: markdown.slice(match[0].length),
  };
}

function splitRow(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let i = 0;
  // Skip leading pipe
  const trimmed = line.trim();
  const start = trimmed.startsWith("|") ? 1 : 0;
  const end = trimmed.endsWith("|") ? trimmed.length - 1 : trimmed.length;
  const segment = trimmed.slice(start, end);

  for (i = 0; i < segment.length; i++) {
    if (segment[i] === "\\" && i + 1 < segment.length && segment[i + 1] === "|") {
      current += "|";
      i++;
    } else if (segment[i] === "|") {
      cells.push(current.trim());
      current = "";
    } else {
      current += segment[i];
    }
  }
  cells.push(current.trim());
  return cells;
}

function isSeparatorRow(line: string): boolean {
  const trimmed = line.trim();
  return /^\|?[\s\-:|]+\|?$/.test(trimmed) && /---/.test(trimmed);
}

function parseTable(
  body: string,
  columns: Column[],
  errors: ParseError[]
): ParsedRow[] {
  const lines = body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return [];

  const headerLine = lines[0];
  const headers = splitRow(headerLine);

  const columnByName = new Map(columns.map((c) => [c.name, c]));

  const headerToColumn: (Column | null)[] = headers.map((h) => {
    const col = columnByName.get(h) ?? null;
    if (!col) {
      errors.push({
        type: "error",
        column: h,
        message: `Table header "${h}" does not match any column definition`,
      });
    }
    return col;
  });

  const headersSet = new Set(headers);
  for (const col of columns) {
    if (!headersSet.has(col.name)) {
      errors.push({
        type: "warning",
        column: col.name,
        message: `Column "${col.name}" defined in schema but missing from table headers`,
      });
    }
  }

  const rows: ParsedRow[] = [];
  let dataStartIndex = 1;
  if (lines.length > 1 && isSeparatorRow(lines[1])) {
    dataStartIndex = 2;
  }

  for (let i = dataStartIndex; i < lines.length; i++) {
    const rowNum = i - dataStartIndex + 1;
    const cells = splitRow(lines[i]);
    const properties: Record<string, PropertyValue> = {};

    for (let j = 0; j < headerToColumn.length; j++) {
      const col = headerToColumn[j];
      if (!col) continue;

      const cellValue = j < cells.length ? cells[j] : "";
      if (cellValue === "\u2014" || cellValue === "" || cellValue === "—") {
        if (col.type === "TITLE") {
          errors.push({
            type: "warning",
            row: rowNum,
            column: col.name,
            message: `TITLE is empty for row ${rowNum}`,
          });
        }
        continue;
      }

      const result = deserializeCell(cellValue, col, rowNum);
      if (result.error) {
        errors.push(result.error);
      }
      if (result.value) {
        properties[col.id] = result.value;
      }
    }

    rows.push({ rowIndex: i - dataStartIndex, properties });
  }

  return rows;
}

function deserializeCell(
  raw: string,
  column: Column,
  rowNum: number
): { value: PropertyValue | null; error: ParseError | null } {
  switch (column.type) {
    case "TITLE":
      return {
        value: { type: "TITLE", value: raw },
        error: null,
      };

    case "TEXT":
      return {
        value: { type: "TEXT", value: raw },
        error: null,
      };

    case "NUMBER": {
      const num = parseFloat(raw);
      if (isNaN(num) || !isFinite(num)) {
        return {
          value: null,
          error: {
            type: "error",
            row: rowNum,
            column: column.name,
            message: `Invalid number "${raw}" in column "${column.name}"`,
          },
        };
      }
      return { value: { type: "NUMBER", value: num }, error: null };
    }

    case "SELECT": {
      if (column.options && !column.options.includes(raw)) {
        return {
          value: null,
          error: {
            type: "error",
            row: rowNum,
            column: column.name,
            message: `"${raw}" is not a valid option for column "${column.name}". Valid: ${column.options.join(", ")}`,
          },
        };
      }
      return { value: { type: "SELECT", value: raw }, error: null };
    }

    case "MULTI_SELECT": {
      const values = raw.split(", ").map((v) => v.trim());
      if (column.options) {
        const invalid = values.filter((v) => !column.options!.includes(v));
        if (invalid.length > 0) {
          return {
            value: null,
            error: {
              type: "error",
              row: rowNum,
              column: column.name,
              message: `Invalid option(s) ${invalid.map((v) => `"${v}"`).join(", ")} for column "${column.name}". Valid: ${column.options.join(", ")}`,
            },
          };
        }
      }
      return {
        value: { type: "MULTI_SELECT", value: values },
        error: null,
      };
    }

    case "DATE": {
      const datePattern = /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/;
      if (!datePattern.test(raw)) {
        return {
          value: null,
          error: {
            type: "error",
            row: rowNum,
            column: column.name,
            message: `Invalid date "${raw}" in column "${column.name}"`,
          },
        };
      }
      return { value: { type: "DATE", value: raw }, error: null };
    }

    case "CHECKBOX": {
      const lower = raw.toLowerCase();
      if (lower !== "true" && lower !== "false") {
        return {
          value: null,
          error: {
            type: "error",
            row: rowNum,
            column: column.name,
            message: `Invalid checkbox value "${raw}" in column "${column.name}", expected "true" or "false"`,
          },
        };
      }
      return {
        value: { type: "CHECKBOX", value: lower === "true" },
        error: null,
      };
    }

    case "URL": {
      try {
        new URL(raw);
      } catch {
        return {
          value: null,
          error: {
            type: "error",
            row: rowNum,
            column: column.name,
            message: `Invalid URL "${raw}" in column "${column.name}"`,
          },
        };
      }
      return { value: { type: "URL", value: raw }, error: null };
    }

    default:
      return {
        value: null,
        error: {
          type: "error",
          row: rowNum,
          column: column.name,
          message: `Unknown type "${column.type}" for column "${column.name}"`,
        },
      };
  }
}
