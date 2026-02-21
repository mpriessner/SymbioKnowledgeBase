"use client";

import { useRouter } from "next/navigation";
import { useCallback, forwardRef } from "react";
import DOMPurify from "dompurify";
import type { SearchResultItem } from "@/types/search";

interface SearchResultsProps {
  /** Search results to display */
  results: SearchResultItem[];
  /** Whether search is in progress */
  isLoading: boolean;
  /** The search query (for empty state messaging) */
  query: string;
  /** Index of the currently highlighted result (keyboard navigation) */
  selectedIndex: number;
  /** Callback when a result is selected */
  onSelect?: (pageId: string) => void;
  /** Callback when mouse enters a result (for updating selectedIndex) */
  onHover?: (index: number) => void;
}

/**
 * Renders search results as a list of cards.
 *
 * Each card shows:
 * - Page icon (or default document icon)
 * - Page title
 * - Snippet with highlighted matching terms (from ts_headline)
 *
 * The snippet HTML is sanitized with DOMPurify to prevent XSS
 * while preserving <mark> tags for highlighting.
 */
export const SearchResults = forwardRef<HTMLDivElement, SearchResultsProps>(
  function SearchResults(
    { results, isLoading, query, selectedIndex, onSelect, onHover },
    ref
  ) {
    const router = useRouter();

    const handleSelect = useCallback(
      (pageId: string) => {
        if (onSelect) {
          onSelect(pageId);
        } else {
          router.push(`/pages/${pageId}`);
        }
      },
      [onSelect, router]
    );

    // Loading skeleton
    if (isLoading) {
      return (
        <div className="space-y-2 py-2" ref={ref}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="px-3 py-2">
              <div className="h-4 w-48 animate-pulse rounded bg-[var(--bg-secondary)]" />
              <div className="mt-2 h-3 w-full animate-pulse rounded bg-[var(--bg-secondary)]" />
              <div className="mt-1 h-3 w-3/4 animate-pulse rounded bg-[var(--bg-secondary)]" />
            </div>
          ))}
        </div>
      );
    }

    // Empty state: no query entered yet
    if (query.length === 0) {
      return (
        <div
          className="px-3 py-6 text-center text-sm text-[var(--text-secondary)]"
          ref={ref}
        >
          Type to search your knowledge base
        </div>
      );
    }

    // No results found
    if (results.length === 0) {
      return (
        <div
          className="px-3 py-6 text-center text-sm text-[var(--text-secondary)]"
          ref={ref}
        >
          No results found for &quot;{query}&quot;
        </div>
      );
    }

    // Results list
    return (
      <div className="max-h-96 overflow-y-auto py-1" ref={ref} role="listbox">
        {results.map((result, index) => (
          <button
            key={result.pageId}
            role="option"
            aria-selected={index === selectedIndex}
            className={`
              w-full px-3 py-2.5 text-left cursor-pointer transition-colors duration-100
              ${
                index === selectedIndex
                  ? "bg-[var(--bg-hover)]"
                  : "hover:bg-[var(--bg-hover)]"
              }
            `}
            onClick={() => handleSelect(result.pageId)}
            onMouseEnter={() => onHover?.(index)}
          >
            {/* Page title with icon */}
            <div className="flex items-center gap-2">
              <span className="flex-shrink-0 text-base">
                {result.pageIcon || "\u{1F4C4}"}
              </span>
              <span className="truncate text-sm font-medium text-[var(--text-primary)]">
                {result.pageTitle}
              </span>
              <span className="ml-auto flex-shrink-0 text-xs text-[var(--text-secondary)]">
                {Math.round(result.score * 100)}%
              </span>
            </div>

            {/* Snippet with highlighted terms */}
            <div
              className="mt-1 pl-7 text-xs text-[var(--text-secondary)] line-clamp-2
                         [&_mark]:bg-yellow-200 [&_mark]:text-[var(--text-primary)]
                         dark:[&_mark]:bg-yellow-800 dark:[&_mark]:text-yellow-100"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(result.snippet, {
                  ALLOWED_TAGS: ["mark"],
                }),
              }}
            />
          </button>
        ))}
      </div>
    );
  }
);
