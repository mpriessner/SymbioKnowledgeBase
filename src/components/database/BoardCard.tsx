"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PropertyCell } from "./PropertyCell";
import type { Column, RowProperties, PropertyValue } from "@/types/database";

interface BoardCardProps {
  rowId: string;
  title: string;
  properties: RowProperties;
  visibleColumns: Column[];
  onClick: () => void;
}

export function BoardCard({
  rowId,
  title,
  properties,
  visibleColumns,
  onClick,
}: BoardCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: rowId,
    data: { type: "card" },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)]
        p-3 shadow-sm cursor-grab active:cursor-grabbing
        hover:border-[var(--border-strong)] transition-colors"
      data-testid={`board-card-${rowId}`}
    >
      <p className="text-sm font-medium text-[var(--text-primary)] mb-1.5 line-clamp-2">
        {title || "Untitled"}
      </p>

      {visibleColumns.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {visibleColumns.slice(0, 3).map((col) => {
            const value = properties[col.id];
            if (!value) return null;
            return (
              <div key={col.id} className="text-xs">
                <PropertyCell value={value} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Simplified card for the DragOverlay (no sortable hooks).
 */
export function BoardCardOverlay({
  title,
  properties,
  visibleColumns,
}: {
  title: string;
  properties: RowProperties;
  visibleColumns: Column[];
}) {
  return (
    <div
      className="rounded-lg border border-[var(--accent-primary)] bg-[var(--bg-primary)]
        p-3 shadow-lg rotate-2 w-64"
    >
      <p className="text-sm font-medium text-[var(--text-primary)] mb-1.5 line-clamp-2">
        {title || "Untitled"}
      </p>
      {visibleColumns.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {visibleColumns.slice(0, 3).map((col) => {
            const value = properties[col.id];
            if (!value) return null;
            return (
              <div key={col.id} className="text-xs">
                <PropertyCell value={value} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
