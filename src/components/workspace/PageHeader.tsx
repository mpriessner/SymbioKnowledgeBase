"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useUpdatePage } from "@/hooks/usePages";
import type { Page } from "@/types/page";

interface PageHeaderProps {
  page: Page;
}

export function PageHeader({ page }: PageHeaderProps) {
  const [title, setTitle] = useState(page.title);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const updatePage = useUpdatePage();

  // Sync title when page data changes externally
  useEffect(() => {
    setTitle(page.title);
  }, [page.title]);

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

  return (
    <div className="w-full">
      {/* Cover Image Area */}
      {page.coverUrl && (
        <div className="relative w-full h-48 overflow-hidden rounded-b-lg">
          <img
            src={page.coverUrl}
            alt="Page cover"
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Icon and Title */}
      <div className="px-16 pt-8 pb-4 max-w-4xl mx-auto">
        {/* Icon */}
        {page.icon && (
          <div className="mb-2">
            <button
              className="text-5xl hover:bg-gray-100 rounded-lg p-2 transition-colors"
              aria-label="Change page icon"
            >
              {page.icon}
            </button>
          </div>
        )}

        {/* Add Icon / Add Cover buttons (when not set) */}
        {(!page.icon || !page.coverUrl) && (
          <div className="flex gap-2 mb-2 opacity-0 hover:opacity-100 transition-opacity">
            {!page.icon && (
              <button
                className="text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded px-2 py-1 transition-colors"
                aria-label="Add icon"
              >
                Add icon
              </button>
            )}
            {!page.coverUrl && (
              <button
                className="text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded px-2 py-1 transition-colors"
                aria-label="Add cover"
              >
                Add cover
              </button>
            )}
          </div>
        )}

        {/* Editable Title */}
        <h1
          ref={titleRef}
          contentEditable
          suppressContentEditableWarning
          className="text-4xl font-bold text-gray-900 outline-none focus:outline-none empty:before:content-['Untitled'] empty:before:text-gray-300 cursor-text"
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
