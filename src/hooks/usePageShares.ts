"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface ShareMember {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  permission: "FULL_ACCESS" | "CAN_EDIT" | "CAN_COMMENT" | "CAN_VIEW";
  is_owner: boolean;
  created_at: string | null;
}

interface SharesResponse {
  data: ShareMember[];
}

export const shareKeys = {
  all: ["page-shares"] as const,
  page: (pageId: string) => [...shareKeys.all, pageId] as const,
};

export function usePageShares(pageId: string) {
  return useQuery<SharesResponse>({
    queryKey: shareKeys.page(pageId),
    queryFn: async () => {
      const res = await fetch(`/api/pages/${pageId}/share`);
      if (!res.ok) throw new Error("Failed to fetch shares");
      return res.json();
    },
  });
}

export function useInviteToPage(pageId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      email,
      permission,
    }: {
      email: string;
      permission: string;
    }) => {
      const res = await fetch(`/api/pages/${pageId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, permission }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "Failed to invite user");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shareKeys.page(pageId) });
    },
  });
}

export function useUpdateSharePermission(pageId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      shareId,
      permission,
    }: {
      shareId: string;
      permission: string;
    }) => {
      const res = await fetch(`/api/pages/${pageId}/share/${shareId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permission }),
      });
      if (!res.ok) throw new Error("Failed to update permission");
      return res.json();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: shareKeys.page(pageId) });
    },
  });
}

export function useRemoveShare(pageId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (shareId: string) => {
      const res = await fetch(`/api/pages/${pageId}/share/${shareId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to remove share");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: shareKeys.page(pageId) });
    },
  });
}

export function useUpdateGeneralAccess(pageId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (generalAccess: "INVITED_ONLY" | "ANYONE_WITH_LINK") => {
      const res = await fetch(`/api/pages/${pageId}/access`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generalAccess }),
      });
      if (!res.ok) throw new Error("Failed to update general access");
      return res.json();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: shareKeys.page(pageId) });
    },
  });
}
