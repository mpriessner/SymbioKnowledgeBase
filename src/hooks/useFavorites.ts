"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

export interface FavoritePage {
  id: string;
  page_id: string;
  title: string;
  icon: string | null;
  favorite_at: string;
}

interface FavoritesResponse {
  data: FavoritePage[];
}

export const favoriteKeys = {
  all: ["favorites"] as const,
  list: () => [...favoriteKeys.all, "list"] as const,
};

export function useFavorites() {
  return useQuery<FavoritesResponse>({
    queryKey: favoriteKeys.list(),
    queryFn: async () => {
      const res = await fetch("/api/favorites");
      if (!res.ok) throw new Error("Failed to fetch favorites");
      return res.json();
    },
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      pageId,
      isFavorite,
    }: {
      pageId: string;
      isFavorite: boolean;
    }) => {
      const res = await fetch(`/api/pages/${pageId}/favorite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite }),
      });
      if (!res.ok) throw new Error("Failed to toggle favorite");
      return res.json();
    },
    onMutate: async ({ pageId, isFavorite }) => {
      await queryClient.cancelQueries({ queryKey: favoriteKeys.list() });
      const previous =
        queryClient.getQueryData<FavoritesResponse>(favoriteKeys.list());

      queryClient.setQueryData<FavoritesResponse>(
        favoriteKeys.list(),
        (old) => {
          if (!old) return old;
          if (isFavorite) {
            // Add optimistically (will be replaced by server data on settle)
            return {
              ...old,
              data: [
                ...old.data,
                {
                  id: `temp-${pageId}`,
                  page_id: pageId,
                  title: "",
                  icon: null,
                  favorite_at: new Date().toISOString(),
                },
              ],
            };
          } else {
            return {
              ...old,
              data: old.data.filter((f) => f.page_id !== pageId),
            };
          }
        }
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(favoriteKeys.list(), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: favoriteKeys.list() });
    },
  });
}

export function useIsFavorite(pageId: string): boolean {
  const { data } = useFavorites();
  return data?.data?.some((f) => f.page_id === pageId) ?? false;
}

export function useFavoritePages(): FavoritePage[] {
  const { data } = useFavorites();
  return data?.data ?? [];
}

export function useToggleFavoriteCallback(pageId: string) {
  const isFavorite = useIsFavorite(pageId);
  const toggle = useToggleFavorite();

  return useCallback(() => {
    toggle.mutate({ pageId, isFavorite: !isFavorite });
  }, [toggle, pageId, isFavorite]);
}
