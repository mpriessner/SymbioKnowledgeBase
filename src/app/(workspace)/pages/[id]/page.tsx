"use client";

import { use, useEffect, useState, useCallback } from "react";
import { usePage } from "@/hooks/usePages";
import { useRecentPages } from "@/hooks/useRecentPages";
import { PageHeader } from "@/components/workspace/PageHeader";
import { BlockEditor } from "@/components/editor/BlockEditor";
import { BacklinksPanel } from "@/components/page/BacklinksPanel";
import { LocalGraph } from "@/components/graph/LocalGraph";
import { LocalGraphSidebar } from "@/components/graph/LocalGraphSidebar";
import { PresenceIndicators } from "@/components/page/PresenceIndicators";

const RIGHT_SIDEBAR_KEY = "symbio-right-sidebar";

interface PageViewProps {
  params: Promise<{ id: string }>;
}

export default function PageView({ params }: PageViewProps) {
  const { id } = use(params);
  const { data, isLoading, error } = usePage(id);
  const { addRecentPage } = useRecentPages();

  // Default to false (content-first); persist in localStorage
  const [showRightSidebar, setShowRightSidebar] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(RIGHT_SIDEBAR_KEY) === "true";
  });

  const toggleRightSidebar = useCallback((value: boolean) => {
    setShowRightSidebar(value);
    try { localStorage.setItem(RIGHT_SIDEBAR_KEY, String(value)); } catch {}
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
    <div className="flex flex-1 w-full h-full min-h-0">
      {/* Main content */}
      <div className="flex-1 min-w-0 overflow-y-auto">
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

      {/* Right Sidebar with LocalGraph — only on xl (1280px+) screens */}
      <div
        className={`
          hidden xl:flex flex-col flex-shrink-0
          border-l border-[var(--border-default)]
          bg-[var(--bg-secondary)]
          transition-all duration-200
          ${showRightSidebar ? "w-[min(280px,20vw)]" : "w-0 overflow-hidden"}
        `}
      >
        {/* Sidebar toggle */}
        <button
          onClick={() => toggleRightSidebar(!showRightSidebar)}
          className="absolute top-4 z-20 hidden xl:flex items-center justify-center w-5 h-8 rounded-l bg-[var(--bg-secondary)] border border-r-0 border-[var(--border-default)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          title={showRightSidebar ? "Hide sidebar" : "Show sidebar"}
          style={{ display: showRightSidebar ? "flex" : "none", right: 'min(280px, 20vw)' }}
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {showRightSidebar && (
          <>
            {/* LocalGraph in sidebar */}
            <LocalGraphSidebar pageId={page.id} className="border-b border-[var(--border-default)]" />

            {/* Table of Contents placeholder (future enhancement) */}
            <div className="flex-1 p-3">
              <p className="text-xs text-[var(--text-tertiary)]">
                {/* Space for future sidebar content like TOC */}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Collapsed sidebar toggle button — only on xl (1280px+) screens */}
      {!showRightSidebar && (
        <button
          onClick={() => toggleRightSidebar(true)}
          className="hidden xl:flex fixed right-0 top-4 z-20 items-center justify-center w-8 h-8 rounded-l bg-[var(--bg-secondary)] border border-r-0 border-[var(--border-default)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
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
