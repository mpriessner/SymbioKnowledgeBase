import type { PageTreeNode } from "@/types/page";

export interface SortPreference {
  field: "eln_number" | "title" | "updatedAt" | "createdAt" | "position";
  direction: "asc" | "desc";
}

/**
 * Extract a sortable number from ELN-style experiment IDs in page titles.
 * Handles formats like: EXP-2025-0001, ELN-2026-0042, etc.
 * Returns year*10000 + sequence for proper chronological ordering.
 */
function extractElnNumber(title: string): number {
  const match = title.match(/(?:EXP|ELN)-(\d{4})-(\d{4})/);
  if (!match) return 0;
  return parseInt(match[1]) * 10000 + parseInt(match[2]);
}

/**
 * Sort page tree nodes by a given preference.
 * Returns a new sorted array (does not mutate the input).
 */
export function sortPageTreeNodes(
  nodes: PageTreeNode[],
  pref: SortPreference
): PageTreeNode[] {
  const sorted = [...nodes];

  sorted.sort((a, b) => {
    let cmp = 0;
    switch (pref.field) {
      case "eln_number":
        cmp = extractElnNumber(a.title) - extractElnNumber(b.title);
        break;
      case "title":
        cmp = a.title.localeCompare(b.title);
        break;
      case "updatedAt":
        cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        break;
      case "createdAt":
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      case "position":
        cmp = a.position - b.position;
        break;
    }
    return pref.direction === "desc" ? -cmp : cmp;
  });

  return sorted;
}

/** Category keys that have known default sorts */
const CATEGORY_TITLES_TO_KEYS: Record<string, string> = {
  "Experiments": "experiments",
  "Archive": "archive",
  "Chemicals": "chemicals",
  "Reaction Types": "reactionTypes",
  "Researchers": "researchers",
  "Substrate Classes": "substrateClasses",
};

/** Default sort preferences per category */
const DEFAULT_SORTS: Record<string, SortPreference> = {
  experiments: { field: "eln_number", direction: "desc" },
  archive: { field: "eln_number", direction: "desc" },
  chemicals: { field: "title", direction: "asc" },
  reactionTypes: { field: "title", direction: "asc" },
  researchers: { field: "title", direction: "asc" },
  substrateClasses: { field: "title", direction: "asc" },
};

/**
 * Get the category key for a page title, if it's a known Chemistry KB category.
 */
export function getCategoryKey(title: string): string | undefined {
  return CATEGORY_TITLES_TO_KEYS[title];
}

/**
 * Get the default sort preference for a category, or manual sort as fallback.
 */
export function getDefaultSort(categoryKey?: string): SortPreference {
  if (categoryKey && DEFAULT_SORTS[categoryKey]) {
    return DEFAULT_SORTS[categoryKey];
  }
  return { field: "position", direction: "asc" };
}

/** All sort options for the UI */
export const SORT_OPTIONS: Array<{
  label: string;
  pref: SortPreference;
}> = [
  { label: "ELN # (newest first)", pref: { field: "eln_number", direction: "desc" } },
  { label: "ELN # (oldest first)", pref: { field: "eln_number", direction: "asc" } },
  { label: "Alphabetical A\u2192Z", pref: { field: "title", direction: "asc" } },
  { label: "Alphabetical Z\u2192A", pref: { field: "title", direction: "desc" } },
  { label: "Last edited", pref: { field: "updatedAt", direction: "desc" } },
  { label: "Date created", pref: { field: "createdAt", direction: "desc" } },
  { label: "Manual (drag)", pref: { field: "position", direction: "asc" } },
];
