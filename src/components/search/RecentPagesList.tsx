"use client";

import type { RecentPage } from "@/hooks/useRecentPages";

interface RecentPagesListProps {
  pages: RecentPage[];
  selectedIndex: number;
  onSelect: (pageId: string) => void;
  onHover: (index: number) => void;
}

/**
 * Renders a list of recently visited pages.
 * Shown in the Quick Switcher when the search input is empty.
 */
export function RecentPagesList({
  pages,
  selectedIndex,
  onSelect,
  onHover,
}: RecentPagesListProps) {
  if (pages.length === 0) {
    return (
      <div className="px-3 py-6 text-center text-sm text-[var(--text-secondary)]">
        No recent pages
      </div>
    );
  }

  return (
    <div className="py-1" role="listbox" aria-label="Recent pages">
      <div className="px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
        Recent
      </div>
      {pages.map((page, index) => (
        <button
          key={page.id}
          role="option"
          aria-selected={index === selectedIndex}
          className={`
            w-full px-3 py-2 text-left flex items-center gap-2
            cursor-pointer transition-colors duration-100
            ${
              index === selectedIndex
                ? "bg-[var(--bg-hover)]"
                : "hover:bg-[var(--bg-hover)]"
            }
          `}
          onClick={() => onSelect(page.id)}
          onMouseEnter={() => onHover(index)}
        >
          <span className="flex-shrink-0 text-base">
            {page.icon || "\u{1F4C4}"}
          </span>
          <span className="truncate text-sm text-[var(--text-primary)]">
            {page.title}
          </span>
          <span className="ml-auto text-xs text-[var(--text-secondary)]">
            {formatRelativeTime(page.visitedAt)}
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * Formats a timestamp into a relative time string.
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}
