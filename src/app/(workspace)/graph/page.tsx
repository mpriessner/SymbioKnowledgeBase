"use client";

import { useRef, useCallback } from "react";
import { GraphView } from "@/components/graph/GraphView";
import type { GraphRefHandle } from "@/components/graph/GraphView";
import { GraphControls } from "@/components/graph/GraphControls";
import { useGraphData } from "@/hooks/useGraphData";
import { useGraphFilters } from "@/hooks/useGraphFilters";

/**
 * Global knowledge graph page.
 * Renders a full-viewport interactive graph with filtering controls.
 */
export default function GraphPage() {
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
