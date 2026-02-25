"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import type { Column } from "@/types/database";

interface GroupBySelectorProps {
  columns: Column[];
  selectedColumnId: string;
  onSelect: (columnId: string) => void;
}

export function GroupBySelector({
  columns,
  selectedColumnId,
  onSelect,
}: GroupBySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Only show SELECT and MULTI_SELECT columns
  const groupableColumns = columns.filter(
    (c) => c.type === "SELECT" || c.type === "MULTI_SELECT"
  );

  const selectedColumn = columns.find((c) => c.id === selectedColumnId);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-[var(--text-secondary)]
          rounded border border-[var(--border-default)]
          hover:bg-[var(--bg-hover)] transition-colors"
      >
        <span>Group by:</span>
        <span className="font-medium text-[var(--text-primary)]">
          {selectedColumn?.name ?? "—"}
        </span>
        <ChevronDown className="w-3 h-3" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 z-50 mt-1 w-48 rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] py-1 shadow-lg">
          {groupableColumns.length === 0 ? (
            <p className="px-3 py-2 text-xs text-[var(--text-tertiary)]">
              No Select columns available
            </p>
          ) : (
            groupableColumns.map((col) => (
              <button
                key={col.id}
                onClick={() => {
                  onSelect(col.id);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-xs transition-colors
                  ${
                    col.id === selectedColumnId
                      ? "bg-[var(--bg-hover)] text-[var(--text-primary)] font-medium"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                  }`}
              >
                {col.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
