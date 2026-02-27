"use client";

import { useState, useCallback, useRef } from "react";
import { Download } from "lucide-react";
import { useUpdatePage } from "@/hooks/usePages";
import { EmojiPicker } from "@/components/workspace/EmojiPicker";
import { CoverImageManager } from "@/components/workspace/CoverImageManager";
import { FavoriteButton } from "@/components/page/FavoriteButton";
import { ShareButton } from "@/components/page/ShareButton";
import type { Page } from "@/types/page";

interface PageHeaderProps {
  page: Page;
}

export function PageHeader({ page }: PageHeaderProps) {
  const [title, setTitle] = useState(page.title);
  const [lastSyncedTitle, setLastSyncedTitle] = useState(page.title);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showCoverInput, setShowCoverInput] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const updatePage = useUpdatePage();

  // Sync title when page data changes externally (React recommended pattern)
  if (page.title !== lastSyncedTitle) {
    setLastSyncedTitle(page.title);
    setTitle(page.title);
  }

  const handleTitleBlur = useCallback(() => {
    const newTitle = title.trim() || "Untitled";
    if (newTitle !== page.title) {
      updatePage.mutate({ id: page.id, title: newTitle });
    }
  }, [title, page.id, page.title, updatePage]);

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLHeadingElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        titleRef.current?.blur();
      }
    },
    []
  );

  const handleIconSelect = useCallback(
    (emoji: string) => {
      updatePage.mutate({ id: page.id, icon: emoji });
    },
    [page.id, updatePage]
  );

  const handleIconRemove = useCallback(() => {
    updatePage.mutate({ id: page.id, icon: null });
  }, [page.id, updatePage]);

  const handleCoverSave = useCallback(
    (url: string) => {
      updatePage.mutate({ id: page.id, coverUrl: url });
      setShowCoverInput(false);
    },
    [page.id, updatePage]
  );

  const handleCoverRemove = useCallback(() => {
    updatePage.mutate({ id: page.id, coverUrl: null });
  }, [page.id, updatePage]);

  const handleExportMarkdown = useCallback(async () => {
    try {
      const res = await fetch(`/api/pages/${page.id}/export`);
      if (!res.ok) {
        console.error("Export failed:", res.status, res.statusText);
        return;
      }

      // Verify we got markdown content, not an error JSON
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        console.error("Export returned JSON instead of markdown");
        return;
      }

      const text = await res.text();
      if (!text || text.trim().length === 0) {
        console.error("Export returned empty content");
        return;
      }

      // Create a proper markdown blob with explicit type
      const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      // Extract filename from Content-Disposition or build from title
      const dispositionFilename = res.headers
        .get("content-disposition")
        ?.match(/filename="(.+)"/)?.[1];
      link.download = dispositionFilename || `${page.title || "untitled"}.md`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export markdown error:", error);
    }
  }, [page.id, page.title]);

  return (
    <div className="w-full">
      {/* Action buttons - top right */}
      <div className="absolute right-4 top-2 z-10 flex items-center gap-1">
        <button
          onClick={handleExportMarkdown}
          className="rounded p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors"
          title="Export as Markdown"
          aria-label="Export as Markdown"
        >
          <Download className="h-4 w-4" />
        </button>
        <FavoriteButton pageId={page.id} />
        <ShareButton pageId={page.id} pageTitle={page.title} />
      </div>

      {/* Cover Image Area */}
      {(page.coverUrl || showCoverInput) && (
        <CoverImageManager
          coverUrl={page.coverUrl}
          onSave={handleCoverSave}
          onRemove={handleCoverRemove}
        />
      )}

      {/* Icon and Title */}
      <div className="content-pad pt-8 pb-4">
        {/* Icon with emoji picker */}
        {page.icon && (
          <div className="mb-2 relative">
            <button
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              className="text-5xl hover:bg-[var(--bg-hover)] rounded-lg p-2 transition-colors"
              aria-label="Change page icon"
            >
              {page.icon}
            </button>
            {showEmojiPicker && (
              <EmojiPicker
                onSelect={handleIconSelect}
                onRemove={handleIconRemove}
                onClose={() => setShowEmojiPicker(false)}
              />
            )}
          </div>
        )}

        {/* Add Icon / Add Cover buttons (when not set) */}
        <div
          className={`
            flex gap-2 mb-2 transition-opacity
            ${!page.icon || !page.coverUrl ? "opacity-0 hover:opacity-100" : "hidden"}
          `}
        >
          {!page.icon && (
            <div className="relative">
              <button
                onClick={() => setShowEmojiPicker((prev) => !prev)}
                className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded px-2 py-1 transition-colors flex items-center gap-1"
                aria-label="Add icon"
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
                    d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z"
                  />
                </svg>
                Add icon
              </button>
              {showEmojiPicker && (
                <EmojiPicker
                  onSelect={handleIconSelect}
                  onClose={() => setShowEmojiPicker(false)}
                />
              )}
            </div>
          )}
          {!page.coverUrl && (
            <button
              onClick={() => setShowCoverInput(true)}
              className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded px-2 py-1 transition-colors flex items-center gap-1"
              aria-label="Add cover"
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
                  d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
                />
              </svg>
              Add cover
            </button>
          )}
        </div>

        {/* Editable Title */}
        <h1
          ref={titleRef}
          contentEditable
          suppressContentEditableWarning
          className="text-4xl font-bold text-[var(--text-primary)] outline-none focus:outline-none empty:before:content-['Untitled'] empty:before:text-[var(--text-tertiary)] cursor-text"
          onBlur={handleTitleBlur}
          onKeyDown={handleTitleKeyDown}
          onInput={(e) => setTitle(e.currentTarget.textContent || "")}
          role="textbox"
          aria-label="Page title"
        >
          {page.title}
        </h1>
      </div>
    </div>
  );
}
