"use client";

import { useState, useCallback } from "react";
import { usePageSummary, useUpdatePageSummary } from "@/hooks/usePageSummary";

interface PageAboutSectionProps {
  pageId: string;
}

const ONE_LINER_MAX = 100;
const SUMMARY_MAX = 500;

function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  if (diffHours > 0)
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffMinutes > 0)
    return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  return "just now";
}

/**
 * "About This Page" section displaying and editing page summaries.
 * Shows one-liner, summary paragraph, and last-updated timestamp.
 */
export function PageAboutSection({ pageId }: PageAboutSectionProps) {
  const { data, isLoading, error } = usePageSummary(pageId);
  const updateMutation = useUpdatePageSummary(pageId);

  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editOneLiner, setEditOneLiner] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);

  const summaryData = data?.data;

  const startEditing = useCallback(() => {
    setEditOneLiner(summaryData?.oneLiner ?? "");
    setEditSummary(summaryData?.summary ?? "");
    setSaveError(null);
    setIsEditing(true);
    setIsExpanded(true);
  }, [summaryData]);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setSaveError(null);
  }, []);

  const handleSave = useCallback(async () => {
    setSaveError(null);
    try {
      await updateMutation.mutateAsync({
        oneLiner: editOneLiner,
        summary: editSummary,
      });
      setIsEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    }
  }, [editOneLiner, editSummary, updateMutation]);

  if (error) return null;

  return (
    <div className="mt-6 border-t border-[var(--border-default)] pt-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsExpanded((prev) => !prev)}
          className="flex items-center gap-2 text-left text-sm font-medium
                     text-[var(--text-secondary)] hover:text-[var(--text-primary)]
                     transition-colors duration-150"
          aria-expanded={isExpanded}
          aria-controls="about-this-page"
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
          <span>About This Page</span>
        </button>

        {isExpanded && !isEditing && (
          <button
            onClick={startEditing}
            className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]
                       transition-colors duration-150"
          >
            Edit
          </button>
        )}
      </div>

      {/* Content */}
      {isExpanded && (
        <div id="about-this-page" className="mt-3 space-y-3">
          {isLoading && (
            <div className="space-y-2">
              <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--bg-secondary)]" />
              <div className="h-12 animate-pulse rounded bg-[var(--bg-secondary)]" />
            </div>
          )}

          {!isLoading && !isEditing && (
            <>
              <div>
                <p className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
                  One-liner
                </p>
                <p className="text-sm text-[var(--text-primary)]">
                  {summaryData?.oneLiner || (
                    <span className="italic text-[var(--text-tertiary)]">
                      No one-liner set
                    </span>
                  )}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
                  Summary
                </p>
                <p className="text-sm text-[var(--text-primary)]">
                  {summaryData?.summary || (
                    <span className="italic text-[var(--text-tertiary)]">
                      No summary set
                    </span>
                  )}
                </p>
              </div>

              <p className="text-xs text-[var(--text-tertiary)]">
                Last updated:{" "}
                {summaryData?.summaryUpdatedAt
                  ? timeAgo(summaryData.summaryUpdatedAt)
                  : "Never"}
              </p>

              <button
                disabled
                className="text-xs px-2 py-1 rounded border border-[var(--border-default)]
                           text-[var(--text-tertiary)] opacity-50 cursor-not-allowed"
                title="Configure LLM API key to enable"
              >
                Regenerate with AI
              </button>
            </>
          )}

          {!isLoading && isEditing && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-1 block">
                  One-liner
                </label>
                <input
                  type="text"
                  value={editOneLiner}
                  onChange={(e) => setEditOneLiner(e.target.value)}
                  maxLength={ONE_LINER_MAX}
                  className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-primary)]
                             px-2 py-1.5 text-sm text-[var(--text-primary)]
                             focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                  placeholder="Brief description of this page..."
                />
                <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
                  {editOneLiner.length}/{ONE_LINER_MAX}
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-1 block">
                  Summary
                </label>
                <textarea
                  value={editSummary}
                  onChange={(e) => setEditSummary(e.target.value)}
                  maxLength={SUMMARY_MAX}
                  rows={3}
                  className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-primary)]
                             px-2 py-1.5 text-sm text-[var(--text-primary)] resize-none
                             focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                  placeholder="2-4 sentences about this page's scope and content..."
                />
                <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
                  {editSummary.length}/{SUMMARY_MAX}
                </p>
              </div>

              {saveError && (
                <p className="text-xs text-red-500">{saveError}</p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                  className="text-xs px-3 py-1 rounded bg-[var(--color-accent)] text-white
                             hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {updateMutation.isPending ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={cancelEditing}
                  className="text-xs px-3 py-1 rounded border border-[var(--border-default)]
                             text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]
                             transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
