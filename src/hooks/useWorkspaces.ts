"use client";

import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";

const RECENT_PAGES_KEY = "symbio-recent-pages";

/** Clear all client-side cached data before workspace switch/creation reload */
function clearClientState(queryClient: QueryClient) {
  queryClient.clear();
  try {
    localStorage.removeItem(RECENT_PAGES_KEY);
  } catch {
    // Ignore storage errors
  }
}

interface Workspace {
  id: string;
  name: string;
  plan: string;
  memberCount: number;
  isCurrent: boolean;
  role: string;
}

interface WorkspaceListResponse {
  data: Workspace[];
}

export function useWorkspaces() {
  const queryClient = useQueryClient();

  const query = useQuery<WorkspaceListResponse>({
    queryKey: ["workspaces"],
    queryFn: async () => {
      const res = await fetch("/api/workspaces");
      if (!res.ok) throw new Error("Failed to fetch workspaces");
      return res.json() as Promise<WorkspaceListResponse>;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || "Failed to create workspace");
      }
      return res.json();
    },
    onSuccess: () => {
      clearClientState(queryClient);
      window.location.reload();
    },
  });

  const switchMutation = useMutation({
    mutationFn: async (workspaceId: string) => {
      const res = await fetch("/api/workspaces/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || "Failed to switch workspace");
      }
      return res.json();
    },
    onSuccess: () => {
      clearClientState(queryClient);
      window.location.reload();
    },
  });

  return {
    workspaces: query.data?.data ?? [],
    isLoading: query.isLoading,
    createWorkspace: createMutation.mutate,
    isCreating: createMutation.isPending,
    createError: createMutation.error,
    switchWorkspace: switchMutation.mutate,
    isSwitching: switchMutation.isPending,
  };
}
