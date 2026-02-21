"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/graph", label: "Graph View", icon: "\u{1F578}\u{FE0F}" },
  { href: "/settings", label: "Settings", icon: "\u{2699}\u{FE0F}" },
] as const;

export default function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <>
      {/* Mobile overlay backdrop */}
      {!isCollapsed && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setIsCollapsed(true)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 z-30 h-full
          bg-[var(--sidebar-bg)] border-r border-[var(--border-default)]
          transition-all duration-200 ease-in-out
          ${isCollapsed ? "w-0 overflow-hidden" : "w-[var(--sidebar-width)]"}
          lg:relative lg:z-auto
        `}
      >
        <div className="flex h-full w-[var(--sidebar-width)] flex-col">
          {/* Header */}
          <div className="flex h-12 items-center justify-between px-3">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm font-semibold text-[var(--sidebar-text)]"
            >
              <span className="text-lg">{"\u{1F4DA}"}</span>
              <span>SymbioKB</span>
            </Link>
            <button
              onClick={() => setIsCollapsed(true)}
              className="rounded p-1 text-[var(--sidebar-text-secondary)] hover:bg-[var(--sidebar-hover)] lg:hidden"
              aria-label="Close sidebar"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M12 4L4 12M4 4l8 8" />
              </svg>
            </button>
          </div>

          {/* New Page button */}
          <div className="px-3 py-1">
            <button
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm
                text-[var(--sidebar-text-secondary)] hover:bg-[var(--sidebar-hover)]"
              aria-label="Create new page"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M8 3v10M3 8h10" />
              </svg>
              <span>New Page</span>
            </button>
          </div>

          {/* Navigation */}
          <nav className="mt-2 flex-1 overflow-y-auto px-3" aria-label="Sidebar navigation">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center gap-2 rounded px-2 py-1.5 text-sm
                    transition-colors duration-100
                    ${
                      isActive
                        ? "bg-[var(--sidebar-active)] text-[var(--sidebar-text)] font-medium"
                        : "text-[var(--sidebar-text-secondary)] hover:bg-[var(--sidebar-hover)]"
                    }
                  `}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {/* Separator */}
            <div className="my-3 border-t border-[var(--border-default)]" />

            {/* Page tree placeholder */}
            <div className="px-2">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--sidebar-text-secondary)]">
                Pages
              </p>
              <p className="text-xs text-[var(--text-tertiary)]">
                Page tree will be implemented in Epic 3.
              </p>
            </div>
          </nav>

          {/* Footer */}
          <div className="border-t border-[var(--border-default)] px-3 py-2">
            <p className="text-xs text-[var(--sidebar-text-secondary)]">
              SymbioKnowledgeBase
            </p>
          </div>
        </div>
      </aside>

      {/* Mobile toggle button (visible when sidebar is collapsed on mobile) */}
      {isCollapsed && (
        <button
          onClick={() => setIsCollapsed(false)}
          className="fixed left-3 top-3 z-20 rounded-lg border border-[var(--border-default)]
            bg-[var(--bg-primary)] p-2 shadow-sm lg:hidden"
          aria-label="Open sidebar"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M3 4h12M3 9h12M3 14h12" />
          </svg>
        </button>
      )}
    </>
  );
}
