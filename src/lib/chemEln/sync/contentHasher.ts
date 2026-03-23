import { createHash } from "crypto";

const VOLATILE_FIELDS = new Set([
  "updatedAt",
  "createdAt",
  "syncTimestamp",
  "updated_at",
  "created_at",
  "sync_timestamp",
]);

function sortedReplacer(_key: string, value: unknown): unknown {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[k] = (value as Record<string, unknown>)[k];
    }
    return sorted;
  }
  return value;
}

function stripVolatileFields(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (VOLATILE_FIELDS.has(key)) {
      continue;
    }
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      result[key] = stripVolatileFields(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item !== null && typeof item === "object" && !Array.isArray(item)
          ? stripVolatileFields(item as Record<string, unknown>)
          : item,
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function computeContentHash(data: Record<string, unknown>): string {
  const cleaned = stripVolatileFields(data);
  const serialized = JSON.stringify(cleaned, sortedReplacer);
  return createHash("sha256").update(serialized, "utf-8").digest("hex");
}
