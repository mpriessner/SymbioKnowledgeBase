"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useBacklinks } from "@/hooks/useBacklinks";

interface BacklinksPanelProps {
  pageId: string;
}

/**
 * Collapsible panel showing all pages that link to the current page.
 *
 * Rendered below the block editor on each page view.
 * Shows a count in the header ("3 backlinks") and a list of
 * linking pages with icons and titles. Clicking a backlink
 * navigates to the source page.
 */
export function BacklinksPanel({ pageId }: BacklinksPanelProps) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(true);
  const { data, isLoading, error } = useBacklinks(pageId);

  const backlinks = data?.data ?? [];
  const total = data?.meta.total ?? 0;

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const navigateToPage = useCallback(
    (targetPageId: string) => {
      router.push(`/pages/${targetPageId}`);
    },
    [router]
  );

  if (error) {
    return null;
  }

  return (
    <div className="mt-8 border-t border-[var(--border-default)] pt-4">
      {/* Header — click to toggle */}
      <button
        onClick={toggleExpanded}
        className="flex w-full items-center gap-2 text-left text-sm font-medium
                   text-[var(--text-secondary)] hover:text-[var(--text-primary)]
                   transition-colors duration-150"
        aria-expanded={isExpanded}
        aria-controls="backlinks-list"
      >
        <svg
          className={`h-4 w-4 transition-transform duration-200 ${
            isExpanded ? "rotate-90" : ""
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
        <span>
          {isLoading
            ? "Loading backlinks..."
            : `${total} ${total === 1 ? "backlink" : "backlinks"}`}
        </span>
      </button>

      {/* Backlinks list */}
      {isExpanded && (
        <div id="backlinks-list" className="mt-3 space-y-1" role="list">
          {isLoading && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-8 animate-pulse rounded bg-[var(--bg-secondary)]"
                />
              ))}
            </div>
          )}

          {!isLoading && backlinks.length === 0 && (
            <p className="py-2 text-sm text-[var(--text-secondary)]">
              No pages link to this page yet.
            </p>
          )}

          {!isLoading &&
            backlinks.map((backlink) => (
              <button
                key={backlink.pageId}
                role="listitem"
                onClick={() => navigateToPage(backlink.pageId)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm
                           text-[var(--text-primary)]
                           hover:bg-[var(--bg-secondary)]
                           transition-colors duration-100 cursor-pointer text-left"
              >
                <span className="flex-shrink-0 text-base">
                  {backlink.pageIcon || "\u{1F4C4}"}
                </span>
                <span className="truncate">{backlink.pageTitle}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
