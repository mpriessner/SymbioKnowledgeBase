"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { HighlightedText } from "./HighlightedText";
import type { SearchResultItem } from "@/types/search";

interface SearchResultCardProps {
  result: SearchResultItem;
  isSelected: boolean;
  onSelect?: (pageId: string) => void;
  onHover?: () => void;
}

/**
 * Enhanced search result card showing:
 * - Page icon + title
 * - Snippet with highlighted keywords
 * - Relevance score (%)
 * - Last updated date
 */
export function SearchResultCard({
  result,
  isSelected,
  onSelect,
  onHover,
}: SearchResultCardProps) {
  const router = useRouter();

  const handleClick = useCallback(() => {
    if (onSelect) {
      onSelect(result.pageId);
    } else {
      router.push(`/pages/${result.pageId}`);
    }
  }, [onSelect, result.pageId, router]);

  const formattedDate = result.updatedAt
    ? new Date(result.updatedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <button
      role="option"
      aria-selected={isSelected}
      className={`
        w-full px-4 py-3 text-left cursor-pointer transition-colors duration-100
        border-b border-[var(--border-default)] last:border-b-0
        ${
          isSelected
            ? "bg-[var(--bg-hover)]"
            : "hover:bg-[var(--bg-hover)]"
        }
      `}
      onClick={handleClick}
      onMouseEnter={onHover}
    >
      {/* Header: icon, title, score */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className="flex-shrink-0 text-lg">
          {result.pageIcon || "\u{1F4C4}"}
        </span>
        <span className="flex-1 truncate text-sm font-medium text-[var(--text-primary)]">
          {result.pageTitle}
        </span>
        <span className="flex-shrink-0 text-xs font-semibold text-[var(--accent-primary)]">
          {Math.round(result.score * 100)}%
        </span>
      </div>

      {/* Snippet with highlighted terms */}
      <HighlightedText
        html={result.snippet}
        className="block pl-8 text-xs text-[var(--text-secondary)] line-clamp-2 mb-1.5"
        aria-label="Search result snippet"
      />

      {/* Footer: updated date */}
      {formattedDate && (
        <div className="pl-8 text-xs text-[var(--text-tertiary)]">
          Updated: {formattedDate}
        </div>
      )}
    </button>
  );
}
