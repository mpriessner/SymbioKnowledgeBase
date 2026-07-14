/**
 * Search-text normalization (Codex-critical): lowercase, map `-_/` to a
 * space, collapse whitespace — so "shut off" matches "Main shut-off valve".
 * Kept fully separate from `nameKey` below, which is a plain lowercase/trim
 * used only for the `@@unique` upsert keys on AokSite/AokSpace.
 */
export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[-_/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(input: string): string[] {
  const normalized = normalizeText(input);
  return normalized.length > 0 ? normalized.split(" ") : [];
}

/** Lowercased + trimmed key used for AokSite/AokSpace `nameKey` unique upserts. */
export function toNameKey(name: string): string {
  return name.trim().toLowerCase();
}
