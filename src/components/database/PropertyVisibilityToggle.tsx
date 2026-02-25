"use client";

import { useState, useRef, useEffect } from "react";
import { Eye } from "lucide-react";
import type { Column } from "@/types/database";

interface PropertyVisibilityToggleProps {
  columns: Column[];
  visibleColumnIds: string[];
  onToggle: (columnId: string) => void;
}

export function PropertyVisibilityToggle({
  columns,
  visibleColumnIds,
  onToggle,
}: PropertyVisibilityToggleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Only non-TITLE columns are toggleable
  const toggleableColumns = columns.filter((c) => c.type !== "TITLE");

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
        <Eye className="w-3 h-3" />
        Properties
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 z-50 mt-1 w-48 rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] py-1 shadow-lg">
          {toggleableColumns.map((col) => {
            const isVisible = visibleColumnIds.includes(col.id);
            return (
              <label
                key={col.id}
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={isVisible}
                  onChange={() => onToggle(col.id)}
                  className="rounded"
                />
                {col.name}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
