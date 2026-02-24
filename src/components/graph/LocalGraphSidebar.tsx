"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import { GraphView, GraphRefHandle } from "./GraphView";
import { useGraphData } from "@/hooks/useGraphData";

interface LocalGraphSidebarProps {
  /** The current page ID (highlighted as center node) */
  pageId: string;
  /** Custom className for the container */
  className?: string;
}

/**
 * Compact LocalGraph component for the document page sidebar.
 *
 * Features:
 * - Fixed compact size (~250x200px)
 * - Current page highlighted as center node
 * - Zoom in/out controls
 * - Click to navigate to pages
 * - "Open full graph" link
 */
export function LocalGraphSidebar({ pageId, className = "" }: LocalGraphSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const graphRef = useRef<GraphRefHandle | null>(null);
  
  const { data, isLoading } = useGraphData({ pageId, depth: 1, enabled: !isCollapsed });

  const nodeCount = data?.meta.nodeCount ?? 0;
  const edgeCount = data?.meta.edgeCount ?? 0;
  const hasConnections = nodeCount > 1 || edgeCount > 0;

  const handleGraphRef = useCallback((ref: GraphRefHandle | null) => {
    graphRef.current = ref;
  }, []);

  const handleZoomIn = useCallback(() => {
    if (graphRef.current) {
      graphRef.current.zoom(1.5, 300);
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (graphRef.current) {
      graphRef.current.zoom(0.67, 300);
    }
  }, []);

  const handleZoomFit = useCallback(() => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(300, 20);
    }
  }, []);

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-default)]">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          aria-expanded={!isCollapsed}
        >
          <svg
            className={`h-3 w-3 transition-transform duration-200 ${
              isCollapsed ? "" : "rotate-90"
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span>Connections</span>
          {!isCollapsed && hasConnections && (
            <span className="text-xs text-[var(--text-tertiary)]">
              ({nodeCount - 1})
            </span>
          )}
        </button>
        
        {!isCollapsed && (
          <Link
            href="/graph"
            className="text-xs text-[var(--accent-primary)] hover:underline"
          >
            Full graph
          </Link>
        )}
      </div>

      {/* Graph content */}
      {!isCollapsed && (
        <div className="flex-1 min-h-0">
          {isLoading ? (
            <div className="flex h-[200px] items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border-default)] border-t-[var(--accent-primary)]" />
            </div>
          ) : !hasConnections ? (
            <div className="flex h-[200px] items-center justify-center p-4">
              <p className="text-xs text-center text-[var(--text-tertiary)]">
                No connections yet.
                <br />
                Add [[wikilinks]] to connect pages.
              </p>
            </div>
          ) : (
            <div className="relative">
              {/* Zoom controls */}
              <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
                <button
                  onClick={handleZoomIn}
                  className="p-1 rounded bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  title="Zoom in"
                  aria-label="Zoom in"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
                <button
                  onClick={handleZoomOut}
                  className="p-1 rounded bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  title="Zoom out"
                  aria-label="Zoom out"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                  </svg>
                </button>
                <button
                  onClick={handleZoomFit}
                  className="p-1 rounded bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  title="Fit to view"
                  aria-label="Fit to view"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                </button>
              </div>

              {/* Graph */}
              <div style={{ height: 200 }}>
                <GraphView
                  pageId={pageId}
                  depth={1}
                  height={200}
                  highlightCenter={true}
                  showLabels={true}
                  onGraphRef={handleGraphRef}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
