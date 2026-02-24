"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import type { Page, CreatePageInput, UpdatePageInput } from "@/types/page";
import { z } from "zod";

const pageIdSchema = z.string().uuid();

interface ListPagesParams {
  limit?: number;
  offset?: number;
  sortBy?: "createdAt" | "updatedAt" | "title" | "position";
  order?: "asc" | "desc";
  parentId?: string | null;
}

interface ListPagesResponse {
  data: Page[];
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
}

interface SinglePageResponse {
  data: Page;
  meta: Record<string, unknown>;
}

async function fetchPages(params: ListPagesParams): Promise<ListPagesResponse> {
  const searchParams = new URLSearchParams();
  if (params.limit !== undefined) searchParams.set("limit", String(params.limit));
  if (params.offset !== undefined) searchParams.set("offset", String(params.offset));
  if (params.sortBy) searchParams.set("sortBy", params.sortBy);
  if (params.order) searchParams.set("order", params.order);
  if (params.parentId !== undefined) {
    searchParams.set("parentId", params.parentId === null ? "null" : params.parentId);
  }

  const response = await fetch(`/api/pages?${searchParams.toString()}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch pages");
  }
  return response.json();
}

async function fetchPage(id: string): Promise<SinglePageResponse> {
  const parsedId = pageIdSchema.safeParse(id);
  if (!parsedId.success) {
    throw new Error("Invalid page ID");
  }

  const response = await fetch(`/api/pages/${parsedId.data}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch page");
  }
  return response.json();
}

async function createPage(input: CreatePageInput): Promise<SinglePageResponse> {
  const response = await fetch("/api/pages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to create page");
  }
  return response.json();
}

async function updatePage({
  id,
  ...input
}: UpdatePageInput & { id: string }): Promise<SinglePageResponse> {
  const response = await fetch(`/api/pages/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to update page");
  }
  return response.json();
}

async function deletePage(id: string): Promise<void> {
  const response = await fetch(`/api/pages/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to delete page");
  }
}

// --- Query Keys ---

export const pageKeys = {
  all: ["pages"] as const,
  lists: () => [...pageKeys.all, "list"] as const,
  list: (params: ListPagesParams) => [...pageKeys.lists(), params] as const,
  details: () => [...pageKeys.all, "detail"] as const,
  detail: (id: string) => [...pageKeys.details(), id] as const,
  tree: () => [...pageKeys.all, "tree"] as const,
};

// --- Hooks ---

export function usePages(
  params: ListPagesParams = {},
  options?: Partial<UseQueryOptions<ListPagesResponse>>
) {
  return useQuery({
    queryKey: pageKeys.list(params),
    queryFn: () => fetchPages(params),
    ...options,
  });
}

export function usePage(id: string, options?: Partial<UseQueryOptions<SinglePageResponse>>) {
  const hasValidPageId = pageIdSchema.safeParse(id).success;

  return useQuery({
    queryKey: pageKeys.detail(id),
    queryFn: () => fetchPage(id),
    enabled: hasValidPageId,
    ...options,
  });
}

export function useCreatePage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pageKeys.lists() });
      queryClient.invalidateQueries({ queryKey: pageKeys.tree() });
    },
  });
}

export function useUpdatePage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updatePage,
    onSuccess: (data) => {
      queryClient.setQueryData(pageKeys.detail(data.data.id), data);
      queryClient.invalidateQueries({ queryKey: pageKeys.lists() });
      queryClient.invalidateQueries({ queryKey: pageKeys.tree() });
    },
  });
}

export function useDeletePage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deletePage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pageKeys.lists() });
      queryClient.invalidateQueries({ queryKey: pageKeys.tree() });
    },
  });
}
