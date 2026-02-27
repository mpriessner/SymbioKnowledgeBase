"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import type { GraphFilters } from "@/hooks/useGraphFilters";

interface GraphControlsProps {
  filters: GraphFilters;
  onFilterChange: <K extends keyof GraphFilters>(
    key: K,
    value: GraphFilters[K]
  ) => void;
  onReset: () => void;
  isFiltered: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToScreen: () => void;
  onResetView: () => void;
  nodeCount: number;
  edgeCount: number;
  clusterCount?: number;
  orphanCount?: number;
  onSearchNode?: (query: string) => void;
  searchMatchCount?: number;
  spacing?: number;
  onSpacingChange?: (value: number) => void;
  nodeSize?: number;
  onNodeSizeChange?: (value: number) => void;
  sizeMode?: "connections" | "content";
  onSizeModeChange?: (mode: "connections" | "content") => void;
}

/**
 * Graph controls panel with zoom, filters, search, and display options.
 */
export function GraphControls({
  filters,
  onFilterChange,
  onReset,
  isFiltered,
  onZoomIn,
  onZoomOut,
  onFitToScreen,
  onResetView,
  nodeCount,
  edgeCount,
  clusterCount,
  orphanCount,
  onSearchNode,
  searchMatchCount,
  spacing = 100,
  onSpacingChange,
  nodeSize = 4,
  onNodeSizeChange,
  sizeMode = "connections",
  onSizeModeChange,
}: GraphControlsProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    onSearchNode?.(value);
  };

  return (
    <div className="w-56 flex-shrink-0 space-y-4 overflow-y-auto border-r border-[var(--color-border)] p-4">
      {/* Search within graph */}
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">
          Search
        </h3>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-secondary)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Find node..."
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)]
                       pl-7 pr-2 py-1.5 text-xs text-[var(--color-text-primary)]
                       placeholder-[var(--color-text-secondary)]"
          />
        </div>
        {searchQuery && (
          <p className="mt-1.5 text-xs text-[var(--color-text-secondary)]">
            {searchMatchCount === 0
              ? "No matches"
              : `${searchMatchCount} match${searchMatchCount === 1 ? "" : "es"} found`}
          </p>
        )}
      </div>

      {/* Zoom Controls */}
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">
          View
        </h3>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={onZoomIn}
            className="rounded-md border border-[var(--color-border)] px-2 py-1.5 text-xs
                       text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]
                       transition-colors"
            title="Zoom in"
          >
            Zoom +
          </button>
          <button
            onClick={onZoomOut}
            className="rounded-md border border-[var(--color-border)] px-2 py-1.5 text-xs
                       text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]
                       transition-colors"
            title="Zoom out"
          >
            Zoom -
          </button>
          <button
            onClick={onFitToScreen}
            className="rounded-md border border-[var(--color-border)] px-2 py-1.5 text-xs
                       text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]
                       transition-colors"
            title="Fit graph to screen"
          >
            Fit
          </button>
          <button
            onClick={onResetView}
            className="rounded-md border border-[var(--color-border)] px-2 py-1.5 text-xs
                       text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]
                       transition-colors"
            title="Reset view to center"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Layout Controls */}
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">
          Layout
        </h3>

        {/* Node Spacing Slider */}
        <label className="mb-3 block">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--color-text-secondary)]">
              Node spacing
            </span>
            {spacing !== 100 && (
              <button
                onClick={() => onSpacingChange?.(100)}
                className="text-xs text-[var(--color-accent)] hover:underline"
              >
                Reset
              </button>
            )}
          </div>
          <input
            type="range"
            min={10}
            max={500}
            value={spacing}
            onChange={(e) => onSpacingChange?.(Number(e.target.value))}
            className="mt-1 w-full"
          />
          <span className="text-xs text-[var(--color-text-secondary)]">
            {spacing}
          </span>
        </label>

        {/* Node Size Slider */}
        <label className="mb-3 block">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--color-text-secondary)]">
              Node size
            </span>
            {nodeSize !== 4 && (
              <button
                onClick={() => onNodeSizeChange?.(4)}
                className="text-xs text-[var(--color-accent)] hover:underline"
              >
                Reset
              </button>
            )}
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={nodeSize}
            onChange={(e) => onNodeSizeChange?.(Number(e.target.value))}
            className="mt-1 w-full"
          />
          <span className="text-xs text-[var(--color-text-secondary)]">
            {nodeSize}
          </span>
        </label>

        {/* Size by toggle */}
        <div className="mb-1">
          <span className="text-xs text-[var(--color-text-secondary)]">
            Size by
          </span>
          <div className="mt-1 flex gap-1">
            <button
              onClick={() => onSizeModeChange?.("connections")}
              className={`flex-1 rounded-md px-2 py-1 text-xs transition-colors ${
                sizeMode === "connections"
                  ? "bg-[var(--color-accent)] text-white"
                  : "border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
              }`}
            >
              Links
            </button>
            <button
              onClick={() => onSizeModeChange?.("content")}
              className={`flex-1 rounded-md px-2 py-1 text-xs transition-colors ${
                sizeMode === "content"
                  ? "bg-[var(--color-accent)] text-white"
                  : "border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
              }`}
            >
              Content
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">
            Filters
          </h3>
          {isFiltered && (
            <button
              onClick={onReset}
              className="text-xs text-[var(--color-accent)] hover:underline"
            >
              Clear
            </button>
          )}
        </div>

        {/* Date range: After */}
        <label className="mb-3 block">
          <span className="text-xs text-[var(--color-text-secondary)]">
            Updated after
          </span>
          <input
            type="date"
            value={filters.afterDate || ""}
            onChange={(e) =>
              onFilterChange("afterDate", e.target.value || null)
            }
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)]
                       px-2 py-1 text-xs text-[var(--color-text-primary)]"
          />
        </label>

        {/* Date range: Before */}
        <label className="mb-3 block">
          <span className="text-xs text-[var(--color-text-secondary)]">
            Updated before
          </span>
          <input
            type="date"
            value={filters.beforeDate || ""}
            onChange={(e) =>
              onFilterChange("beforeDate", e.target.value || null)
            }
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)]
                       px-2 py-1 text-xs text-[var(--color-text-primary)]"
          />
        </label>

        {/* Minimum link count */}
        <label className="mb-3 block">
          <span className="text-xs text-[var(--color-text-secondary)]">
            Min. connections
          </span>
          <input
            type="range"
            min={0}
            max={20}
            value={filters.minLinkCount}
            onChange={(e) =>
              onFilterChange("minLinkCount", Number(e.target.value) || 0)
            }
            className="mt-1 w-full"
          />
          <span className="text-xs text-[var(--color-text-secondary)]">
            {filters.minLinkCount}
          </span>
        </label>
      </div>

      {/* Display Options */}
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">
          Display
        </h3>

        <label className="mb-2 flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={filters.showNodes}
            onChange={(e) => onFilterChange("showNodes", e.target.checked)}
            className="rounded"
          />
          <span className="text-xs text-[var(--color-text-primary)]">
            Show nodes
          </span>
        </label>

        <label className="mb-2 flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={filters.showEdges}
            onChange={(e) => onFilterChange("showEdges", e.target.checked)}
            className="rounded"
          />
          <span className="text-xs text-[var(--color-text-primary)]">
            Show edges
          </span>
        </label>

        <label className="mb-2 flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={filters.showLabels}
            onChange={(e) => onFilterChange("showLabels", e.target.checked)}
            className="rounded"
          />
          <span className="text-xs text-[var(--color-text-primary)]">
            Node labels
          </span>
        </label>

        <label className="mb-2 flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={filters.showEdgeLabels}
            onChange={(e) =>
              onFilterChange("showEdgeLabels", e.target.checked)
            }
            className="rounded"
          />
          <span className="text-xs text-[var(--color-text-primary)]">
            Edge labels
          </span>
        </label>
      </div>

      {/* Stats */}
      <div className="border-t border-[var(--color-border)] pt-3">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">
          Statistics
        </h3>
        <div className="grid grid-cols-2 gap-1.5">
          <div className="rounded-md bg-[var(--color-bg-secondary)] px-2 py-1.5 text-center">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">{nodeCount}</p>
            <p className="text-xs text-[var(--color-text-secondary)]">Pages</p>
          </div>
          <div className="rounded-md bg-[var(--color-bg-secondary)] px-2 py-1.5 text-center">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">{edgeCount}</p>
            <p className="text-xs text-[var(--color-text-secondary)]">Links</p>
          </div>
          {clusterCount !== undefined && (
            <div className="rounded-md bg-[var(--color-bg-secondary)] px-2 py-1.5 text-center">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">{clusterCount}</p>
              <p className="text-xs text-[var(--color-text-secondary)]">Clusters</p>
            </div>
          )}
          {orphanCount !== undefined && (
            <div className="rounded-md bg-[var(--color-bg-secondary)] px-2 py-1.5 text-center">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">{orphanCount}</p>
              <p className="text-xs text-[var(--color-text-secondary)]">Orphans</p>
            </div>
          )}
        </div>
        {isFiltered && (
          <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
            Showing filtered results
          </p>
        )}
      </div>
    </div>
  );
}
