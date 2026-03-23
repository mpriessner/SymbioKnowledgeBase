import YAML from "yaml";
import type { Column, PropertyValue } from "../../types/database";

export interface DatabaseSerializeInput {
  id: string;
  title: string;
  icon: string | null;
  pageId: string;
  defaultView: string;
  columns: Column[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DatabaseRowInput {
  id: string;
  properties: Record<string, PropertyValue>;
  createdAt: Date;
}

function formatCellValue(value: PropertyValue | undefined | null): string {
  if (value == null) return "\u2014";

  switch (value.type) {
    case "TITLE":
    case "TEXT":
    case "SELECT":
    case "URL":
      return escapeCell(String(value.value));
    case "NUMBER":
      return String(value.value);
    case "MULTI_SELECT":
      return escapeCell((value.value as string[]).join(", "));
    case "DATE":
      return String(value.value);
    case "CHECKBOX":
      return value.value ? "true" : "false";
    default:
      return "\u2014";
  }
}

function escapeCell(str: string): string {
  return str.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function orderColumns(columns: Column[]): Column[] {
  const titleCol = columns.find((c) => c.type === "TITLE");
  const rest = columns.filter((c) => c.type !== "TITLE");
  return titleCol ? [titleCol, ...rest] : [...rest];
}

export function databaseToMarkdown(
  database: DatabaseSerializeInput,
  rows: DatabaseRowInput[]
): string {
  const frontmatter = buildFrontmatter(database);
  const table = buildTable(database.columns, rows);
  return frontmatter + table;
}

function buildFrontmatter(database: DatabaseSerializeInput): string {
  const columnsYaml = database.columns.map((col) => {
    const entry: Record<string, unknown> = {
      id: col.id,
      name: col.name,
      type: col.type,
    };
    if (col.options && col.options.length > 0) {
      entry.options = col.options;
    }
    return entry;
  });

  const doc: Record<string, unknown> = {
    id: database.id,
    type: "database",
    title: database.title,
    page_id: database.pageId,
    icon: database.icon,
    default_view: database.defaultView,
    columns: columnsYaml,
    created: database.createdAt.toISOString(),
    updated: database.updatedAt.toISOString(),
  };

  const yamlStr = YAML.stringify(doc, {
    lineWidth: 0,
    defaultKeyType: "PLAIN",
    defaultStringType: "PLAIN",
  }).trimEnd();

  return `---\n${yamlStr}\n---\n\n`;
}

function buildTable(columns: Column[], rows: DatabaseRowInput[]): string {
  const ordered = orderColumns(columns);
  const headers = ordered.map((c) => c.name);

  const headerRow = `| ${headers.join(" | ")} |`;
  const separatorRow = `| ${headers.map((h) => "-".repeat(h.length)).join(" | ")} |`;

  const sortedRows = [...rows].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );

  const dataRows = sortedRows.map((row) => {
    const cells = ordered.map((col) => {
      const prop = row.properties[col.id];
      return formatCellValue(prop);
    });
    return `| ${cells.join(" | ")} |`;
  });

  return [headerRow, separatorRow, ...dataRows].join("\n") + "\n";
}
