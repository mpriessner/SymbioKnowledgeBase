"use client";

import { useQuery } from "@tanstack/react-query";
import type { SearchApiResponse } from "@/types/search";

/**
 * TanStack Query hook for the search API.
 *
 * @param query - The search query string
 * @param options.limit - Max results (default 20)
 * @param options.offset - Pagination offset (default 0)
 * @param options.enabled - Whether the query should run
 */
export function useSearch(
  query: string,
  options: {
    limit?: number;
    offset?: number;
    enabled?: boolean;
  } = {}
) {
  const { limit = 20, offset = 0, enabled = true } = options;

  return useQuery<SearchApiResponse>({
    queryKey: ["search", query, limit, offset],
    queryFn: async () => {
      const params = new URLSearchParams({
        q: query,
        limit: String(limit),
        offset: String(offset),
      });

      const response = await fetch(`/api/search?${params.toString()}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error?.error?.message || "Search failed");
      }

      return response.json() as Promise<SearchApiResponse>;
    },
    enabled: enabled && query.length > 0,
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });
}
