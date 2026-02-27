"use client";

import { useState, useRef, useEffect } from "react";
import { useDraggable } from "@dnd-kit/core";
import type { RowProperties } from "@/types/database";

interface CalendarEventPillProps {
  rowId: string;
  title: string;
  colorDot?: string | null;
  onClick: () => void;
  onDoubleClick?: () => void;
  onTitleSave?: (newTitle: string) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export function CalendarEventPill({
  rowId,
  title,
  colorDot,
  onClick,
  onDoubleClick,
  onTitleSave,
  onContextMenu,
}: CalendarEventPillProps) {
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: rowId,
    data: { type: "event", rowId },
  });

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = (newTitle: string) => {
    if (newTitle !== title) {
      onTitleSave?.(newTitle);
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div
        className="px-1.5 py-0.5"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          defaultValue={title}
          className="w-full text-[11px] leading-tight bg-transparent border border-[var(--border-strong)] rounded px-1 py-0.5 outline-none
            focus:ring-1 focus:ring-[var(--accent-primary)] text-[var(--text-primary)]"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave(e.currentTarget.value);
            else if (e.key === "Escape") setIsEditing(false);
          }}
          onBlur={(e) => handleSave(e.currentTarget.value)}
        />
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        if (onTitleSave) {
          setIsEditing(true);
        } else {
          onClick();
        }
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick?.();
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
