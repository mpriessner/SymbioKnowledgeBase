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

      {/* Compact floating graph window */}
      {showRightSidebar && (
        <div
          className="hidden lg:flex flex-col
            absolute top-16 right-4 w-72 h-80
            rounded-xl border border-[var(--border-default)]
            bg-[var(--bg-secondary)]
            shadow-xl overflow-hidden
            transition-all duration-200
            z-30"
        >
          <LocalGraphSidebar
            pageId={page.id}
            onClose={() => setShowRightSidebar(false)}
          />
        </div>
      )}

      {/* Graph toggle button (visible when graph is closed) */}
      {!showRightSidebar && (
        <button
          onClick={() => setShowRightSidebar(true)}
          className="hidden lg:flex absolute right-4 top-12 z-30 items-center justify-center w-8 h-8 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] shadow-sm transition-colors"
          title="Show graph"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75H6A2.25 2.25 0 003.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0120.25 6v1.5M20.25 16.5V18A2.25 2.25 0 0118 20.25h-1.5M3.75 16.5V18A2.25 2.25 0 006 20.25h1.5M12 8.25v7.5M8.25 12h7.5" />
          </svg>
        </button>
      )}
    </div>
  );
}
