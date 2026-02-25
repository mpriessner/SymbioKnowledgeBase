/**
 * Convert heading text to a URL-safe anchor ID.
 * "Key Takeaways for SciSymbioAI" → "heading-key-takeaways-for-scisymbioai"
 */
export function slugifyHeading(text: string): string {
  const slug = text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `heading-${slug}`;
}

/**
 * Deduplicate heading IDs by adding numeric suffixes.
 * ["a", "b", "a", "a"] → ["a", "b", "a-2", "a-3"]
 */
export function deduplicateIds(ids: string[]): string[] {
  const counts = new Map<string, number>();
  return ids.map((id) => {
    const count = counts.get(id) || 0;
    counts.set(id, count + 1);
    return count === 0 ? id : `${id}-${count + 1}`;
  });
}
