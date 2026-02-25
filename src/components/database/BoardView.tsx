"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { useDatabaseRows } from "@/hooks/useDatabaseRows";
import { useTableFilters } from "@/hooks/useTableFilters";
import { FilterBar } from "./FilterBar";
import { BoardColumn } from "./BoardColumn";
import { BoardCardOverlay } from "./BoardCard";
import { GroupBySelector } from "./GroupBySelector";
import { groupRowsByColumn } from "@/lib/database/group-rows";
import type {
  DatabaseSchema,
  ViewConfig,
  Column,
  RowProperties,
} from "@/types/database";

interface BoardViewProps {
  databaseId: string;
  schema: DatabaseSchema;
  viewConfig: ViewConfig;
  onViewConfigChange: (config: Partial<ViewConfig>) => void;
}

interface DbRowWithPage {
  id: string;
  databaseId: string;
  pageId: string | null;
  properties: RowProperties;
  page: { id: string; title: string; icon: string | null } | null;
}

export function BoardView({
  databaseId,
  schema,
  viewConfig,
  onViewConfigChange,
}: BoardViewProps) {
  const router = useRouter();
  const { data, isLoading, createRow, updateRow } =
    useDatabaseRows(databaseId);
  const rows = useMemo(() => (data?.data ?? []) as DbRowWithPage[], [data?.data]);

  const {
    filters,
    addFilter,
    removeFilter,
    clearFilters,
    filteredRows,
  } = useTableFilters(rows);

  // Determine group-by column
  const selectColumns = schema.columns.filter(
    (c) => c.type === "SELECT" || c.type === "MULTI_SELECT"
  );
  const configuredGroupBy = viewConfig.board?.groupByColumn;
  const [groupByColumnId, setGroupByColumnId] = useState<string>(
    configuredGroupBy && selectColumns.some((c) => c.id === configuredGroupBy)
      ? configuredGroupBy
      : selectColumns[0]?.id ?? ""
  );

  const groupByColumn = schema.columns.find((c) => c.id === groupByColumnId);

  // Visible property columns (non-title, non-group-by)
  const visibleColumns = useMemo(
    () =>
      schema.columns.filter(
        (c) =>
          c.type !== "TITLE" && c.id !== groupByColumnId
      ),
    [schema.columns, groupByColumnId]
  );

  // Group rows
  const groupedRows = useMemo(() => {
    if (!groupByColumn || !groupByColumn.options) {
      return new Map<string, DbRowWithPage[]>([["Uncategorized", filteredRows as DbRowWithPage[]]]);
    }
    return groupRowsByColumn(
      filteredRows as DbRowWithPage[],
      groupByColumnId,
      groupByColumn.options
    );
  }, [filteredRows, groupByColumnId, groupByColumn]);

  // DnD state
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const activeRow = useMemo(
    () => (activeId ? rows.find((r) => r.id === activeId) : null),
    [activeId, rows]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over) return;

      const rowId = active.id as string;
      const overData = over.data.current;

      // Determine target column value
      let targetColumnValue: string | null = null;
      if (overData?.type === "column") {
        targetColumnValue = overData.columnValue;
      } else if (overData?.type === "card") {
        // Dropped on another card — find which column that card is in
        for (const [colVal, colRows] of groupedRows) {
          if (colRows.some((r) => r.id === over.id)) {
            targetColumnValue = colVal;
            break;
          }
        }
      }

      if (targetColumnValue === null) return;

      // Find the row's current group value
      const row = rows.find((r) => r.id === rowId);
      if (!row) return;

      const currentValue =
        row.properties[groupByColumnId]?.type === "SELECT"
          ? (row.properties[groupByColumnId].value as string)
          : "";

      if (currentValue === targetColumnValue) return;
      if (targetColumnValue === "Uncategorized") return; // Can't drop into uncategorized

      // Optimistic update via useDatabaseRows
      const updatedProperties: RowProperties = {
        ...row.properties,
        [groupByColumnId]: { type: "SELECT", value: targetColumnValue },
      };

      updateRow.mutate({ rowId, properties: updatedProperties });
    },
    [rows, groupedRows, groupByColumnId, updateRow]
  );

  const handleGroupByChange = useCallback(
    (columnId: string) => {
      setGroupByColumnId(columnId);
      onViewConfigChange({
        board: { groupByColumn: columnId },
      });
    },
    [onViewConfigChange]
  );

  const handleAddRow = useCallback(
    (columnValue: string) => {
      const titleColumn = schema.columns.find((c) => c.type === "TITLE");
      if (!titleColumn) return;

      const properties: RowProperties = {
        [titleColumn.id]: { type: "TITLE", value: "Untitled" },
      };

      // Pre-set the group-by column value
      if (columnValue !== "Uncategorized" && groupByColumnId) {
        properties[groupByColumnId] = {
          type: "SELECT",
          value: columnValue,
        };
      }

      createRow.mutate(properties);
    },
    [schema.columns, groupByColumnId, createRow]
  );

  const handleCardClick = useCallback(
    (row: DbRowWithPage) => {
      if (row.pageId) {
        router.push(`/pages/${row.pageId}`);
      }
    },
    [router]
  );

  // Get title from active row
  function getTitle(row: DbRowWithPage): string {
    for (const val of Object.values(row.properties)) {
      if (val.type === "TITLE") return val.value as string;
    }
    return row.page?.title ?? "Untitled";
  }

  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-x-auto p-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="w-64 h-48 animate-pulse rounded-lg bg-[var(--bg-secondary)]"
          />
        ))}
      </div>
    );
  }

  if (selectColumns.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-[var(--text-secondary)]">
        <div className="text-center">
          <p className="font-medium">No Select columns found</p>
          <p className="mt-1 text-[var(--text-tertiary)]">
            Add a Select column to use Board view
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <GroupBySelector
          columns={schema.columns}
          selectedColumnId={groupByColumnId}
          onSelect={handleGroupByChange}
        />
        <FilterBar
          columns={schema.columns}
          filters={filters}
          onAddFilter={addFilter}
          onRemoveFilter={removeFilter}
          onClearAll={clearFilters}
        />
      </div>

      {/* Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4 min-h-[200px]">
          {Array.from(groupedRows.entries()).map(([columnValue, columnRows]) => (
            <BoardColumn
              key={columnValue}
              columnValue={columnValue}
              label={columnValue}
              rows={columnRows}
              visibleColumns={visibleColumns}
              onAddRow={() => handleAddRow(columnValue)}
              onCardClick={handleCardClick}
            />
          ))}
        </div>

        <DragOverlay>
          {activeRow ? (
            <BoardCardOverlay
              title={getTitle(activeRow)}
              properties={activeRow.properties}
              visibleColumns={visibleColumns}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Empty state */}
      {rows.length === 0 && (
        <div className="text-center py-8 text-sm text-[var(--text-secondary)]">
          No items yet. Click + to add one.
        </div>
      )}
    </div>
  );
}
