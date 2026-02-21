"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { RowProperties } from "@/types/database";

interface DbRowWithPage {
  id: string;
  databaseId: string;
  pageId: string | null;
  properties: RowProperties;
  page: { id: string; title: string; icon: string | null } | null;
}

interface RowsResponse {
  data: DbRowWithPage[];
  meta: { total: number };
}

export function useDatabaseRows(databaseId: string) {
  const queryClient = useQueryClient();

  const query = useQuery<RowsResponse>({
    queryKey: ["databases", databaseId, "rows"],
    queryFn: async () => {
      const res = await fetch(`/api/databases/${databaseId}/rows`);
      if (!res.ok) throw new Error("Failed to fetch rows");
      return res.json() as Promise<RowsResponse>;
    },
  });

  const createRow = useMutation({
    mutationFn: async (properties: RowProperties) => {
      const res = await fetch(`/api/databases/${databaseId}/rows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ properties }),
      });
      if (!res.ok) throw new Error("Failed to create row");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["databases", databaseId, "rows"],
      });
    },
  });

  const updateRow = useMutation({
    mutationFn: async ({
      rowId,
      properties,
    }: {
      rowId: string;
      properties: RowProperties;
    }) => {
      const res = await fetch(
        `/api/databases/${databaseId}/rows/${rowId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ properties }),
        }
      );
      if (!res.ok) throw new Error("Failed to update row");
      return res.json();
    },
    onMutate: async ({ rowId, properties }) => {
      await queryClient.cancelQueries({
        queryKey: ["databases", databaseId, "rows"],
      });

      const previous = queryClient.getQueryData<RowsResponse>([
        "databases",
        databaseId,
        "rows",
      ]);

      queryClient.setQueryData<RowsResponse>(
        ["databases", databaseId, "rows"],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.map((row) =>
              row.id === rowId ? { ...row, properties } : row
            ),
          };
        }
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ["databases", databaseId, "rows"],
          context.previous
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["databases", databaseId, "rows"],
      });
    },
  });

  const deleteRow = useMutation({
    mutationFn: async (rowId: string) => {
      const res = await fetch(
        `/api/databases/${databaseId}/rows/${rowId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete row");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["databases", databaseId, "rows"],
      });
    },
  });

  return { ...query, createRow, updateRow, deleteRow };
}
