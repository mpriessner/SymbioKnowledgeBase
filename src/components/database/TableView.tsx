"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDatabaseRows } from "@/hooks/useDatabaseRows";
import { PropertyCell } from "./PropertyCell";
import type { DatabaseSchema, RowProperties } from "@/types/database";

interface TableViewProps {
  databaseId: string;
  schema: DatabaseSchema;
}

export function TableView({ databaseId, schema }: TableViewProps) {
  const router = useRouter();
  const { data, isLoading, createRow } = useDatabaseRows(databaseId);
  const rows = data?.data ?? [];

  // Order columns: TITLE first, then the rest
  const orderedColumns = [...schema.columns].sort((a, b) => {
    if (a.type === "TITLE") return -1;
    if (b.type === "TITLE") return 1;
    return 0;
  });

  const handleRowClick = useCallback(
    (pageId: string | null) => {
      if (pageId) {
        router.push(`/pages/${pageId}`);
      }
    },
    [router]
  );

  const handleAddRow = useCallback(() => {
    const titleColumn = schema.columns.find((c) => c.type === "TITLE");
    if (!titleColumn) return;

    const defaultProperties: RowProperties = {
      [titleColumn.id]: { type: "TITLE", value: "Untitled" },
    };

    createRow.mutate(defaultProperties);
  }, [schema.columns, createRow]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-10 animate-pulse rounded bg-[var(--bg-secondary)]"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        {/* Column headers */}
        <thead>
          <tr className="border-b border-[var(--border-default)]">
            {orderedColumns.map((column) => (
              <th
                key={column.id}
                className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider
                           text-[var(--text-secondary)]"
              >
                {column.name}
              </th>
            ))}
          </tr>
        </thead>

        {/* Rows */}
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={orderedColumns.length}
                className="px-3 py-8 text-center text-sm text-[var(--text-secondary)]"
              >
                No rows yet. Click &quot;Add row&quot; to create one.
              </td>
            </tr>
          )}

          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => handleRowClick(row.pageId)}
              className="border-b border-[var(--border-default)] cursor-pointer
                         hover:bg-[var(--bg-hover)] transition-colors"
            >
              {orderedColumns.map((column) => (
                <td key={column.id} className="px-3 py-2">
                  {column.type === "TITLE" ? (
                    <span className="font-medium text-[var(--text-primary)]">
                      {(row.properties as RowProperties)[column.id]?.type ===
                      "TITLE"
                        ? (
                            (row.properties as RowProperties)[column.id] as {
                              type: "TITLE";
                              value: string;
                            }
                          ).value
                        : row.page?.title ?? "Untitled"}
                    </span>
                  ) : (
                    <PropertyCell
                      value={(row.properties as RowProperties)[column.id]}
                    />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Add row button */}
      <button
        onClick={handleAddRow}
        disabled={createRow.isPending}
        className="mt-2 w-full rounded-md border border-dashed border-[var(--border-default)]
                   px-3 py-2 text-sm text-[var(--text-secondary)]
                   hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]
                   transition-colors disabled:opacity-50"
      >
        {createRow.isPending ? "Creating..." : "+ Add row"}
      </button>
    </div>
  );
}
