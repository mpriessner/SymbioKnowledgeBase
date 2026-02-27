"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useBacklinks, useForwardLinks } from "@/hooks/useBacklinks";
import { ConnectionItem } from "./ConnectionItem";

interface PageConnectionsPanelProps {
  pageId: string;
}

/**
 * Unified page connections panel showing both outgoing links
 * and backlinks with one-liner summaries and expandable details.
 *
 * Replaces the old BacklinksPanel with a richer, two-section layout.
 */
export function PageConnectionsPanel({ pageId }: PageConnectionsPanelProps) {
  const router = useRouter();

  // Collapse state persisted per page in localStorage
  const [forwardExpanded, setForwardExpanded] = useState(false);
  const [backExpanded, setBackExpanded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`conn-${pageId}`);
      if (saved) {
        const parsed = JSON.parse(saved) as { fwd?: boolean; back?: boolean };
        if (parsed.fwd !== undefined) setForwardExpanded(parsed.fwd);
        if (parsed.back !== undefined) setBackExpanded(parsed.back);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [pageId]);

  useEffect(() => {
    try {
      localStorage.setItem(
        `conn-${pageId}`,
        JSON.stringify({ fwd: forwardExpanded, back: backExpanded })
      );
    } catch {
      // Ignore localStorage errors
    }
  }, [pageId, forwardExpanded, backExpanded]);

  const forwardLinks = useForwardLinks(pageId);
  const backlinks = useBacklinks(pageId);

  const navigateToPage = useCallback(
    (targetPageId: string) => {
      router.push(`/pages/${targetPageId}`);
    },
    [router]
  );

  const fwdData = forwardLinks.data?.data ?? [];
  const fwdTotal = forwardLinks.data?.meta.total ?? 0;
  const backData = backlinks.data?.data ?? [];
  const backTotal = backlinks.data?.meta.total ?? 0;

  const hasAnyLinks = fwdTotal > 0 || backTotal > 0;
  const isLoading = forwardLinks.isLoading || backlinks.isLoading;

  if (forwardLinks.error && backlinks.error) return null;

  return (
    <div className="mt-8 border-t border-[var(--border-default)] pt-4">
      {/* Empty state */}
      {!isLoading && !hasAnyLinks && (
        <p className="text-sm text-[var(--text-tertiary)]">
          No connections yet. Add [[wikilinks]] to connect pages.
        </p>
      )}

      {/* Outgoing Links Section */}
      {(isLoading || fwdTotal > 0) && (
        <div className="mb-4">
          <button
            onClick={() => setForwardExpanded((prev) => !prev)}
            className="flex w-full items-center gap-2 text-left text-sm font-medium
                       text-[var(--text-secondary)] hover:text-[var(--text-primary)]
                       transition-colors duration-150"
            aria-expanded={forwardExpanded}
            aria-controls="forward-links-list"
          >
            <svg
              className={`h-4 w-4 transition-transform duration-200 ${
                forwardExpanded ? "rotate-90" : ""
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
              {forwardLinks.isLoading
                ? "Loading outgoing links..."
                : `Outgoing Links (${fwdTotal})`}
            </span>
          </button>

          {forwardExpanded && (
            <div
              id="forward-links-list"
              className="mt-2 space-y-0.5"
              role="list"
            >
              {forwardLinks.isLoading && (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-10 animate-pulse rounded bg-[var(--bg-secondary)]"
                    />
                  ))}
                </div>
              )}

              {!forwardLinks.isLoading && fwdData.length === 0 && (
                <p className="py-2 pl-6 text-sm text-[var(--text-tertiary)]">
                  This page doesn&apos;t link to any other pages
                </p>
              )}

              {!forwardLinks.isLoading &&
                fwdData.map((link) => (
                  <ConnectionItem
                    key={link.pageId}
                    pageId={link.pageId}
                    pageTitle={link.pageTitle}
                    pageIcon={link.pageIcon}
                    oneLiner={link.oneLiner}
                    summary={link.summary}
                    summaryUpdatedAt={link.summaryUpdatedAt}
                    onNavigate={navigateToPage}
                  />
                ))}
            </div>
          )}
        </div>
      )}

      {/* Backlinks Section */}
      {(isLoading || backTotal > 0) && (
        <div>
          <button
            onClick={() => setBackExpanded((prev) => !prev)}
            className="flex w-full items-center gap-2 text-left text-sm font-medium
                       text-[var(--text-secondary)] hover:text-[var(--text-primary)]
                       transition-colors duration-150"
            aria-expanded={backExpanded}
            aria-controls="backlinks-list"
          >
            <svg
              className={`h-4 w-4 transition-transform duration-200 ${
                backExpanded ? "rotate-90" : ""
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
              {backlinks.isLoading
                ? "Loading backlinks..."
                : `Backlinks (${backTotal})`}
            </span>
          </button>

          {backExpanded && (
            <div
              id="backlinks-list"
              className="mt-2 space-y-0.5"
              role="list"
            >
              {backlinks.isLoading && (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-10 animate-pulse rounded bg-[var(--bg-secondary)]"
                    />
                  ))}
                </div>
              )}

              {!backlinks.isLoading && backData.length === 0 && (
                <p className="py-2 pl-6 text-sm text-[var(--text-tertiary)]">
                  No pages link to this page yet
                </p>
              )}

              {!backlinks.isLoading &&
                backData.map((link) => (
                  <ConnectionItem
                    key={link.pageId}
                    pageId={link.pageId}
                    pageTitle={link.pageTitle}
                    pageIcon={link.pageIcon}
                    oneLiner={link.oneLiner}
                    summary={link.summary}
                    summaryUpdatedAt={link.summaryUpdatedAt}
                    onNavigate={navigateToPage}
                  />
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
