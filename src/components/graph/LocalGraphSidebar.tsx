"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { GraphView, GraphRefHandle } from "./GraphView";
import { useGraphData } from "@/hooks/useGraphData";

const Graph3DView = dynamic(
  () => import("./Graph3DView").then((mod) => ({ default: mod.Graph3DView })),
  { ssr: false }
);

const STORAGE_KEY = "skb-graph-sidebar-settings";

interface LocalGraphSidebarProps {
  /** The current page ID (highlighted as center node) */
  pageId: string;
  /** Called when the user clicks the close button */
  onClose?: () => void;
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
const MIN_DEPTH = 1;
const MAX_DEPTH = 4;

function loadSavedSettings(): { is3D: boolean; nodeSize: number } {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        is3D: typeof parsed.is3D === "boolean" ? parsed.is3D : false,
        nodeSize: typeof parsed.nodeSize === "number" ? parsed.nodeSize : 3,
      };
    }
  } catch { /* ignore */ }
  return { is3D: false, nodeSize: 3 };
}

export function LocalGraphSidebar({ pageId, onClose, className = "" }: LocalGraphSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [depth, setDepth] = useState(1);
  const graphRef = useRef<GraphRefHandle | null>(null);

  const [is3D, setIs3D] = useState(() => loadSavedSettings().is3D);
  const [nodeSize, setNodeSize] = useState(() => loadSavedSettings().nodeSize);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ is3D, nodeSize }));
  }, [is3D, nodeSize]);

  const { data, isLoading } = useGraphData({ pageId, depth, enabled: !isCollapsed });

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

  const increaseDepth = useCallback(() => {
    setDepth((d) => Math.min(d + 1, MAX_DEPTH));
  }, []);

  const decreaseDepth = useCallback(() => {
    setDepth((d) => Math.max(d - 1, MIN_DEPTH));
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
        
        <div className="flex items-center gap-2">
          {!isCollapsed && (
            <Link
              href="/graph"
              className="text-xs text-[var(--accent-primary)] hover:underline"
            >
              Full graph
            </Link>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-0.5 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
              title="Close graph"
              aria-label="Close graph"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Graph content */}
      {!isCollapsed && (
        <div className="flex flex-col flex-1 min-h-0">
          {isLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border-default)] border-t-[var(--accent-primary)]" />
            </div>
          ) : !hasConnections ? (
            <div className="flex flex-1 items-center justify-center p-4">
              <p className="text-xs text-center text-[var(--text-tertiary)]">
                No connections yet.
                <br />
                Add [[wikilinks]] to connect pages.
              </p>
            </div>
          ) : (
            <>
            <div className="relative flex-1 min-h-0">
              {/* Zoom controls (right) — only for 2D */}
              {!is3D && (
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
              )}

              {/* Graph */}
              <div className="absolute inset-0">
                {is3D ? (
                  <Graph3DView
                    pageId={pageId}
                    depth={depth}
                    highlightCenter={true}
                    showLabels={true}
                    nodeSize={nodeSize}
                  />
                ) : (
                  <GraphView
                    pageId={pageId}
                    depth={depth}
                    highlightCenter={true}
                    showLabels={true}
                    nodeSize={nodeSize}
                    onGraphRef={handleGraphRef}
                  />
                )}
              </div>
            </div>

            {/* Controls panel */}
            <div className="px-3 py-2 border-t border-[var(--border-default)] flex items-center gap-3">
              {/* 2D/3D toggle */}
              <button
                onClick={() => setIs3D((v) => !v)}
                className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors select-none"
                title={is3D ? "Switch to 2D view" : "Switch to 3D view"}
              >
                {is3D ? "3D" : "2D"}
              </button>

              {/* Node size slider */}
              <label className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)]">
                <span className="select-none">Size</span>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={nodeSize}
                  onChange={(e) => setNodeSize(Number(e.target.value))}
                  className="w-14 h-1 accent-[var(--accent-primary)]"
                />
              </label>

              {/* Depth controls */}
              <div className="flex items-center gap-1 ml-auto">
                <button
                  onClick={decreaseDepth}
                  disabled={depth <= MIN_DEPTH}
                  className="p-0.5 rounded bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Decrease depth"
                  aria-label="Decrease depth"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                  </svg>
                </button>
                <span
                  className="text-[10px] font-medium text-[var(--text-secondary)] min-w-[16px] text-center select-none"
                  title={`Showing ${depth} hop${depth > 1 ? "s" : ""} from current page`}
                >
                  {depth}
                </span>
                <button
                  onClick={increaseDepth}
                  disabled={depth >= MAX_DEPTH}
                  className="p-0.5 rounded bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Increase depth"
                  aria-label="Increase depth"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
