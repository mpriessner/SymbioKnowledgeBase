"use client";

import {
  Table2,
  KanbanSquare,
  List,
  Calendar,
  LayoutGrid,
  GanttChart,
  Plus,
} from "lucide-react";
import type { DatabaseViewType } from "@/types/database";

interface ViewSwitcherProps {
  activeView: DatabaseViewType;
  onViewChange: (view: DatabaseViewType) => void;
}

const VIEW_OPTIONS: {
  type: DatabaseViewType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { type: "table", label: "Table", icon: Table2 },
  { type: "board", label: "Board", icon: KanbanSquare },
  { type: "list", label: "List", icon: List },
  { type: "calendar", label: "Calendar", icon: Calendar },
  { type: "gallery", label: "Gallery", icon: LayoutGrid },
  { type: "timeline", label: "Timeline", icon: GanttChart },
];

export function ViewSwitcher({ activeView, onViewChange }: ViewSwitcherProps) {
  return (
    <div
      className="flex items-center gap-0.5 border-b border-[var(--border-default)] px-1 pb-0"
      role="tablist"
      aria-label="Database view"
    >
      {VIEW_OPTIONS.map(({ type, label, icon: Icon }) => {
        const isActive = activeView === type;
        return (
          <button
            key={type}
            role="tab"
            aria-selected={isActive}
            onClick={() => onViewChange(type)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors
              border-b-2 -mb-px
              ${
                isActive
                  ? "border-[var(--accent-primary)] text-[var(--text-primary)]"
                  : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-default)]"
              }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        );
      })}

      {/* Future: Add saved view button */}
      <button
        disabled
        className="inline-flex items-center gap-1 px-2 py-2 text-xs text-[var(--text-tertiary)]
          border-b-2 border-transparent -mb-px opacity-50 cursor-not-allowed"
        title="Saved views (coming soon)"
        aria-label="Add saved view (coming soon)"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
