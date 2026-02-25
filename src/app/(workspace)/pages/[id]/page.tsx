"use client";

import { use, useEffect, useState, useRef, useCallback } from "react";
import type { Editor } from "@tiptap/react";
import { usePage } from "@/hooks/usePages";
import { useRecentPages } from "@/hooks/useRecentPages";
import { PageHeader } from "@/components/workspace/PageHeader";
import { PageContent } from "@/components/page/PageContent";
import { BacklinksPanel } from "@/components/page/BacklinksPanel";
import { LocalGraph } from "@/components/graph/LocalGraph";
import { LocalGraphSidebar } from "@/components/graph/LocalGraphSidebar";
import { PresenceIndicators } from "@/components/page/PresenceIndicators";
import { TableOfContents } from "@/components/page/TableOfContents";

interface PageViewProps {
  params: Promise<{ id: string }>;
}

export default function PageView({ params }: PageViewProps) {
  const { id } = use(params);
  const { data, isLoading, error } = usePage(id);
  const { addRecentPage } = useRecentPages();
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [editor, setEditor] = useState<Editor | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const handleEditorReady = useCallback((ed: Editor) => {
    setEditor(ed);
  }, []);

  // Record page visit for recent pages list
  const pageData = data?.data;
  useEffect(() => {
    if (pageData) {
      addRecentPage({
        id: pageData.id,
        title: pageData.title,
        icon: pageData.icon ?? null,
      });
    }
  }, [pageData?.id, addRecentPage]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div className="w-full content-pad py-8">
        {/* Title skeleton */}
        <div className="animate-pulse">
          <div className="h-10 bg-gray-200 rounded w-1/3 mb-4" />
          <div className="h-4 bg-gray-200 rounded w-full mb-2" />
          <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full content-pad py-8">
        <div className="text-red-600 bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="font-semibold text-lg mb-1">Error loading page</h2>
          <p className="text-sm">{error.message}</p>
        </div>
      </div>
    );
  }

  if (!data?.data) {
    return (
      <div className="w-full content-pad py-8">
        <p className="text-gray-500">Page not found.</p>
      </div>
    );
  }

  const page = data.data;

  return (
    <div className="relative flex-1 w-full h-full min-h-0">
      {/* Main content */}
      <div className="w-full h-full overflow-y-auto relative" ref={scrollContainerRef}>
        <PageHeader page={page} />

        {/* Presence Indicators */}
        <div className="w-full content-pad pb-2">
          <PresenceIndicators pageId={page.id} />
        </div>

        {/* Page Content (creation menu, database view, or block editor) */}
        <PageContent pageId={page.id} onEditorReady={handleEditorReady} />

        {/* Backlinks Panel */}
        <div className="w-full content-pad">
          <BacklinksPanel pageId={page.id} />
        </div>

        {/* Local Graph (bottom, expandable) */}
        <div className="w-full content-pad pb-8">
          <LocalGraph pageId={page.id} />
        </div>
      </div>

      {/* Table of Contents — outside scroll container so it stays fixed on scroll */}
      <TableOfContents editor={editor} scrollContainerRef={scrollContainerRef} />

      {/* Right Sidebar with LocalGraph — overlay positioned */}
      <div
        className={`
          hidden lg:flex flex-col
          absolute top-0 right-0 h-full
          border-l border-[var(--border-default)]
          bg-[var(--bg-secondary)]
          overflow-y-auto
          transition-all duration-200
          z-30
          ${showRightSidebar ? "w-[280px] sidebar-overlay-shadow" : "w-0 overflow-hidden"}
        `}
      >
        {showRightSidebar && (
          <>
            {/* LocalGraph in sidebar */}
            <LocalGraphSidebar pageId={page.id} className="border-b border-[var(--border-default)]" />

            {/* Space for additional sidebar content */}
            <div className="flex-1 p-3" />
          </>
        )}
      </div>

      {/* Sidebar toggle button — positioned below the Export button */}
      {showRightSidebar ? (
        <button
          onClick={() => setShowRightSidebar(false)}
          className="absolute right-[280px] top-12 z-30 hidden lg:flex items-center justify-center w-5 h-8 rounded-l bg-[var(--bg-secondary)] border border-r-0 border-[var(--border-default)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          title="Hide sidebar"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      ) : (
        <button
          onClick={() => setShowRightSidebar(true)}
          className="hidden lg:flex fixed right-0 top-12 z-30 items-center justify-center w-8 h-8 rounded-l bg-[var(--bg-secondary)] border border-r-0 border-[var(--border-default)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          title="Show sidebar"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
    </div>
  );
}
