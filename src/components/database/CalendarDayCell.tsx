"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { CalendarEventPill } from "./CalendarEventPill";
import { dateToKey } from "@/lib/database/calendar-utils";
import type { RowProperties } from "@/types/database";

interface CalendarRow {
  id: string;
  pageId: string | null;
  properties: RowProperties;
  title: string;
  colorDot?: string | null;
}

interface CalendarDayCellProps {
  date: Date;
  rows: CalendarRow[];
  isToday: boolean;
  isCurrentMonth: boolean;
  maxVisible?: number;
  onAddRow: (date: Date) => void;
  onRowClick: (rowId: string, pageId: string | null) => void;
  onRowContextMenu?: (e: React.MouseEvent, rowId: string, title: string) => void;
}

export function CalendarDayCell({
  date,
  rows,
  isToday,
  isCurrentMonth,
  maxVisible = 3,
  onAddRow,
  onRowClick,
  onRowContextMenu,
}: CalendarDayCellProps) {
  const [expanded, setExpanded] = useState(false);
  const dayKey = dateToKey(date);

  const { setNodeRef, isOver } = useDroppable({
    id: `day-${dayKey}`,
    data: { type: "day", date: dayKey },
  });

  const visibleRows = expanded ? rows : rows.slice(0, maxVisible);
  const overflowCount = rows.length - maxVisible;

  return (
    <div
      ref={setNodeRef}
      className={`group relative min-h-[90px] border-b border-r border-[var(--border-default)] p-1
        transition-colors
        ${isCurrentMonth ? "" : "bg-[var(--bg-secondary)]/50"}
        ${isOver ? "bg-[var(--accent-primary)]/10" : ""}
        ${isToday ? "ring-1 ring-inset ring-[var(--accent-primary)]" : ""}`}
      data-testid={`calendar-day-${dayKey}`}
    >
      {/* Day number + add button */}
      <div className="flex items-center justify-between mb-0.5">
        <span
          className={`text-xs w-5 h-5 flex items-center justify-center rounded-full
            ${isToday ? "bg-[var(--accent-primary)] text-white font-semibold" : ""}
            ${isCurrentMonth ? "text-[var(--text-primary)]" : "text-[var(--text-tertiary)]"}`}
        >
          {date.getDate()}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddRow(date);
          }}
          className="w-4 h-4 flex items-center justify-center rounded opacity-0 group-hover:opacity-100
            text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-all"
          aria-label="Add row"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      {/* Event pills */}
      <div className="space-y-0.5">
        {visibleRows.map((row) => (
          <CalendarEventPill
            key={row.id}
            rowId={row.id}
            title={row.title}
            colorDot={row.colorDot}
            onClick={() => onRowClick(row.id, row.pageId)}
            onContextMenu={onRowContextMenu ? (e) => onRowContextMenu(e, row.id, row.title) : undefined}
          />
        ))}
      </div>

      {/* Overflow */}
      {!expanded && overflowCount > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(true);
          }}
          className="mt-0.5 text-[10px] text-[var(--accent-primary)] hover:underline cursor-pointer"
        >
          +{overflowCount} more
        </button>
      )}
      {expanded && overflowCount > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(false);
          }}
          className="mt-0.5 text-[10px] text-[var(--accent-primary)] hover:underline cursor-pointer"
        >
          Show less
        </button>
      )}
    </div>
  );
}
