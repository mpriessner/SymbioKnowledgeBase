"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { DndSidebarTree } from "@/components/workspace/DndSidebarTree";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { usePageTree } from "@/hooks/usePageTree";
import { useCreatePage } from "@/hooks/usePages";
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse";

export function Sidebar() {
  const router = useRouter();
  const { data, isLoading, error } = usePageTree();
  const createPage = useCreatePage();
  const { isCollapsed, toggle: toggleSidebar } = useSidebarCollapse();

  const handleNewPage = useCallback(() => {
    createPage.mutate(
      { title: "Untitled" },
      {
        onSuccess: (data) => {
          router.push(`/pages/${data.data.id}`);
        },
      }
    );
  }, [createPage, router]);

  // Collapsed sidebar: narrow strip with toggle button
  if (isCollapsed) {
    return (
      <aside className="w-10 flex-shrink-0 border-r border-[var(--border-default)] bg-[var(--sidebar-bg)] flex flex-col items-center py-2">
        <button
          onClick={toggleSidebar}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-[var(--sidebar-hover)] transition-colors"
          aria-label="Expand sidebar"
          title="Expand sidebar"
        >
          <svg
            className="w-4 h-4 text-[var(--sidebar-text-secondary)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-64 flex-shrink-0 border-r border-[var(--border-default)] bg-[var(--sidebar-bg)] flex flex-col h-full overflow-hidden">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-default)]">
        <span className="text-sm font-semibold text-[var(--sidebar-text)] truncate">
          Pages
        </span>
        <div className="flex items-center gap-1">
          {/* New Page button */}
          <button
            onClick={handleNewPage}
            disabled={createPage.isPending}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--sidebar-hover)] transition-colors disabled:opacity-50"
            aria-label="Create new page"
            title="New page"
          >
            <svg
              className="w-4 h-4 text-[var(--sidebar-text-secondary)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>

          {/* Collapse sidebar button */}
          <button
            onClick={toggleSidebar}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--sidebar-hover)] transition-colors"
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
          >
            <svg
              className="w-4 h-4 text-[var(--sidebar-text-secondary)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Sidebar Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="px-3 py-4 space-y-2">
            {/* Loading skeleton */}
            {Array.from({ length: 5 }).map((_, i) => (
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
          <div className="px-3 py-4">
            <p className="text-sm text-[var(--danger)]">Failed to load pages</p>
            <p className="text-xs text-[var(--danger)] mt-1 opacity-75">{error.message}</p>
          </div>
        )}

        {data && <DndSidebarTree tree={data.data} />}
      </div>

      {/* Sidebar Footer with Theme Toggle */}
      <div className="border-t border-[var(--border-default)] px-3 py-2 flex items-center justify-between">
        <span className="text-xs text-[var(--sidebar-text-secondary)]">Theme</span>
        <ThemeToggle />
      </div>
    </aside>
  );
}
