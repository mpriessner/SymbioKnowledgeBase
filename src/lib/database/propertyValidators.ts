import type { Column, RowProperties, PropertyValue } from "@/types/database";

/**
 * Validates row properties against the database schema.
 * Ensures each property matches its column type and constraints.
 */
export function validateProperties(
  properties: RowProperties,
  columns: Column[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const columnMap = new Map(columns.map((c) => [c.id, c]));

  // Check that all provided properties match a column
  for (const [columnId, propValue] of Object.entries(properties)) {
    const column = columnMap.get(columnId);
    if (!column) {
      errors.push(`Unknown column: ${columnId}`);
      continue;
    }

    // Type must match
    if (propValue.type !== column.type) {
      errors.push(
        `Column "${column.name}" expects type ${column.type}, got ${propValue.type}`
      );
      continue;
    }

    // Type-specific validation
    const typeError = validatePropertyByType(propValue, column);
    if (typeError) {
      errors.push(typeError);
    }
  }

  // Check required TITLE column has a value
  const titleColumn = columns.find((c) => c.type === "TITLE");
  if (titleColumn && !properties[titleColumn.id]) {
    errors.push("TITLE property is required");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates a single property value against its column constraints.
 */
function validatePropertyByType(
  prop: PropertyValue,
  column: Column
): string | null {
  switch (prop.type) {
    case "SELECT":
      if (column.options && !column.options.includes(prop.value)) {
        return `Column "${column.name}" value "${prop.value}" is not a valid option. Valid: ${column.options.join(", ")}`;
      }
      return null;

    case "MULTI_SELECT":
      if (column.options) {
        const invalid = prop.value.filter(
          (v) => !column.options!.includes(v)
        );
        if (invalid.length > 0) {
          return `Column "${column.name}" contains invalid options: ${invalid.join(", ")}`;
        }
      }
      return null;

    case "NUMBER":
      if (typeof prop.value !== "number" || isNaN(prop.value)) {
        return `Column "${column.name}" must be a valid number`;
      }
      return null;

    case "URL":
      try {
        new URL(prop.value);
        return null;
      } catch {
        return `Column "${column.name}" must be a valid URL`;
      }

    default:
      return null;
  }
}

/**
 * Extracts the title value from row properties.
 * The TITLE column value is used as the page title.
 */
export function extractTitleFromProperties(
  properties: RowProperties,
  columns: Column[]
): string {
  const titleColumn = columns.find((c) => c.type === "TITLE");
  if (!titleColumn) return "Untitled";

  const titleProp = properties[titleColumn.id];
  if (!titleProp || titleProp.type !== "TITLE") return "Untitled";

  return titleProp.value || "Untitled";
}
