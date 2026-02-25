"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface PublishStatus {
  is_published: boolean;
  share_token: string | null;
  url: string | null;
  published_at: string | null;
  allow_indexing: boolean;
}

interface PublishResponse {
  data: PublishStatus;
}

export const publishKeys = {
  all: ["publish"] as const,
  page: (pageId: string) => [...publishKeys.all, pageId] as const,
};

export function usePublishStatus(pageId: string) {
  return useQuery<PublishResponse>({
    queryKey: publishKeys.page(pageId),
    queryFn: async () => {
      const res = await fetch(`/api/pages/${pageId}/publish`);
      if (!res.ok) throw new Error("Failed to fetch publish status");
      return res.json();
    },
  });
}

export function usePublishPage(pageId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/pages/${pageId}/publish`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to publish page");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: publishKeys.page(pageId) });
    },
  });
}

export function useUnpublishPage(pageId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/pages/${pageId}/publish`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to unpublish page");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: publishKeys.page(pageId) });
    },
  });
}

export function useUpdatePublishOptions(pageId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ allowIndexing }: { allowIndexing: boolean }) => {
      const res = await fetch(`/api/pages/${pageId}/publish`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowIndexing }),
      });
      if (!res.ok) throw new Error("Failed to update publish options");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: publishKeys.page(pageId) });
    },
  });
}
