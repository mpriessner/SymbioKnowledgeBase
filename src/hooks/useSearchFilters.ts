"use client";

import { useCallback, useState } from "react";
import type { SearchFilters, ContentTypeFilter } from "@/types/search";

/**
 * Manages search filter state for the enhanced search dialog.
 *
 * Filter state is kept in React state for responsive UI.
 * URL sync is handled by the dialog component if needed.
 */
export function useSearchFilters() {
  const [filters, setFilters] = useState<SearchFilters>({});

  const setFilter = useCallback(
    (key: keyof SearchFilters, value: string | ContentTypeFilter[] | undefined) => {
      setFilters((prev) => ({
        ...prev,
        [key]: value,
      }));
    },
    []
  );

  const removeFilter = useCallback((key: keyof SearchFilters) => {
    setFilters((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  return { filters, setFilter, removeFilter, clearFilters };
}
