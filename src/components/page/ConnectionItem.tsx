"use client";

import { useState, useCallback } from "react";

interface ConnectionItemProps {
  pageId: string;
  pageTitle: string;
  pageIcon: string | null;
  oneLiner: string | null;
  summary: string | null;
  summaryUpdatedAt: string | null;
  onNavigate: (pageId: string) => void;
}

function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMinutes > 0) return `${diffMinutes}m ago`;
  return "just now";
}

/**
 * A single link item in the connections panel.
 * Shows icon, title, one-liner, and an expandable summary.
 */
export function ConnectionItem({
  pageId,
  pageTitle,
  pageIcon,
  oneLiner,
  summary,
  summaryUpdatedAt,
  onNavigate,
}: ConnectionItemProps) {
  const [expanded, setExpanded] = useState(false);

  const handleExpand = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setExpanded((prev) => !prev);
    },
    []
  );

  return (
    <div
      role="listitem"
      className="group rounded-md hover:bg-[var(--bg-secondary)] transition-colors duration-100"
    >
      <div
        onClick={() => onNavigate(pageId)}
        className="flex items-center gap-2 px-2 py-1.5 cursor-pointer"
      >
        <span className="flex-shrink-0 text-base">
          {pageIcon || "\u{1F4C4}"}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--text-primary)] truncate max-w-[300px]">
            {pageTitle}
          </p>
          <p className="text-xs text-[var(--text-tertiary)] truncate">
            {oneLiner || (
              <span className="italic">No description</span>
            )}
          </p>
        </div>
        <button
          onClick={handleExpand}
          className="flex-shrink-0 p-1 text-[var(--text-tertiary)]
                     hover:text-[var(--text-secondary)] transition-colors"
          aria-label={expanded ? "Collapse summary" : "Expand summary"}
        >
          <svg
            className={`h-3 w-3 transition-transform duration-200 ${
              expanded ? "rotate-90" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>

      {expanded && (
        <div className="mx-2 mb-2 ml-8 rounded bg-[var(--bg-secondary)] p-2 text-xs">
          <p className="text-[var(--text-secondary)]">
            {summary || (
              <span className="italic text-[var(--text-tertiary)]">
                No summary available
              </span>
            )}
          </p>
          {summaryUpdatedAt && (
            <p className="mt-1 text-[var(--text-tertiary)]">
              Updated: {timeAgo(summaryUpdatedAt)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
