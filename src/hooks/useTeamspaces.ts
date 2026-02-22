"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface TeamspaceData {
  id: string;
  name: string;
  icon: string | null;
  role: "OWNER" | "ADMIN" | "MEMBER" | "GUEST";
  member_count: number;
  page_count: number;
  created_at: string;
}

interface TeamspacesResponse {
  data: TeamspaceData[];
  meta: Record<string, unknown>;
}

async function fetchTeamspaces(): Promise<TeamspacesResponse> {
  const response = await fetch("/api/teamspaces");
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch teamspaces");
  }
  return response.json();
}

export const teamspaceKeys = {
  all: ["teamspaces"] as const,
  list: () => [...teamspaceKeys.all, "list"] as const,
  detail: (id: string) => [...teamspaceKeys.all, "detail", id] as const,
};

export function useTeamspaces() {
  return useQuery({
    queryKey: teamspaceKeys.list(),
    queryFn: fetchTeamspaces,
    staleTime: 30_000,
    select: (data) => data.data,
  });
}

interface CreateTeamspaceInput {
  name: string;
  icon?: string | null;
}

async function createTeamspace(input: CreateTeamspaceInput) {
  const response = await fetch("/api/teamspaces", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to create teamspace");
  }
  return response.json();
}

export function useCreateTeamspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTeamspace,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamspaceKeys.all });
    },
  });
}
