"use client";

import { Suspense, useRef, useCallback, useMemo, useState } from "react";
import { GraphView } from "@/components/graph/GraphView";
import type { GraphRefHandle } from "@/components/graph/GraphView";
import { Graph3DView } from "@/components/graph/Graph3DView";
import { GraphControls } from "@/components/graph/GraphControls";
import { useGraphData } from "@/hooks/useGraphData";
import { useGraphFilters } from "@/hooks/useGraphFilters";
import { computeGraphMetrics } from "@/lib/graph/metrics";

/**
 * Check if WebGL is supported in the browser (SSR-safe with lazy init).
 */
function getWebGLSupport(): boolean {
  if (typeof window === "undefined") return true; // Assume supported on server
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

function GraphPageContent() {
  const graphRefHandle = useRef<GraphRefHandle | null>(null);
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");
  const [webglSupported] = useState(getWebGLSupport);
  const [highlightedNodes, setHighlightedNodes] = useState<string[]>([]);
  const [searchMatches, setSearchMatches] = useState<number>(0);

  const { data } = useGraphData();
  const { filters, updateFilter, resetFilters, filteredData, isFiltered } =
    useGraphFilters(data?.data);

  const handleGraphRef = useCallback((ref: GraphRefHandle | null) => {
    graphRefHandle.current = ref;
  }, []);

  const handleZoomIn = useCallback(() => {
    graphRefHandle.current?.zoom(2, 500);
  }, []);

  const handleZoomOut = useCallback(() => {
    graphRefHandle.current?.zoom(0.5, 500);
  }, []);

  const handleFitToScreen = useCallback(() => {
    graphRefHandle.current?.zoomToFit(500, 50);
  }, []);

  const handleResetView = useCallback(() => {
    graphRefHandle.current?.centerAt(0, 0, 500);
    graphRefHandle.current?.zoom(1, 500);
  }, []);

  const handleSearchNode = useCallback((query: string) => {
    if (!query.trim()) {
      setHighlightedNodes([]);
      setSearchMatches(0);
      return;
    }

    // Find matching nodes (case-insensitive)
    const matches = filteredData.nodes.filter(node =>
      node.label?.toLowerCase().includes(query.toLowerCase())
    );

    setHighlightedNodes(matches.map(n => n.id));
    setSearchMatches(matches.length);

    // Center on first match
    if (matches.length > 0 && graphRefHandle.current) {
      const firstMatch = matches[0];
      // Use x/y if available, otherwise center at origin
      const x = (firstMatch as { x?: number }).x ?? 0;
      const y = (firstMatch as { y?: number }).y ?? 0;
      graphRefHandle.current.centerAt(x, y, 500);
      graphRefHandle.current.zoom(2, 500);
    }
  }, [filteredData]);

  const metrics = useMemo(
    () => computeGraphMetrics(filteredData.nodes, filteredData.edges),
    [filteredData]
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
        <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
          Knowledge Graph
        </h1>

        {/* 2D/3D Toggle */}
        {webglSupported && (
          <div className="flex items-center gap-1 rounded-md border border-[var(--color-border)] p-0.5">
            <button
              onClick={() => setViewMode("2d")}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                viewMode === "2d"
                  ? "bg-[var(--color-accent)] text-white"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              2D
            </button>
            <button
              onClick={() => setViewMode("3d")}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                viewMode === "3d"
                  ? "bg-[var(--color-accent)] text-white"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              3D
            </button>
          </div>
        )}
      </div>

      {/* Main content: controls + graph */}
      <div className="flex flex-1 overflow-hidden">
        <GraphControls
          filters={filters}
          onFilterChange={updateFilter}
          onReset={resetFilters}
          isFiltered={isFiltered}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onFitToScreen={handleFitToScreen}
          onResetView={handleResetView}
          nodeCount={filteredData.nodes.length}
          edgeCount={filteredData.edges.length}
          clusterCount={metrics.clusterCount}
          orphanCount={metrics.orphanCount}
          onSearchNode={handleSearchNode}
          searchMatchCount={searchMatches}
        />

        <div className="flex-1">
          {viewMode === "2d" ? (
            <GraphView
              overrideData={filteredData}
              showLabels={filters.showLabels}
              onGraphRef={handleGraphRef}
              highlightedNodes={highlightedNodes}
            />
          ) : (
            <Graph3DView
              overrideData={filteredData}
              showLabels={filters.showLabels}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Global knowledge graph page.
 * Wrapped in Suspense because useGraphFilters uses useSearchParams.
 */
export default function GraphPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--border-default)] border-t-[var(--accent-primary)]" />
        </div>
      }
    >
      <GraphPageContent />
    </Suspense>
  );
}
