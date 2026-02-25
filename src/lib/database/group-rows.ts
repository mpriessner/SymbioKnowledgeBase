import type { RowProperties } from "@/types/database";

/**
 * Group rows by the value of a SELECT or MULTI_SELECT column.
 * Returns a Map preserving option order, plus an "Uncategorized" group.
 */
export function groupRowsByColumn<T extends { id: string; properties: RowProperties }>(
  rows: T[],
  columnId: string,
  columnOptions: string[]
): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  // Initialize groups in option order
  for (const option of columnOptions) {
    groups.set(option, []);
  }
  groups.set("Uncategorized", []);

  for (const row of rows) {
    const prop = row.properties[columnId];

    if (!prop) {
      groups.get("Uncategorized")!.push(row);
      continue;
    }

    if (prop.type === "SELECT") {
      const value = prop.value as string;
      if (value && groups.has(value)) {
        groups.get(value)!.push(row);
      } else if (value) {
        // Option not in column.options — create a new group
        if (!groups.has(value)) {
          // Insert before "Uncategorized"
          groups.set(value, []);
        }
        groups.get(value)!.push(row);
      } else {
        groups.get("Uncategorized")!.push(row);
      }
    } else if (prop.type === "MULTI_SELECT") {
      const values = prop.value as string[];
      if (values.length === 0) {
        groups.get("Uncategorized")!.push(row);
      } else {
        for (const value of values) {
          if (!groups.has(value)) {
            groups.set(value, []);
          }
          groups.get(value)!.push(row);
        }
      }
    } else {
      groups.get("Uncategorized")!.push(row);
    }
  }

  return groups;
}
