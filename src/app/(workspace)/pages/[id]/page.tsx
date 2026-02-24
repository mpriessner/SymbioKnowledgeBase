"use client";

import { use, useEffect, useState } from "react";
import { usePage } from "@/hooks/usePages";
import { useRecentPages } from "@/hooks/useRecentPages";
import { PageHeader } from "@/components/workspace/PageHeader";
import { BlockEditor } from "@/components/editor/BlockEditor";
import { BacklinksPanel } from "@/components/page/BacklinksPanel";
import { LocalGraph } from "@/components/graph/LocalGraph";
import { LocalGraphSidebar } from "@/components/graph/LocalGraphSidebar";
import { PresenceIndicators } from "@/components/page/PresenceIndicators";

interface PageViewProps {
  params: Promise<{ id: string }>;
}

export default function PageView({ params }: PageViewProps) {
  const { id } = use(params);
  const { data, isLoading, error } = usePage(id);
  const { addRecentPage } = useRecentPages();
  const [showRightSidebar, setShowRightSidebar] = useState(true);

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
    <div className="flex min-h-screen">
      {/* Main content */}
      <div className="flex-1 min-w-0">
        <PageHeader page={page} />

        {/* Presence Indicators */}
      <div className="w-full content-pad pb-2">
          <PresenceIndicators pageId={page.id} />
        </div>

        {/* Block Editor */}
        <div className="w-full">
          <BlockEditor pageId={page.id} />
        </div>

        {/* Backlinks Panel */}
      <div className="w-full content-pad">
          <BacklinksPanel pageId={page.id} />
        </div>

        {/* Local Graph (bottom, expandable) */}
      <div className="w-full content-pad pb-8">
          <LocalGraph pageId={page.id} />
        </div>
      </div>

      {/* Right Sidebar with LocalGraph */}
      <div
        className={`
          hidden lg:flex flex-col
          border-l border-[var(--color-border)]
          bg-[var(--color-bg-secondary)]
          transition-all duration-200
          ${showRightSidebar ? "w-[280px]" : "w-0 overflow-hidden"}
        `}
      >
        {/* Sidebar toggle */}
        <button
          onClick={() => setShowRightSidebar(!showRightSidebar)}
          className="absolute right-[280px] top-4 z-20 hidden lg:flex items-center justify-center w-5 h-8 rounded-l bg-[var(--color-bg-secondary)] border border-r-0 border-[var(--color-border)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
          title={showRightSidebar ? "Hide sidebar" : "Show sidebar"}
          style={{ display: showRightSidebar ? "flex" : "none" }}
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {showRightSidebar && (
          <>
            {/* LocalGraph in sidebar */}
            <LocalGraphSidebar pageId={page.id} className="border-b border-[var(--color-border)]" />

            {/* Table of Contents placeholder (future enhancement) */}
            <div className="flex-1 p-3">
              <p className="text-xs text-[var(--color-text-tertiary)]">
                {/* Space for future sidebar content like TOC */}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Collapsed sidebar toggle button */}
      {!showRightSidebar && (
        <button
          onClick={() => setShowRightSidebar(true)}
          className="hidden lg:flex fixed right-0 top-4 z-20 items-center justify-center w-8 h-8 rounded-l bg-[var(--color-bg-secondary)] border border-r-0 border-[var(--color-border)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
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
