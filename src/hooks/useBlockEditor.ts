"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { JSONContent } from "@tiptap/react";
import type { Block } from "@/types/editor";
import type { ApiResponse } from "@/types/api";

// Query key factory for blocks
export const blockKeys = {
  all: ["blocks"] as const,
  byPage: (pageId: string) => ["blocks", "page", pageId] as const,
  byId: (blockId: string) => ["blocks", blockId] as const,
};

interface PageBlocksResponse {
  data: Block[];
  meta: { count: number; pageId: string; timestamp: string };
}

// Fetch all blocks for a page
async function fetchPageBlocks(pageId: string): Promise<Block[]> {
  const res = await fetch(`/api/pages/${pageId}/blocks`);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error?.message || `Failed to fetch blocks: ${res.status}`);
  }
  const json: PageBlocksResponse = await res.json();
  return json.data;
}

// Save full TipTap document for a page
async function savePageDocument(
  pageId: string,
  content: JSONContent
): Promise<Block> {
  const res = await fetch(`/api/pages/${pageId}/blocks`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error?.message || `Failed to save document: ${res.status}`);
  }
  const json: ApiResponse<Block> = await res.json();
  return json.data;
}

// Hook: Load page blocks
export function usePageBlocks(pageId: string) {
  return useQuery({
    queryKey: blockKeys.byPage(pageId),
    queryFn: () => fetchPageBlocks(pageId),
    enabled: !!pageId,
    staleTime: 30_000, // 30 seconds before refetch
  });
}

// Hook: Save page document with optimistic updates
export function useSaveDocument(pageId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (content: JSONContent) => savePageDocument(pageId, content),
    onMutate: async (newContent) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: blockKeys.byPage(pageId),
      });

      // Snapshot previous value
      const previousBlocks = queryClient.getQueryData<Block[]>(
        blockKeys.byPage(pageId)
      );

      // Optimistically update the cache
      if (previousBlocks) {
        const documentBlock = previousBlocks.find(
          (b) => b.type === "DOCUMENT"
        );
        if (documentBlock) {
          const updated = previousBlocks.map((b) =>
            b.type === "DOCUMENT"
              ? { ...b, content: newContent, updatedAt: new Date().toISOString() }
              : b
          );
          queryClient.setQueryData(blockKeys.byPage(pageId), updated);
        }
      }

      return { previousBlocks };
    },
    onError: (_err, _newContent, context) => {
      // Rollback on error
      if (context?.previousBlocks) {
        queryClient.setQueryData(
          blockKeys.byPage(pageId),
          context.previousBlocks
        );
      }
    },
    onSettled: () => {
      // Refetch after mutation settles to ensure consistency
      queryClient.invalidateQueries({
        queryKey: blockKeys.byPage(pageId),
      });
    },
  });
}
