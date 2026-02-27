"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { getAncestryFromTree } from "@/hooks/usePageTree";
import type { PageTreeNode } from "@/types/page";

interface BreadcrumbsProps {
  tree: PageTreeNode[];
  currentPageId: string;
  /** Optional right-aligned actions (e.g. export, favorite, share buttons) */
  actions?: React.ReactNode;
}

/** Maximum number of visible breadcrumb segments before truncation kicks in. */
const MAX_VISIBLE_SEGMENTS = 4;

export function Breadcrumbs({ tree, currentPageId, actions }: BreadcrumbsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const ancestry = useMemo(
    () => getAncestryFromTree(tree, currentPageId),
    [tree, currentPageId]
  );

  // Reset expansion when navigating to a different page
  // Using a ref to track previous pageId avoids the useMemo side-effect pattern
  const [prevPageId, setPrevPageId] = useState(currentPageId);
  if (currentPageId !== prevPageId) {
    setPrevPageId(currentPageId);
    setIsExpanded(false);
  }

  if (ancestry.length === 0) {
    return null;
  }

  // Determine which segments to show
  let visibleSegments = ancestry;
  let showEllipsis = false;

  if (!isExpanded && ancestry.length > MAX_VISIBLE_SEGMENTS) {
    // Show: first segment, "...", last two segments
    const first = ancestry[0];
    const lastTwo = ancestry.slice(-2);
    visibleSegments = [first, ...lastTwo];
    showEllipsis = true;
  }

  const lastIndex = visibleSegments.length - 1;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center justify-between w-full content-pad py-2">
      <div className="flex items-center min-w-0">
      {/* Home breadcrumb */}
      <Link
        href="/"
        className="flex items-center text-sm text-gray-400 hover:text-gray-600 transition-colors"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
          />
        </svg>
      </Link>

      <BreadcrumbSeparator />

      {visibleSegments.map((segment, index) => {
        const isLast = index === lastIndex;
        const isFirstAndNeedEllipsis = showEllipsis && index === 0;

        return (
          <span key={segment.id} className="flex items-center">
            {isLast ? (
              // Current page — plain text, not clickable
              <span className="text-sm text-gray-700 font-medium flex items-center gap-1">
                {segment.icon && <span className="text-xs">{segment.icon}</span>}
                <span className="truncate max-w-[200px]">{segment.title}</span>
              </span>
            ) : (
              // Ancestor page — clickable link
              <Link
                href={`/pages/${segment.id}`}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
              >
                {segment.icon && <span className="text-xs">{segment.icon}</span>}
                <span className="truncate max-w-[150px]">{segment.title}</span>
              </Link>
            )}

            {/* Separator after non-last items */}
            {!isLast && <BreadcrumbSeparator />}

            {/* Ellipsis after first segment when truncated */}
            {isFirstAndNeedEllipsis && (
              <>
                <button
                  onClick={() => setIsExpanded(true)}
                  className="text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded px-1 py-0.5 transition-colors"
                  aria-label="Show full breadcrumb path"
                  title="Show all ancestor pages"
                >
                  ...
                </button>
                <BreadcrumbSeparator />
              </>
            )}
          </span>
        );
      })}
      </div>
      {actions && <div className="flex-shrink-0 ml-2">{actions}</div>}
    </nav>
  );
}

function BreadcrumbSeparator() {
  return (
    <svg
      className="w-4 h-4 text-gray-300 mx-1 flex-shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}
