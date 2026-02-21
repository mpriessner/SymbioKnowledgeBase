"use client";

import { use, useEffect } from "react";
import { usePage } from "@/hooks/usePages";
import { useRecentPages } from "@/hooks/useRecentPages";
import { PageHeader } from "@/components/workspace/PageHeader";
import { BlockEditor } from "@/components/editor/BlockEditor";
import { BacklinksPanel } from "@/components/page/BacklinksPanel";
import { LocalGraph } from "@/components/graph/LocalGraph";

interface PageViewProps {
  params: Promise<{ id: string }>;
}

export default function PageView({ params }: PageViewProps) {
  const { id } = use(params);
  const { data, isLoading, error } = usePage(id);
  const { addRecentPage } = useRecentPages();

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
      <div className="w-full max-w-4xl mx-auto px-16 py-8">
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
      <div className="w-full max-w-4xl mx-auto px-16 py-8">
        <div className="text-red-600 bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="font-semibold text-lg mb-1">Error loading page</h2>
          <p className="text-sm">{error.message}</p>
        </div>
      </div>
    );
  }

  if (!data?.data) {
    return (
      <div className="w-full max-w-4xl mx-auto px-16 py-8">
        <p className="text-gray-500">Page not found.</p>
      </div>
    );
  }

  const page = data.data;

  return (
    <div className="w-full min-h-screen">
      <PageHeader page={page} />

      {/* Block Editor */}
      <div className="max-w-4xl mx-auto">
        <BlockEditor pageId={page.id} />
      </div>

      {/* Backlinks Panel */}
      <div className="max-w-4xl mx-auto px-8">
        <BacklinksPanel pageId={page.id} />
      </div>

      {/* Local Graph */}
      <div className="max-w-4xl mx-auto px-8">
        <LocalGraph pageId={page.id} />
      </div>
    </div>
  );
}
