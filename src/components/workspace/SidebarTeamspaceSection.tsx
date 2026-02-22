"use client";

import { useState, useEffect, type ReactNode } from "react";
import { DndSidebarTree } from "@/components/workspace/DndSidebarTree";
import type { PageTreeNode } from "@/types/page";

interface SidebarTeamspaceSectionProps {
  sectionId: string;
  label: string;
  icon: ReactNode;
  badge?: string;
  isLoading: boolean;
  error: Error | null;
  tree: PageTreeNode[];
}

export function SidebarTeamspaceSection({
  sectionId,
  label,
  icon,
  badge,
  isLoading,
  error,
  tree,
}: SidebarTeamspaceSectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(
      `sidebar-section-${sectionId}-collapsed`
    );
    if (stored !== null) {
      setCollapsed(stored === "true");
    }
  }, [sectionId]);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(
      `sidebar-section-${sectionId}-collapsed`,
      String(next)
    );
  };

  return (
    <div>
      <button
        onClick={toggleCollapsed}
        className="w-full flex items-center gap-2 px-3 py-1.5 group"
      >
        <svg
          className={`w-3 h-3 text-[var(--sidebar-text-secondary)] transition-transform flex-shrink-0 ${
            collapsed ? "" : "rotate-90"
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.25 4.5l7.5 7.5-7.5 7.5"
          />
        </svg>
        <span className="text-[var(--sidebar-text-secondary)] flex-shrink-0">
          {icon}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--sidebar-text-secondary)] truncate">
          {label}
        </span>
        {badge && (
          <span className="text-[10px] text-[var(--sidebar-text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity ml-auto flex-shrink-0">
            {badge}
          </span>
        )}
      </button>

      {!collapsed && (
        <div>
          {isLoading && (
            <div className="px-3 py-2 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 animate-pulse">
                  <div className="w-4 h-4 bg-[var(--bg-tertiary)] rounded" />
                  <div
                    className="h-3 bg-[var(--bg-tertiary)] rounded"
                    style={{ width: `${60 + i * 20}px` }}
                  />
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="px-3 py-2">
              <p className="text-xs text-[var(--danger)]">
                Failed to load pages
              </p>
            </div>
          )}

          {!isLoading && !error && tree.length === 0 && (
            <div className="px-5 py-2">
              <p className="text-xs text-[var(--sidebar-text-secondary)] opacity-60">
                No pages yet
              </p>
            </div>
          )}

          {!isLoading && !error && tree.length > 0 && (
            <DndSidebarTree tree={tree} />
          )}
        </div>
      )}
    </div>
  );
}
