"use client";

import { useQuery } from "@tanstack/react-query";
import type { SearchApiResponse, SearchFilters } from "@/types/search";

/**
 * TanStack Query hook for the search API.
 *
 * @param query - The search query string
 * @param options.limit - Max results (default 20)
 * @param options.offset - Pagination offset (default 0)
 * @param options.enabled - Whether the query should run
 * @param options.filters - Search filters (date range, content type)
 */
export function useSearch(
  query: string,
  options: {
    limit?: number;
    offset?: number;
    enabled?: boolean;
    filters?: SearchFilters;
  } = {}
) {
  const { limit = 20, offset = 0, enabled = true, filters } = options;

  return useQuery<SearchApiResponse>({
    queryKey: ["search", query, limit, offset, filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        q: query,
        limit: String(limit),
        offset: String(offset),
      });

      if (filters?.dateFrom) {
        params.set("dateFrom", filters.dateFrom);
      }
      if (filters?.dateTo) {
        params.set("dateTo", filters.dateTo);
      }
      if (filters?.contentType && filters.contentType.length > 0) {
        params.set("contentType", filters.contentType.join(","));
      }

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
