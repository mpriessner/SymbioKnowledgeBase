"use client";

import { useDraggable } from "@dnd-kit/core";
import type { RowProperties } from "@/types/database";

interface CalendarEventPillProps {
  rowId: string;
  title: string;
  colorDot?: string | null;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export function CalendarEventPill({
  rowId,
  title,
  colorDot,
  onClick,
  onContextMenu,
}: CalendarEventPillProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: rowId,
    data: { type: "event", rowId },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onContextMenu={onContextMenu}
      className={`flex items-center gap-1 px-1.5 py-0.5 text-[11px] leading-tight rounded cursor-grab
        bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] transition-colors truncate
        ${isDragging ? "opacity-30" : ""}`}
      data-testid={`calendar-pill-${rowId}`}
    >
      {colorDot && (
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: colorDot }}
        />
      )}
      <span className="truncate">{title || "Untitled"}</span>
    </div>
  );
}

/** Overlay ghost used during drag */
export function CalendarEventPillOverlay({
  title,
  colorDot,
}: {
  title: string;
  colorDot?: string | null;
}) {
  return (
    <div className="flex items-center gap-1 px-1.5 py-0.5 text-[11px] leading-tight rounded
      bg-[var(--bg-secondary)] shadow-lg border border-[var(--border-default)] truncate max-w-[180px]">
      {colorDot && (
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: colorDot }}
        />
      )}
      <span className="truncate">{title || "Untitled"}</span>
    </div>
  );
}
