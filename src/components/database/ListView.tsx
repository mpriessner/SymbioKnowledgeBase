"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useDatabaseRows } from "@/hooks/useDatabaseRows";
import { useTableFilters } from "@/hooks/useTableFilters";
import { FilterBar } from "./FilterBar";
import { ListRow } from "./ListRow";
import { PropertyVisibilityToggle } from "./PropertyVisibilityToggle";
import { GroupBySelector } from "./GroupBySelector";
import { groupRowsByColumn } from "@/lib/database/group-rows";
import { RowContextMenu } from "./RowContextMenu";
import type {
  DatabaseSchema,
  ViewConfig,
  Column,
  RowProperties,
} from "@/types/database";

interface ListViewProps {
  databaseId: string;
  schema: DatabaseSchema;
  viewConfig: ViewConfig;
  onViewConfigChange: (config: Partial<ViewConfig>) => void;
}

export function ListView({
  databaseId,
  schema,
  viewConfig,
  onViewConfigChange,
}: ListViewProps) {
  const router = useRouter();
  const { data, isLoading, createRow, updateRow, deleteRow } = useDatabaseRows(databaseId);
  const rows = useMemo(() => data?.data ?? [], [data?.data]);
  const [contextMenu, setContextMenu] = useState<{
    rowId: string;
    title: string;
    x: number;
    y: number;
  } | null>(null);

  const {
    filters,
    sort,
    addFilter,
    removeFilter,
    clearFilters,
    toggleSort,
    filteredRows,
  } = useTableFilters(rows);

  // Visible property columns
  const nonTitleColumns = schema.columns.filter((c) => c.type !== "TITLE");
  const defaultVisible = nonTitleColumns.slice(0, 2).map((c) => c.id);
  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>(
    viewConfig.list?.visibleProperties ?? defaultVisible
  );

  const visibleColumns = useMemo(
    () => schema.columns.filter((c) => visibleColumnIds.includes(c.id)),
    [schema.columns, visibleColumnIds]
  );

  // Checkbox column detection
  const checkboxColumn = schema.columns.find((c) => c.type === "CHECKBOX");

  // Grouping
  const selectColumns = schema.columns.filter(
    (c) => c.type === "SELECT" || c.type === "MULTI_SELECT"
  );
  const [groupByColumnId, setGroupByColumnId] = useState<string | null>(
    viewConfig.list?.groupByColumn ?? null
  );

  // Selection state
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  const handleToggleVisibility = useCallback(
    (columnId: string) => {
      setVisibleColumnIds((prev) => {
        const next = prev.includes(columnId)
          ? prev.filter((id) => id !== columnId)
          : [...prev, columnId];
        onViewConfigChange({
          list: {
            visibleProperties: next,
            groupByColumn: groupByColumnId ?? undefined,
          },
        });
        return next;
      });
    },
    [onViewConfigChange, groupByColumnId]
  );

  const handleRowClick = useCallback(
    (row: { id: string; pageId: string | null }) => {
      setSelectedRowId(row.id);
      if (row.pageId) {
        router.push(`/pages/${row.pageId}`);
      }
    },
    [router]
  );

  const handleCheckboxToggle = useCallback(
    (rowId: string, checked: boolean) => {
      if (!checkboxColumn) return;
      const row = rows.find((r) => r.id === rowId);
      if (!row) return;
      const updatedProperties: RowProperties = {
        ...(row.properties as RowProperties),
        [checkboxColumn.id]: { type: "CHECKBOX", value: checked },
      };
      updateRow.mutate({ rowId, properties: updatedProperties });
    },
    [checkboxColumn, rows, updateRow]
  );

  const handleAddRow = useCallback(() => {
    const titleColumn = schema.columns.find((c) => c.type === "TITLE");
    if (!titleColumn) return;
    createRow.mutate({
      [titleColumn.id]: { type: "TITLE", value: "Untitled" },
    });
  }, [schema.columns, createRow]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const rowList = filteredRows;
      if (!rowList.length) return;

      const currentIndex = selectedRowId
        ? rowList.findIndex((r) => r.id === selectedRowId)
        : -1;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.min(currentIndex + 1, rowList.length - 1);
        setSelectedRowId(rowList[next].id);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = Math.max(currentIndex - 1, 0);
        setSelectedRowId(rowList[prev].id);
      } else if (e.key === "Enter" && selectedRowId) {
        const row = rowList.find((r) => r.id === selectedRowId);
        if (row?.pageId) {
          router.push(`/pages/${row.pageId}`);
        }
      } else if (e.key === "Escape") {
        setSelectedRowId(null);
      }
    },
    [filteredRows, selectedRowId, router]
  );

  function getTitle(row: { properties: RowProperties; page?: { title: string } | null }): string {
    for (const val of Object.values(row.properties)) {
      if (val.type === "TITLE") return val.value as string;
    }
    return row.page?.title ?? "Untitled";
  }

  if (isLoading) {
    return (
      <div className="space-y-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-9 animate-pulse rounded bg-[var(--bg-secondary)]"
          />
        ))}
      </div>
    );
  }

  // Optionally group rows
  const groupByColumn = groupByColumnId
    ? schema.columns.find((c) => c.id === groupByColumnId)
    : null;

  const groups: [string, typeof filteredRows][] = groupByColumn?.options
    ? Array.from(
        groupRowsByColumn(filteredRows, groupByColumnId!, groupByColumn.options).entries()
      )
    : [["", filteredRows]];

  return (
    <div onKeyDown={handleKeyDown} tabIndex={0} className="outline-none">
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <PropertyVisibilityToggle
          columns={schema.columns}
          visibleColumnIds={visibleColumnIds}
          onToggle={handleToggleVisibility}
        />
        {selectColumns.length > 0 && groupByColumnId && (
          <GroupBySelector
            columns={schema.columns}
            selectedColumnId={groupByColumnId}
            onSelect={(id) => setGroupByColumnId(id)}
          />
        )}
        <FilterBar
          columns={schema.columns}
          filters={filters}
          onAddFilter={addFilter}
          onRemoveFilter={removeFilter}
          onClearAll={clearFilters}
        />
      </div>

      {/* List */}
      <div className="border border-[var(--border-default)] rounded-lg overflow-hidden">
        {filteredRows.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-[var(--text-secondary)]">
            {filters.length > 0
              ? "No items match the current filter."
              : "No items yet. Click + to add your first item."}
          </div>
        ) : (
          groups.map(([groupLabel, groupRows]) => (
            <div key={groupLabel}>
              {groupLabel && (
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--bg-secondary)] border-b border-[var(--border-default)]">
                  {groupLabel} — {groupRows.length}
                </div>
              )}
              {groupRows.map((row) => {
                const checkboxValue =
                  checkboxColumn && row.properties[checkboxColumn.id]?.type === "CHECKBOX"
                    ? (row.properties[checkboxColumn.id].value as boolean)
                    : false;

                return (
                  <ListRow
                    key={row.id}
                    rowId={row.id}
                    title={getTitle(row)}
                    properties={row.properties as RowProperties}
                    visibleColumns={visibleColumns}
                    isSelected={selectedRowId === row.id}
                    hasCheckbox={!!checkboxColumn}
                    checkboxValue={checkboxValue}
                    onClick={() => handleRowClick(row)}
                    onCheckboxToggle={(checked) =>
                      handleCheckboxToggle(row.id, checked)
                    }
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenu({
                        rowId: row.id,
                        title: getTitle(row),
                        x: e.clientX,
                        y: e.clientY,
                      });
                    }}
                  />
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Add row */}
      <button
        onClick={handleAddRow}
        disabled={createRow.isPending}
        className="mt-2 w-full flex items-center justify-center gap-1 rounded-md border border-dashed
          border-[var(--border-default)] px-3 py-2 text-sm text-[var(--text-secondary)]
          hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]
          transition-colors disabled:opacity-50"
      >
        <Plus className="w-3.5 h-3.5" />
        {createRow.isPending ? "Creating..." : "Add row"}
      </button>

      {contextMenu && (
        <RowContextMenu
          rowId={contextMenu.rowId}
          rowTitle={contextMenu.title}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onDelete={(rowId) => deleteRow.mutate(rowId)}
          onClose={() => setContextMenu(null)}
          isDeleting={deleteRow.isPending}
        />
      )}
    </div>
  );
}
