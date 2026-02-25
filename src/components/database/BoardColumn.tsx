"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { BoardCard } from "./BoardCard";
import type { Column, RowProperties } from "@/types/database";

interface DbRowWithPage {
  id: string;
  databaseId: string;
  pageId: string | null;
  properties: RowProperties;
  page: { id: string; title: string; icon: string | null } | null;
}

interface BoardColumnProps {
  columnValue: string;
  label: string;
  rows: DbRowWithPage[];
  visibleColumns: Column[];
  onAddRow: () => void;
  onCardClick: (row: DbRowWithPage) => void;
  isOver?: boolean;
}

export function BoardColumn({
  columnValue,
  label,
  rows,
  visibleColumns,
  onAddRow,
  onCardClick,
}: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${columnValue}`,
    data: { type: "column", columnValue },
  });

  const rowIds = rows.map((r) => r.id);

  // Extract title from properties
  function getTitle(row: DbRowWithPage): string {
    for (const val of Object.values(row.properties)) {
      if (val.type === "TITLE") return val.value as string;
    }
    return row.page?.title ?? "Untitled";
  }

  return (
    <div
      className="flex-shrink-0 w-64 flex flex-col bg-[var(--bg-secondary)] rounded-lg"
      data-testid={`board-column-${columnValue}`}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wide">
            {label}
          </span>
          <span className="text-[10px] text-[var(--text-tertiary)] bg-[var(--bg-tertiary)] rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center">
            {rows.length}
          </span>
        </div>
        <button
          onClick={onAddRow}
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          aria-label={`Add row to ${label}`}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Cards container */}
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[60px] px-2 pb-2 space-y-2 overflow-y-auto rounded-b-lg transition-colors ${
          isOver ? "bg-[var(--accent-primary)]/5" : ""
        }`}
      >
        <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
          {rows.length === 0 ? (
            <p className="text-xs text-[var(--text-tertiary)] text-center py-4">
              No items
            </p>
          ) : (
            rows.map((row) => (
              <BoardCard
                key={row.id}
                rowId={row.id}
                title={getTitle(row)}
                properties={row.properties}
                visibleColumns={visibleColumns}
                onClick={() => onCardClick(row)}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}
