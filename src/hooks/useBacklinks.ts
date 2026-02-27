"use client";

import { useQuery } from "@tanstack/react-query";

interface BacklinkResult {
  pageId: string;
  pageTitle: string;
  pageIcon: string | null;
  oneLiner: string | null;
  summary: string | null;
  summaryUpdatedAt: string | null;
}

interface BacklinksResponse {
  data: BacklinkResult[];
  meta: {
    total: number;
  };
}

/**
 * TanStack Query hook for fetching backlinks for a page.
 */
export function useBacklinks(
  pageId: string | null,
  options: { enabled?: boolean } = {}
) {
  const { enabled = true } = options;

  return useQuery<BacklinksResponse>({
    queryKey: ["pages", pageId, "backlinks"],
    queryFn: async () => {
      const response = await fetch(`/api/pages/${pageId}/backlinks`);

      if (!response.ok) {
        throw new Error("Failed to fetch backlinks");
      }

      return response.json() as Promise<BacklinksResponse>;
    },
    enabled: enabled && pageId !== null,
    staleTime: 30_000,
  });
}

/**
 * TanStack Query hook for fetching forward links for a page.
 */
export function useForwardLinks(
  pageId: string | null,
  options: { enabled?: boolean } = {}
) {
  const { enabled = true } = options;

  return useQuery<BacklinksResponse>({
    queryKey: ["pages", pageId, "links"],
    queryFn: async () => {
      const response = await fetch(`/api/pages/${pageId}/links`);

      if (!response.ok) {
        throw new Error("Failed to fetch forward links");
      }

      return response.json() as Promise<BacklinksResponse>;
    },
    enabled: enabled && pageId !== null,
    staleTime: 30_000,
  });
}
