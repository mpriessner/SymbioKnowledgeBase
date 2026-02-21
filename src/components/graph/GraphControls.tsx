"use client";

import type { GraphFilters } from "@/hooks/useGraphFilters";

interface GraphControlsProps {
  /** Current filter state */
  filters: GraphFilters;
  /** Update a single filter value */
  onFilterChange: <K extends keyof GraphFilters>(
    key: K,
    value: GraphFilters[K]
  ) => void;
  /** Reset all filters to defaults */
  onReset: () => void;
  /** Whether any filters are currently active */
  isFiltered: boolean;
  /** Zoom in callback */
  onZoomIn: () => void;
  /** Zoom out callback */
  onZoomOut: () => void;
  /** Fit to screen callback */
  onFitToScreen: () => void;
  /** Reset view callback */
  onResetView: () => void;
  /** Filtered node/edge counts for display */
  nodeCount: number;
  edgeCount: number;
}

/**
 * Graph controls panel with zoom buttons, filters, and display options.
 *
 * Rendered alongside the graph view. Supports:
 * - Zoom in/out/fit/reset buttons
 * - Date range filtering
 * - Minimum link count filter
 * - Show/hide node and edge labels
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
}: GraphControlsProps) {
  return (
    <div className="w-56 flex-shrink-0 space-y-4 overflow-y-auto border-r border-[var(--color-border)] p-4">
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
            type="number"
            min={0}
            max={100}
            value={filters.minLinkCount}
            onChange={(e) =>
              onFilterChange("minLinkCount", Number(e.target.value) || 0)
            }
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)]
                       px-2 py-1 text-xs text-[var(--color-text-primary)]"
          />
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
        <p className="text-xs text-[var(--color-text-secondary)]">
          {nodeCount} pages, {edgeCount} connections
          {isFiltered && " (filtered)"}
        </p>
      </div>
    </div>
  );
}
