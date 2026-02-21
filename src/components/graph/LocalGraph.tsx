"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { GraphView } from "./GraphView";
import { useGraphData } from "@/hooks/useGraphData";

interface LocalGraphProps {
  /** The current page ID (highlighted as center node) */
  pageId: string;
  /** BFS depth for the local graph (default 2) */
  depth?: number;
}

/**
 * Local per-page graph view.
 *
 * Shows a compact, toggleable graph of the current page's neighborhood.
 * The current page is highlighted and pinned at the center.
 * Rendered below the backlinks panel on each page view.
 */
export function LocalGraph({ pageId, depth = 2 }: LocalGraphProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { data } = useGraphData({ pageId, depth, enabled: isExpanded });

  const nodeCount = data?.meta.nodeCount ?? 0;
  const edgeCount = data?.meta.edgeCount ?? 0;
  const hasConnections = nodeCount > 1 || edgeCount > 0;

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  return (
    <div className="mt-4 border-t border-[var(--color-border)] pt-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={toggleExpanded}
          className="flex items-center gap-2 text-sm font-medium
                     text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]
                     transition-colors duration-150"
          aria-expanded={isExpanded}
          aria-controls="local-graph"
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
          <span>Local Graph</span>
        </button>

        {isExpanded && (
          <Link
            href="/graph"
            className="text-xs text-[var(--color-accent)] hover:underline"
          >
            View full graph
          </Link>
        )}
      </div>

      {/* Graph panel */}
      {isExpanded && (
        <div id="local-graph" className="mt-3">
          {!hasConnections && nodeCount <= 1 ? (
            <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-[var(--color-border)]">
              <p className="text-sm text-[var(--color-text-secondary)]">
                No connections yet. Add wikilinks to build your graph.
              </p>
            </div>
          ) : (
            <div
              className="overflow-hidden rounded-lg border border-[var(--color-border)]"
              style={{ height: 350 }}
            >
              <GraphView
                pageId={pageId}
                depth={depth}
                height={350}
                highlightCenter={true}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
