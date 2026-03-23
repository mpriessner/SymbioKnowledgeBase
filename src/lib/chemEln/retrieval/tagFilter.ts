export interface PageWithTags {
  id: string;
  title: string;
  tags: string[];
  frontmatter: Record<string, unknown>;
}

/**
 * Checks whether a page's tag matches a query tag.
 * Handles range queries like "quality:4+" (quality >= 4).
 */
export function matchesTag(pageTags: string[], queryTag: string): boolean {
  const rangeMatch = queryTag.match(
    /^([a-z-]+):(\d+)\+$/
  );

  if (rangeMatch) {
    const namespace = rangeMatch[1];
    const minValue = parseInt(rangeMatch[2], 10);
    const prefix = `${namespace}:`;

    return pageTags.some((pageTag) => {
      if (!pageTag.startsWith(prefix)) return false;
      const val = parseInt(pageTag.slice(prefix.length), 10);
      return !isNaN(val) && val >= minValue;
    });
  }

  // Exact match (case-insensitive)
  const queryLower = queryTag.toLowerCase();
  return pageTags.some((pt) => pt.toLowerCase() === queryLower);
}

/**
 * Filters pages by tags using AND or OR logic.
 */
export function filterByTags(
  pages: PageWithTags[],
  tags: string[],
  operator: "AND" | "OR"
): PageWithTags[] {
  if (tags.length === 0) return pages;

  return pages.filter((page) => {
    if (operator === "AND") {
      return tags.every((tag) => matchesTag(page.tags, tag));
    }
    return tags.some((tag) => matchesTag(page.tags, tag));
  });
}

/**
 * Extracts namespaced tags from frontmatter key/value pairs.
 * Converts frontmatter like `{ reaction: "suzuki-coupling", scale: "large" }`
 * into tags like `["reaction:suzuki-coupling", "scale:large"]`.
 */
export function extractTagsFromFrontmatter(
  frontmatter: Record<string, unknown>
): string[] {
  const tags: string[] = [];

  const tagKeys = [
    "reaction",
    "substrate-class",
    "scale",
    "challenge",
    "functional-groups",
    "quality",
    "researcher",
  ];

  for (const key of tagKeys) {
    const value = frontmatter[key];
    if (value === undefined || value === null) continue;

    if (Array.isArray(value)) {
      for (const v of value) {
        if (typeof v === "string" || typeof v === "number") {
          tags.push(`${key}:${String(v).toLowerCase()}`);
        }
      }
    } else if (typeof value === "string") {
      tags.push(`${key}:${value.toLowerCase()}`);
    } else if (typeof value === "number") {
      tags.push(`${key}:${value}`);
    }
  }

  // Also include any pre-existing tags array
  const existingTags = frontmatter["tags"];
  if (Array.isArray(existingTags)) {
    for (const t of existingTags) {
      if (typeof t === "string" && !tags.includes(t)) {
        tags.push(t);
      }
    }
  }

  return tags;
}
