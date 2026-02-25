"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { PropertyCell } from "./PropertyCell";
import type { Column, RowProperties, PropertyValue } from "@/types/database";

interface ListRowProps {
  rowId: string;
  title: string;
  properties: RowProperties;
  visibleColumns: Column[];
  isSelected: boolean;
  hasCheckbox: boolean;
  checkboxValue: boolean;
  onClick: () => void;
  onCheckboxToggle?: (checked: boolean) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export function ListRow({
  rowId,
  title,
  properties,
  visibleColumns,
  isSelected,
  hasCheckbox,
  checkboxValue,
  onClick,
  onCheckboxToggle,
  onContextMenu,
}: ListRowProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`group flex items-center gap-2 px-3 h-9 cursor-pointer border-b border-[var(--border-default)] transition-colors
        ${isSelected ? "bg-[var(--accent-primary)]/5" : "hover:bg-[var(--bg-hover)]"}`}
      data-testid={`list-row-${rowId}`}
    >
      {/* Checkbox */}
      {hasCheckbox && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCheckboxToggle?.(!checkboxValue);
          }}
          className="flex-shrink-0 text-sm cursor-pointer"
          aria-label={checkboxValue ? "Uncheck" : "Check"}
        >
          {checkboxValue ? "\u2705" : "\u2B1C"}
        </button>
      )}

      {/* Title */}
      <span className="flex-1 min-w-0 text-sm font-medium text-[var(--text-primary)] truncate">
        {title || "Untitled"}
      </span>

      {/* Property badges */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {visibleColumns.map((col) => {
          const value = properties[col.id];
          if (!value) return null;
          return (
            <span key={col.id} className="text-xs">
              <PropertyCell value={value} />
            </span>
          );
        })}
      </div>

      {/* More menu (visible on hover) */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (onContextMenu) {
            const rect = e.currentTarget.getBoundingClientRect();
            const syntheticEvent = {
              ...e,
              clientX: rect.right,
              clientY: rect.bottom,
              preventDefault: () => {},
            } as React.MouseEvent;
            onContextMenu(syntheticEvent);
          } else {
            setShowMenu(!showMenu);
          }
        }}
        className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100
          text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-all"
        aria-label="Row options"
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
