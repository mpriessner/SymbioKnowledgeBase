"use client";

import { Suspense, useRef, useCallback, useMemo } from "react";
import { GraphView } from "@/components/graph/GraphView";
import type { GraphRefHandle } from "@/components/graph/GraphView";
import { GraphControls } from "@/components/graph/GraphControls";
import { GraphStats } from "@/components/graph/GraphStats";
import { useGraphData } from "@/hooks/useGraphData";
import { useGraphFilters } from "@/hooks/useGraphFilters";
import { computeGraphMetrics } from "@/lib/graph/metrics";

function GraphPageContent() {
  const graphRefHandle = useRef<GraphRefHandle | null>(null);

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
        />

        <div className="flex-1">
          <GraphView
            overrideData={filteredData}
            showLabels={filters.showLabels}
            onGraphRef={handleGraphRef}
          />
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
