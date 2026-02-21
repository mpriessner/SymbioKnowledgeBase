"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";

interface PageSearchResult {
  id: string;
  title: string;
  icon: string | null;
}

interface PageSearchResponse {
  data: PageSearchResult[];
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
}

/**
 * Custom hook for searching pages with debouncing.
 * Used by the wikilink autocomplete to find matching pages.
 */
export function usePageSearch(
  searchTerm: string,
  options: {
    enabled?: boolean;
    debounceMs?: number;
    limit?: number;
  } = {}
) {
  const { enabled = true, debounceMs = 300, limit = 10 } = options;
  const [debouncedTerm, setDebouncedTerm] = useState(searchTerm);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTerm(searchTerm);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [searchTerm, debounceMs]);

  return useQuery<PageSearchResponse>({
    queryKey: ["pages", "search", debouncedTerm, limit],
    queryFn: async () => {
      const params = new URLSearchParams({
        search: debouncedTerm,
        limit: String(limit),
      });

      const response = await fetch(`/api/pages?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to search pages");
      }

      return response.json() as Promise<PageSearchResponse>;
    },
    enabled: enabled && debouncedTerm.length > 0,
    staleTime: 10_000,
    placeholderData: (prev) => prev,
  });
}
