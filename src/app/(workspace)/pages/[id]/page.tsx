"use client";

import { use } from "react";
import { usePage } from "@/hooks/usePages";
import { PageHeader } from "@/components/workspace/PageHeader";

interface PageViewProps {
  params: Promise<{ id: string }>;
}

export default function PageView({ params }: PageViewProps) {
  const { id } = use(params);
  const { data, isLoading, error } = usePage(id);

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

      {/* Editor Placeholder */}
      <div className="px-16 max-w-4xl mx-auto">
        <div className="py-4 text-gray-400 border-t border-gray-100">
          <p className="text-base">
            Start writing, or press{" "}
            <kbd className="px-1.5 py-0.5 text-xs font-mono bg-gray-100 border border-gray-200 rounded">
              /
            </kbd>{" "}
            for commands...
          </p>
          <p className="text-sm mt-2 text-gray-300">
            (Block editor will be provided by Epic 4)
          </p>
        </div>
      </div>
    </div>
  );
}
