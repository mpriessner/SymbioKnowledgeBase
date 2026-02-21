"use client";

import { useQuery } from "@tanstack/react-query";
import type { GraphApiResponse } from "@/types/graph";

/**
 * TanStack Query hook for fetching graph data.
 *
 * @param options.pageId - Optional page ID for local graph mode
 * @param options.depth - BFS depth for local graph (default 2)
 * @param options.enabled - Whether the query should run
 */
export function useGraphData(
  options: {
    pageId?: string;
    depth?: number;
    enabled?: boolean;
  } = {}
) {
  const { pageId, depth = 2, enabled = true } = options;

  return useQuery<GraphApiResponse>({
    queryKey: ["graph", pageId ?? "global", depth],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (pageId) {
        params.set("pageId", pageId);
        params.set("depth", String(depth));
      }

      const url = params.toString()
        ? `/api/graph?${params.toString()}`
        : "/api/graph";

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Failed to fetch graph data");
      }

      return response.json() as Promise<GraphApiResponse>;
    },
    enabled,
    staleTime: 30_000,
  });
}
