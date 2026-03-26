"use client";

import { useState, useCallback } from "react";
import type { SortPreference } from "@/lib/pages/sortPages";
import { getDefaultSort } from "@/lib/pages/sortPages";

const STORAGE_PREFIX = "skb-sort-";

function readFromStorage(pageId: string, categoryKey?: string): SortPreference {
  if (typeof window === "undefined") {
    return getDefaultSort(categoryKey);
  }
  try {
    const stored = localStorage.getItem(`${STORAGE_PREFIX}${pageId}`);
    if (stored) {
      return JSON.parse(stored) as SortPreference;
    }
  } catch {
    // Invalid JSON — ignore
  }
  return getDefaultSort(categoryKey);
}

/**
 * Hook to manage sort preference for a category page.
 * Persists to localStorage per page ID.
 */
export function useCategorySortPreference(
  pageId: string,
  categoryKey?: string
) {
  const [sortPref, setSortPref] = useState<SortPreference>(() =>
    readFromStorage(pageId, categoryKey)
  );

  const updateSort = useCallback(
    (pref: SortPreference) => {
      setSortPref(pref);
      try {
        localStorage.setItem(
          `${STORAGE_PREFIX}${pageId}`,
          JSON.stringify(pref)
        );
      } catch {
        // localStorage full or unavailable — ignore
      }
    },
    [pageId]
  );

  return { sortPref, updateSort };
}
