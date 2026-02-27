"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface PageSummaryData {
  oneLiner: string | null;
  summary: string | null;
  summaryUpdatedAt: string | null;
}

interface PageSummaryResponse {
  data: PageSummaryData;
  meta: { timestamp: string };
}

interface UpdateSummaryInput {
  oneLiner?: string;
  summary?: string;
}

/**
 * TanStack Query hook for fetching a page's summary data.
 */
export function usePageSummary(
  pageId: string | null,
  options: { enabled?: boolean } = {}
) {
  const { enabled = true } = options;

  return useQuery<PageSummaryResponse>({
    queryKey: ["pages", pageId, "summary"],
    queryFn: async () => {
      const response = await fetch(`/api/pages/${pageId}/summary`);
      if (!response.ok) {
        throw new Error("Failed to fetch page summary");
      }
      return response.json() as Promise<PageSummaryResponse>;
    },
    enabled: enabled && pageId !== null,
    staleTime: 30_000,
  });
}

/**
 * TanStack Query mutation hook for updating a page's summary.
 */
export function useUpdatePageSummary(pageId: string) {
  const queryClient = useQueryClient();

  return useMutation<PageSummaryResponse, Error, UpdateSummaryInput>({
    mutationFn: async (input: UpdateSummaryInput) => {
      const response = await fetch(`/api/pages/${pageId}/summary`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const message =
          errorData?.error?.message || "Failed to update page summary";
        throw new Error(message);
      }

      return response.json() as Promise<PageSummaryResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["pages", pageId, "summary"],
      });
    },
  });
}
