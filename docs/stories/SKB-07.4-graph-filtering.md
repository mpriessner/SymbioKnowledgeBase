# Story SKB-07.4: Graph Filtering and Interaction

**Epic:** Epic 7 - Knowledge Graph Visualization
**Story ID:** SKB-07.4
**Story Points:** 3 | **Priority:** Medium | **Status:** Draft
**Depends On:** SKB-07.2 (Global graph view must exist as the rendering surface)

---

## User Story

As a researcher, I want to filter and customize the graph view, So that I can focus on specific subsets of my knowledge and reduce visual clutter.

---

## Acceptance Criteria

- [ ] `GraphControls.tsx`: control panel rendered alongside the graph view
- [ ] Zoom controls: zoom in, zoom out, reset view, fit-to-screen buttons
- [ ] Filter by date range: "created after" and "created before" date inputs
- [ ] Filter by minimum link count: slider or number input
- [ ] Node labels toggle: show/hide page titles on nodes
- [ ] Edge labels toggle: optional (off by default for performance)
- [ ] Filtered nodes (and their edges) removed from the rendered graph
- [ ] Controls state stored in URL search params for shareability
- [ ] Controls panel collapsible on smaller screens
- [ ] Zoom controls call react-force-graph's `zoom()` and `centerAt()` APIs
- [ ] TypeScript strict mode — no `any` types

---

## Architecture Overview

```
Graph Page with Controls
─────────────────────────

  ┌──────────────────────────────────────────────────────┐
  │  ┌────────────────────────────────────────────────┐   │
  │  │  Knowledge Graph                                │   │
  │  └────────────────────────────────────────────────┘   │
  │                                                        │
  │  ┌────────┐  ┌───────────────────────────────────┐   │
  │  │Controls│  │                                     │   │
  │  │        │  │        ForceGraph2D                 │   │
  │  │ Zoom   │  │                                     │   │
  │  │ [+][-] │  │    ●───●                           │   │
  │  │ [Fit]  │  │   / \                              │   │
  │  │ [Reset]│  │  ●   ●───●                         │   │
  │  │        │  │                                     │   │
  │  │ Filter │  │                                     │   │
  │  │ After: │  │                                     │   │
  │  │ [date] │  │                                     │   │
  │  │ Before:│  │                                     │   │
  │  │ [date] │  │                                     │   │
  │  │        │  │                                     │   │
  │  │ Min    │  │                                     │   │
  │  │ Links: │  │                                     │   │
  │  │ [  2 ] │  │                                     │   │
  │  │        │  │                                     │   │
  │  │ [x]    │  │                                     │   │
  │  │ Labels │  │                                     │   │
  │  │ [ ]    │  │                                     │   │
  │  │ Edges  │  │                                     │   │
  │  └────────┘  └───────────────────────────────────┘   │
  └──────────────────────────────────────────────────────┘

URL Params (shareability)
─────────────────────────
  /graph?after=2026-01-01&before=2026-03-01&minLinks=2&labels=true

Data Flow
─────────

  GraphControls state changes
        │
        ├── Update URL search params (for shareability)
        │
        └── Filter graph data (client-side):
            │
            ▼
  Original graph data from API
        │
        ▼
  Apply date range filter → remove nodes outside range
        │
        ▼
  Apply minLinks filter → remove nodes below threshold
        │
        ▼
  Remove orphaned edges (edges where source or target was filtered out)
        │
        ▼
  Filtered graph data → ForceGraph2D
```

---

## Implementation Steps

### Step 1: Create the useGraphFilters Hook

Manages filter state and synchronizes with URL search params.

**File: `src/hooks/useGraphFilters.ts`**

```typescript
'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import type { GraphNode, GraphEdge, GraphData } from '@/types/graph';

export interface GraphFilters {
  /** Only include nodes updated after this date */
  afterDate: string | null;
  /** Only include nodes updated before this date */
  beforeDate: string | null;
  /** Only include nodes with at least this many connections */
  minLinkCount: number;
  /** Whether to show node labels */
  showLabels: boolean;
  /** Whether to show edge labels */
  showEdgeLabels: boolean;
}

const DEFAULT_FILTERS: GraphFilters = {
  afterDate: null,
  beforeDate: null,
  minLinkCount: 0,
  showLabels: true,
  showEdgeLabels: false,
};

/**
 * Hook for managing graph filter state with URL param persistence.
 *
 * Reads initial state from URL search params and writes back on change.
 * Provides a filtered version of the graph data.
 */
export function useGraphFilters(graphData: GraphData | undefined) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Initialize from URL params
  const [filters, setFilters] = useState<GraphFilters>(() => ({
    afterDate: searchParams.get('after') || null,
    beforeDate: searchParams.get('before') || null,
    minLinkCount: Number(searchParams.get('minLinks')) || 0,
    showLabels: searchParams.get('labels') !== 'false',
    showEdgeLabels: searchParams.get('edgeLabels') === 'true',
  }));

  // Sync filters to URL params
  const updateUrlParams = useCallback(
    (newFilters: GraphFilters) => {
      const params = new URLSearchParams();

      if (newFilters.afterDate) params.set('after', newFilters.afterDate);
      if (newFilters.beforeDate) params.set('before', newFilters.beforeDate);
      if (newFilters.minLinkCount > 0) {
        params.set('minLinks', String(newFilters.minLinkCount));
      }
      if (!newFilters.showLabels) params.set('labels', 'false');
      if (newFilters.showEdgeLabels) params.set('edgeLabels', 'true');

      const queryString = params.toString();
      const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
      router.replace(newUrl, { scroll: false });
    },
    [pathname, router]
  );

  const updateFilter = useCallback(
    <K extends keyof GraphFilters>(key: K, value: GraphFilters[K]) => {
      setFilters((prev) => {
        const updated = { ...prev, [key]: value };
        updateUrlParams(updated);
        return updated;
      });
    },
    [updateUrlParams]
  );

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    updateUrlParams(DEFAULT_FILTERS);
  }, [updateUrlParams]);

  // Apply filters to graph data
  const filteredData = useMemo((): GraphData => {
    if (!graphData) return { nodes: [], edges: [] };

    // Filter nodes
    let filteredNodes = [...graphData.nodes];

    // Date range filter
    if (filters.afterDate) {
      const afterDate = new Date(filters.afterDate).getTime();
      filteredNodes = filteredNodes.filter(
        (node) => new Date(node.updatedAt).getTime() >= afterDate
      );
    }

    if (filters.beforeDate) {
      const beforeDate = new Date(filters.beforeDate).getTime();
      filteredNodes = filteredNodes.filter(
        (node) => new Date(node.updatedAt).getTime() <= beforeDate
      );
    }

    // Minimum link count filter
    if (filters.minLinkCount > 0) {
      filteredNodes = filteredNodes.filter(
        (node) => node.linkCount >= filters.minLinkCount
      );
    }

    // Filter edges: only keep edges where both source and target survive
    const nodeIds = new Set(filteredNodes.map((n) => n.id));
    const filteredEdges = graphData.edges.filter(
      (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)
    );

    return { nodes: filteredNodes, edges: filteredEdges };
  }, [graphData, filters]);

  return {
    filters,
    updateFilter,
    resetFilters,
    filteredData,
    isFiltered:
      filters.afterDate !== null ||
      filters.beforeDate !== null ||
      filters.minLinkCount > 0,
  };
}
```

---

### Step 2: Create the GraphControls Component

**File: `src/components/graph/GraphControls.tsx`**

```typescript
'use client';

import { useCallback } from 'react';
import type { GraphFilters } from '@/hooks/useGraphFilters';

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
            value={filters.afterDate || ''}
            onChange={(e) =>
              onFilterChange('afterDate', e.target.value || null)
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
            value={filters.beforeDate || ''}
            onChange={(e) =>
              onFilterChange('beforeDate', e.target.value || null)
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
              onFilterChange('minLinkCount', Number(e.target.value) || 0)
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

        <label className="mb-2 flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.showLabels}
            onChange={(e) => onFilterChange('showLabels', e.target.checked)}
            className="rounded"
          />
          <span className="text-xs text-[var(--color-text-primary)]">
            Node labels
          </span>
        </label>

        <label className="mb-2 flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.showEdgeLabels}
            onChange={(e) =>
              onFilterChange('showEdgeLabels', e.target.checked)
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
          {isFiltered && ' (filtered)'}
        </p>
      </div>
    </div>
  );
}
```

---

### Step 3: Update the Graph Page to Include Controls

**File: `src/app/(workspace)/graph/page.tsx` (modification)**

```typescript
'use client';

import { useRef, useCallback } from 'react';
import { GraphView } from '@/components/graph/GraphView';
import { GraphControls } from '@/components/graph/GraphControls';
import { useGraphData } from '@/hooks/useGraphData';
import { useGraphFilters } from '@/hooks/useGraphFilters';

export default function GraphPage() {
  const graphRef = useRef<{
    zoom: (k: number, duration?: number) => void;
    centerAt: (x: number, y: number, duration?: number) => void;
    zoomToFit: (duration?: number, padding?: number) => void;
  } | null>(null);

  const { data } = useGraphData();
  const { filters, updateFilter, resetFilters, filteredData, isFiltered } =
    useGraphFilters(data?.data);

  const handleZoomIn = useCallback(() => {
    graphRef.current?.zoom(2, 500);
  }, []);

  const handleZoomOut = useCallback(() => {
    graphRef.current?.zoom(0.5, 500);
  }, []);

  const handleFitToScreen = useCallback(() => {
    graphRef.current?.zoomToFit(500, 50);
  }, []);

  const handleResetView = useCallback(() => {
    graphRef.current?.centerAt(0, 0, 500);
    graphRef.current?.zoom(1, 500);
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
          <GraphView />
        </div>
      </div>
    </div>
  );
}
```

---

## Testing Requirements

### Unit Tests: `src/__tests__/hooks/useGraphFilters.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import type { GraphData } from '@/types/graph';

// Test the filter logic directly
describe('Graph filtering logic', () => {
  const testData: GraphData = {
    nodes: [
      { id: '1', label: 'Page A', icon: null, linkCount: 5, updatedAt: '2026-01-15T00:00:00Z' },
      { id: '2', label: 'Page B', icon: null, linkCount: 1, updatedAt: '2026-02-10T00:00:00Z' },
      { id: '3', label: 'Page C', icon: null, linkCount: 0, updatedAt: '2026-03-01T00:00:00Z' },
    ],
    edges: [
      { source: '1', target: '2' },
      { source: '1', target: '3' },
    ],
  };

  it('should filter nodes by minimum link count', () => {
    const filtered = testData.nodes.filter((n) => n.linkCount >= 2);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('1');
  });

  it('should filter nodes by date range', () => {
    const afterDate = new Date('2026-02-01').getTime();
    const filtered = testData.nodes.filter(
      (n) => new Date(n.updatedAt).getTime() >= afterDate
    );
    expect(filtered).toHaveLength(2);
  });

  it('should remove orphaned edges after node filtering', () => {
    const nodeIds = new Set(['1']); // Only Page A survives
    const filteredEdges = testData.edges.filter(
      (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
    );
    expect(filteredEdges).toHaveLength(0); // No edges where both ends survive
  });
});
```

### Unit Tests: `src/__tests__/components/graph/GraphControls.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GraphControls } from '@/components/graph/GraphControls';

describe('GraphControls', () => {
  const defaultProps = {
    filters: {
      afterDate: null,
      beforeDate: null,
      minLinkCount: 0,
      showLabels: true,
      showEdgeLabels: false,
    },
    onFilterChange: vi.fn(),
    onReset: vi.fn(),
    isFiltered: false,
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onFitToScreen: vi.fn(),
    onResetView: vi.fn(),
    nodeCount: 42,
    edgeCount: 67,
  };

  it('should render zoom control buttons', () => {
    render(<GraphControls {...defaultProps} />);
    expect(screen.getByText('Zoom +')).toBeInTheDocument();
    expect(screen.getByText('Zoom -')).toBeInTheDocument();
    expect(screen.getByText('Fit')).toBeInTheDocument();
    expect(screen.getByText('Reset')).toBeInTheDocument();
  });

  it('should call zoom handlers on button click', () => {
    render(<GraphControls {...defaultProps} />);

    fireEvent.click(screen.getByText('Zoom +'));
    expect(defaultProps.onZoomIn).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Zoom -'));
    expect(defaultProps.onZoomOut).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Fit'));
    expect(defaultProps.onFitToScreen).toHaveBeenCalled();
  });

  it('should render stats', () => {
    render(<GraphControls {...defaultProps} />);
    expect(screen.getByText('42 pages, 67 connections')).toBeInTheDocument();
  });

  it('should show "(filtered)" indicator when filters active', () => {
    render(<GraphControls {...defaultProps} isFiltered={true} />);
    expect(screen.getByText(/filtered/)).toBeInTheDocument();
  });

  it('should show Clear button when filters are active', () => {
    render(<GraphControls {...defaultProps} isFiltered={true} />);
    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('should call onReset when Clear is clicked', () => {
    render(<GraphControls {...defaultProps} isFiltered={true} />);
    fireEvent.click(screen.getByText('Clear'));
    expect(defaultProps.onReset).toHaveBeenCalled();
  });

  it('should render label toggles', () => {
    render(<GraphControls {...defaultProps} />);
    expect(screen.getByText('Node labels')).toBeInTheDocument();
    expect(screen.getByText('Edge labels')).toBeInTheDocument();
  });
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `src/hooks/useGraphFilters.ts` |
| CREATE | `src/components/graph/GraphControls.tsx` |
| MODIFY | `src/app/(workspace)/graph/page.tsx` (add GraphControls alongside GraphView) |
| CREATE | `src/__tests__/hooks/useGraphFilters.test.ts` |
| CREATE | `src/__tests__/components/graph/GraphControls.test.tsx` |

---

**Last Updated:** 2026-02-21
