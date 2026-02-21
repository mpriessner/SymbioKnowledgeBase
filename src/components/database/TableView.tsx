"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDatabaseRows } from "@/hooks/useDatabaseRows";
import { useTableFilters } from "@/hooks/useTableFilters";
import { PropertyCell } from "./PropertyCell";
import { PropertyEditor } from "./PropertyEditor";
import { FilterBar } from "./FilterBar";
import type {
  Column,
  DatabaseSchema,
  PropertyValue,
  RowProperties,
} from "@/types/database";

interface TableViewProps {
  databaseId: string;
  schema: DatabaseSchema;
}

interface EditingCell {
  rowId: string;
  columnId: string;
}

export function TableView({ databaseId, schema }: TableViewProps) {
  const router = useRouter();
  const { data, isLoading, createRow, updateRow } =
    useDatabaseRows(databaseId);
  const rows = data?.data ?? [];

  const {
    filters,
    sort,
    addFilter,
    removeFilter,
    clearFilters,
    toggleSort,
    filteredRows,
  } = useTableFilters(rows);

  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);

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

  const handleCellClick = useCallback(
    (e: React.MouseEvent, rowId: string, column: Column) => {
      e.stopPropagation();
      // Checkbox toggles immediately, no edit mode needed
      if (column.type === "CHECKBOX") return;
      setEditingCell({ rowId, columnId: column.id });
    },
    []
  );

  const handleSave = useCallback(
    (rowId: string, columnId: string, newValue: PropertyValue) => {
      const row = rows.find((r) => r.id === rowId);
      if (!row) return;

      const updatedProperties: RowProperties = {
        ...(row.properties as RowProperties),
        [columnId]: newValue,
      };

      updateRow.mutate({ rowId, properties: updatedProperties });
      setEditingCell(null);
    },
    [rows, updateRow]
  );

  const handleCheckboxToggle = useCallback(
    (
      rowId: string,
      columnId: string,
      currentValue: PropertyValue | undefined
    ) => {
      const checked =
        currentValue?.type === "CHECKBOX" ? currentValue.value : false;
      const row = rows.find((r) => r.id === rowId);
      if (!row) return;

      const updatedProperties: RowProperties = {
        ...(row.properties as RowProperties),
        [columnId]: { type: "CHECKBOX" as const, value: !checked },
      };

      updateRow.mutate({ rowId, properties: updatedProperties });
    },
    [rows, updateRow]
  );

  const handleCancel = useCallback(() => {
    setEditingCell(null);
  }, []);

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
      {/* Filter bar */}
      <FilterBar
        columns={schema.columns}
        filters={filters}
        onAddFilter={addFilter}
        onRemoveFilter={removeFilter}
        onClearAll={clearFilters}
      />

      <table className="w-full border-collapse text-sm">
        {/* Column headers with sort */}
        <thead>
          <tr className="border-b border-[var(--border-default)]">
            {orderedColumns.map((column) => (
              <th
                key={column.id}
                onClick={() => toggleSort(column.id)}
                className="cursor-pointer select-none px-3 py-2 text-left text-xs
                           font-medium uppercase tracking-wider text-[var(--text-secondary)]
                           hover:text-[var(--text-primary)] transition-colors"
              >
                <span className="inline-flex items-center gap-1">
                  {column.name}
                  {sort?.columnId === column.id && (
                    <span className="text-[var(--accent-primary)]">
                      {sort.direction === "asc" ? "\u2191" : "\u2193"}
                    </span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>

        {/* Rows */}
        <tbody>
          {filteredRows.length === 0 && (
            <tr>
              <td
                colSpan={orderedColumns.length}
                className="px-3 py-8 text-center text-sm text-[var(--text-secondary)]"
              >
                {filters.length > 0
                  ? "No rows match the current filters."
                  : 'No rows yet. Click "Add row" to create one.'}
              </td>
            </tr>
          )}

          {filteredRows.map((row) => (
            <tr
              key={row.id}
              onClick={() => handleRowClick(row.pageId)}
              className="border-b border-[var(--border-default)] cursor-pointer
                         hover:bg-[var(--bg-hover)] transition-colors"
            >
              {orderedColumns.map((column) => {
                const isEditing =
                  editingCell?.rowId === row.id &&
                  editingCell?.columnId === column.id;
                const cellValue = (row.properties as RowProperties)[column.id];

                return (
                  <td
                    key={column.id}
                    className="px-3 py-2"
                    onClick={(e) => handleCellClick(e, row.id, column)}
                  >
                    {isEditing ? (
                      <PropertyEditor
                        column={column}
                        value={cellValue}
                        onSave={(val) => handleSave(row.id, column.id, val)}
                        onCancel={handleCancel}
                      />
                    ) : column.type === "CHECKBOX" ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCheckboxToggle(row.id, column.id, cellValue);
                        }}
                        className="text-lg cursor-pointer"
                        aria-label={
                          cellValue?.type === "CHECKBOX" && cellValue.value
                            ? "Uncheck"
                            : "Check"
                        }
                      >
                        {cellValue?.type === "CHECKBOX" && cellValue.value
                          ? "\u2705"
                          : "\u2B1C"}
                      </button>
                    ) : column.type === "TITLE" ? (
                      <span className="font-medium text-[var(--text-primary)]">
                        {cellValue?.type === "TITLE"
                          ? cellValue.value
                          : row.page?.title ?? "Untitled"}
                      </span>
                    ) : (
                      <PropertyCell value={cellValue} />
                    )}
                  </td>
                );
              })}
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
