/**
 * Generate a filesystem-safe slug from a page title.
 *
 * Rules:
 * - Preserves casing (unlike the lowercase slugify in helpers.ts)
 * - Replaces path-unsafe characters with hyphens
 * - Collapses consecutive hyphens
 * - Max 100 characters
 * - Falls back to "Untitled" for empty input
 */
export function fileSlug(title: string): string {
  const slug = title
    .replace(/[/\\:*?"<>|#%{}^~`\[\]]/g, "-") // Remove path-unsafe chars
    .replace(/\s+/g, " ") // Normalize whitespace to single spaces
    .replace(/^[.\- ]+|[.\- ]+$/g, "") // Trim leading/trailing dots, hyphens, spaces
    .slice(0, 100);

  return slug || "Untitled";
}
