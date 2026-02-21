"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { TableView } from "@/components/database/TableView";
import type { DatabaseSchema } from "@/types/database";

interface DatabaseViewProps {
  params: Promise<{ id: string }>;
}

interface DatabaseResponse {
  data: {
    id: string;
    pageId: string;
    schema: DatabaseSchema;
    page: { title: string; icon: string | null };
  };
}

export default function DatabaseView({ params }: DatabaseViewProps) {
  const { id } = use(params);

  const { data, isLoading, error } = useQuery<DatabaseResponse>({
    queryKey: ["databases", id],
    queryFn: async () => {
      const res = await fetch(`/api/databases/${id}`);
      if (!res.ok) throw new Error("Failed to fetch database");
      return res.json() as Promise<DatabaseResponse>;
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-8 py-12">
        <div className="animate-pulse">
          <div className="h-8 w-48 rounded bg-[var(--bg-secondary)] mb-6" />
          <div className="h-10 w-full rounded bg-[var(--bg-secondary)] mb-2" />
          <div className="h-10 w-full rounded bg-[var(--bg-secondary)] mb-2" />
          <div className="h-10 w-full rounded bg-[var(--bg-secondary)]" />
        </div>
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="mx-auto max-w-6xl px-8 py-12">
        <div className="text-red-600 bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="font-semibold text-lg mb-1">Error loading database</h2>
          <p className="text-sm">
            {error?.message || "Database not found."}
          </p>
        </div>
      </div>
    );
  }

  const database = data.data;

  return (
    <div className="mx-auto max-w-6xl px-8 py-12">
      <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-1">
        {database.page.icon && (
          <span className="mr-2">{database.page.icon}</span>
        )}
        {database.page.title}
      </h1>
      <p className="mb-6 text-sm text-[var(--text-secondary)]">
        {database.schema.columns.length} columns
      </p>

      <TableView databaseId={database.id} schema={database.schema} />
    </div>
  );
}
