# Story SKB-07.2: Global Knowledge Graph View

**Epic:** Epic 7 - Knowledge Graph Visualization
**Story ID:** SKB-07.2
**Story Points:** 5 | **Priority:** High | **Status:** Draft
**Depends On:** SKB-07.1 (Graph API must provide node/edge data)

---

## User Story

As a researcher, I want to see all my pages as an interactive graph, So that I can discover patterns, clusters, and connections in my knowledge base.

---

## Acceptance Criteria

- [ ] `KnowledgeGraph.tsx` wrapping `react-force-graph` (ForceGraph2D)
- [ ] Nodes = pages, edges = wikilinks
- [ ] Click node navigates to page (`router.push('/pages/:id')`)
- [ ] Node size based on `linkCount` (more connections = larger radius, sqrt scale)
- [ ] Node color based on whether page has content (connected vs orphan)
- [ ] Hover on node shows tooltip with page title and connection count
- [ ] Zoom, pan, drag nodes (built into react-force-graph)
- [ ] Page at `(workspace)/graph/page.tsx` with full-viewport graph
- [ ] TanStack Query fetches data from `/api/graph` with stale-while-revalidate
- [ ] Loading skeleton while graph data loads
- [ ] Canvas resizes responsively on window resize
- [ ] Node labels show page titles (truncated if too long)
- [ ] TypeScript strict mode — no `any` types
- [ ] `react-force-graph` dynamically imported (client-side only, no SSR)

---

## Architecture Overview

```
Graph Page Layout
─────────────────

  /graph route
  ┌──────────────────────────────────────────────────────┐
  │  ┌────────────────────────────────────────────────┐   │
  │  │  Header: "Knowledge Graph"   [Fit] [Zoom+] [-] │   │
  │  └────────────────────────────────────────────────┘   │
  │                                                        │
  │  ┌────────────────────────────────────────────────┐   │
  │  │                                                 │   │
  │  │          ForceGraph2D (full viewport)           │   │
  │  │                                                 │   │
  │  │       ● Page A                                  │   │
  │  │      / \                                        │   │
  │  │     /   \                                       │   │
  │  │    ●     ●────● Page D                         │   │
  │  │  Page B   Page C                                │   │
  │  │    \                                            │   │
  │  │     ●                                           │   │
  │  │   Page E                                        │   │
  │  │                                                 │   │
  │  │  [Hover tooltip: "Page A (5 connections)"]     │   │
  │  │                                                 │   │
  │  └────────────────────────────────────────────────┘   │
  │                                                        │
  │  ┌────────────────────────────────────────────────┐   │
  │  │  Footer: "42 pages, 67 connections"             │   │
  │  └────────────────────────────────────────────────┘   │
  └──────────────────────────────────────────────────────┘

Component Hierarchy
───────────────────

  (workspace)/graph/page.tsx
        │
        ▼
  ┌─────────────────────────────┐
  │  GraphView.tsx               │
  │                              │
  │  ┌───────────────────────┐  │
  │  │ ForceGraph2D (dynamic) │  │
  │  │ - nodeCanvasObject     │  │
  │  │ - onNodeClick          │  │
  │  │ - onNodeHover          │  │
  │  │ - linkDirectionalArrow │  │
  │  └───────────────────────┘  │
  │                              │
  │  ┌───────────────────────┐  │
  │  │ GraphTooltip.tsx       │  │
  │  │ Shows on node hover    │  │
  │  └───────────────────────┘  │
  └─────────────────────────────┘

Data Flow
─────────

  useGraphData() → GET /api/graph
       │
       ▼
  { nodes, edges } → ForceGraph2D
       │
       ├── nodeCanvasObject: draw circle + label
       ├── onNodeClick: router.push('/pages/:id')
       ├── onNodeHover: show/hide tooltip
       └── linkColor: edge styling
```

---

## Implementation Steps

### Step 1: Create the GraphTooltip Component

**File: `src/components/graph/GraphTooltip.tsx`**

```typescript
'use client';

interface GraphTooltipProps {
  /** Tooltip content */
  title: string;
  /** Connection count */
  linkCount: number;
  /** Tooltip position (screen coordinates) */
  x: number;
  y: number;
  /** Whether the tooltip is visible */
  visible: boolean;
}

/**
 * Hover tooltip for graph nodes.
 * Shows page title and connection count near the cursor.
 */
export function GraphTooltip({
  title,
  linkCount,
  x,
  y,
  visible,
}: GraphTooltipProps) {
  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed z-50 rounded-md border border-[var(--color-border)]
                 bg-[var(--color-bg-primary)] px-3 py-2 shadow-lg"
      style={{
        left: x + 12,
        top: y - 10,
      }}
    >
      <p className="text-sm font-medium text-[var(--color-text-primary)]">
        {title}
      </p>
      <p className="text-xs text-[var(--color-text-secondary)]">
        {linkCount} {linkCount === 1 ? 'connection' : 'connections'}
      </p>
    </div>
  );
}
```

---

### Step 2: Create the GraphView Component

The main graph visualization component wrapping `react-force-graph`.

**File: `src/components/graph/GraphView.tsx`**

```typescript
'use client';

import {
  useRef,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useGraphData } from '@/hooks/useGraphData';
import { GraphTooltip } from './GraphTooltip';
import type { GraphNode, GraphEdge } from '@/types/graph';

// Dynamically import ForceGraph2D to avoid SSR issues (uses Canvas/WebGL)
const ForceGraph2D = dynamic(
  () => import('react-force-graph').then((mod) => mod.ForceGraph2D),
  { ssr: false }
);

interface GraphViewProps {
  /** Optional page ID for local graph mode */
  pageId?: string;
  /** BFS depth for local graph (default 2) */
  depth?: number;
  /** Width of the graph canvas (default: 100% via container) */
  width?: number;
  /** Height of the graph canvas (default: 100% via container) */
  height?: number;
  /** Whether the center node should be highlighted (for local graph) */
  highlightCenter?: boolean;
}

interface ForceGraphNode extends GraphNode {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface ForceGraphLink extends GraphEdge {
  __indexColor?: string;
}

// Color palette for nodes
const NODE_COLOR_DEFAULT = '#529CCA'; // Blue — connected pages
const NODE_COLOR_ORPHAN = '#9CA3AF'; // Gray — orphan pages
const NODE_COLOR_CENTER = '#EF4444'; // Red — center page in local graph
const LINK_COLOR = '#D1D5DB'; // Light gray edges
const LINK_COLOR_DARK = '#4B5563'; // Dark mode edge color

/**
 * Interactive knowledge graph visualization using react-force-graph.
 *
 * Renders pages as nodes and wikilinks as directed edges.
 * Supports click-to-navigate, hover tooltips, and zoom/pan.
 */
export function GraphView({
  pageId,
  depth = 2,
  width,
  height,
  highlightCenter = false,
}: GraphViewProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<{ zoom: (k: number) => void; centerAt: (x: number, y: number) => void } | null>(null);

  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [tooltip, setTooltip] = useState<{
    title: string;
    linkCount: number;
    x: number;
    y: number;
    visible: boolean;
  }>({
    title: '',
    linkCount: 0,
    x: 0,
    y: 0,
    visible: false,
  });

  const { data, isLoading } = useGraphData({ pageId, depth });

  const graphData = useMemo(() => {
    if (!data?.data) return { nodes: [], links: [] };
    return {
      nodes: data.data.nodes,
      links: data.data.edges.map((e) => ({
        source: e.source,
        target: e.target,
      })),
    };
  }, [data]);

  // Responsive sizing
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: width || containerRef.current.clientWidth,
          height: height || containerRef.current.clientHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [width, height]);

  // Click handler: navigate to page
  const handleNodeClick = useCallback(
    (node: ForceGraphNode) => {
      if (node.id) {
        router.push(`/pages/${node.id}`);
      }
    },
    [router]
  );

  // Hover handler: show/hide tooltip
  const handleNodeHover = useCallback(
    (node: ForceGraphNode | null, event?: MouseEvent) => {
      if (node && event) {
        setTooltip({
          title: node.label,
          linkCount: node.linkCount,
          x: event.clientX,
          y: event.clientY,
          visible: true,
        });
      } else {
        setTooltip((prev) => ({ ...prev, visible: false }));
      }
    },
    []
  );

  // Custom node rendering: circle with size based on linkCount
  const nodeCanvasObject = useCallback(
    (node: ForceGraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const label = node.label;
      const fontSize = Math.max(12 / globalScale, 3);
      const radius = Math.max(Math.sqrt(node.linkCount + 1) * 3, 4);

      // Determine color
      let color = NODE_COLOR_DEFAULT;
      if (highlightCenter && node.id === pageId) {
        color = NODE_COLOR_CENTER;
      } else if (node.linkCount === 0) {
        color = NODE_COLOR_ORPHAN;
      }

      // Draw circle
      ctx.beginPath();
      ctx.arc(node.x || 0, node.y || 0, radius, 0, 2 * Math.PI, false);
      ctx.fillStyle = color;
      ctx.fill();

      // Draw label (only if zoomed in enough)
      if (globalScale > 0.8) {
        ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = 'var(--color-text-primary, #37352f)';

        // Truncate label if too long
        const maxLabelLength = 20;
        const displayLabel =
          label.length > maxLabelLength
            ? label.substring(0, maxLabelLength) + '...'
            : label;

        ctx.fillText(displayLabel, node.x || 0, (node.y || 0) + radius + 2);
      }
    },
    [highlightCenter, pageId]
  );

  // Loading state
  if (isLoading) {
    return (
      <div
        ref={containerRef}
        className="flex h-full w-full items-center justify-center"
      >
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)]" />
          <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
            Loading graph...
          </p>
        </div>
      </div>
    );
  }

  // Empty state
  if (graphData.nodes.length === 0) {
    return (
      <div
        ref={containerRef}
        className="flex h-full w-full items-center justify-center"
      >
        <div className="text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">
            No pages to display.
          </p>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
            Create pages and add wikilinks to build your knowledge graph.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <ForceGraph2D
        ref={graphRef as React.MutableRefObject<null>}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeId="id"
        nodeCanvasObject={nodeCanvasObject}
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        linkColor={() => LINK_COLOR}
        linkWidth={1}
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={1}
        enableZoomInteraction={true}
        enablePanInteraction={true}
        enableNodeDrag={true}
        cooldownTime={3000}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
      />

      <GraphTooltip
        title={tooltip.title}
        linkCount={tooltip.linkCount}
        x={tooltip.x}
        y={tooltip.y}
        visible={tooltip.visible}
      />

      {/* Stats footer */}
      <div className="absolute bottom-4 left-4 rounded-md bg-[var(--color-bg-primary)]/80 px-3 py-1.5 text-xs text-[var(--color-text-secondary)] backdrop-blur-sm">
        {data?.meta.nodeCount} pages, {data?.meta.edgeCount} connections
      </div>
    </div>
  );
}
```

---

### Step 3: Create the Graph Page

**File: `src/app/(workspace)/graph/page.tsx`**

```typescript
import { GraphView } from '@/components/graph/GraphView';

export const metadata = {
  title: 'Knowledge Graph - SymbioKnowledgeBase',
};

/**
 * Global knowledge graph page.
 * Renders a full-viewport interactive graph of all pages and their connections.
 */
export default function GraphPage() {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
        <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
          Knowledge Graph
        </h1>
      </div>

      {/* Graph viewport (fills remaining space) */}
      <div className="flex-1">
        <GraphView />
      </div>
    </div>
  );
}
```

---

## Testing Requirements

### Unit Tests: `src/__tests__/components/graph/GraphView.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock react-force-graph (it requires Canvas which isn't available in jsdom)
vi.mock('react-force-graph', () => ({
  ForceGraph2D: vi.fn().mockReturnValue(null),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/hooks/useGraphData', () => ({
  useGraphData: vi.fn(),
}));

import { GraphView } from '@/components/graph/GraphView';
import { useGraphData } from '@/hooks/useGraphData';
const mockUseGraphData = vi.mocked(useGraphData);

const queryClient = new QueryClient();

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe('GraphView', () => {
  it('should show loading state while fetching', () => {
    mockUseGraphData.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useGraphData>);

    renderWithProviders(<GraphView />);
    expect(screen.getByText('Loading graph...')).toBeInTheDocument();
  });

  it('should show empty state when no nodes', () => {
    mockUseGraphData.mockReturnValue({
      data: {
        data: { nodes: [], edges: [] },
        meta: { nodeCount: 0, edgeCount: 0, timestamp: '' },
      },
      isLoading: false,
    } as ReturnType<typeof useGraphData>);

    renderWithProviders(<GraphView />);
    expect(screen.getByText('No pages to display.')).toBeInTheDocument();
  });

  it('should render stats footer with node and edge counts', () => {
    mockUseGraphData.mockReturnValue({
      data: {
        data: {
          nodes: [
            { id: '1', label: 'P1', icon: null, linkCount: 1, updatedAt: '' },
            { id: '2', label: 'P2', icon: null, linkCount: 1, updatedAt: '' },
          ],
          edges: [{ source: '1', target: '2' }],
        },
        meta: { nodeCount: 2, edgeCount: 1, timestamp: '' },
      },
      isLoading: false,
    } as ReturnType<typeof useGraphData>);

    renderWithProviders(<GraphView />);
    expect(screen.getByText('2 pages, 1 connections')).toBeInTheDocument();
  });
});
```

### Unit Tests: `src/__tests__/components/graph/GraphTooltip.test.tsx`

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GraphTooltip } from '@/components/graph/GraphTooltip';

describe('GraphTooltip', () => {
  it('should render title and connection count when visible', () => {
    render(
      <GraphTooltip
        title="Test Page"
        linkCount={5}
        x={100}
        y={100}
        visible={true}
      />
    );
    expect(screen.getByText('Test Page')).toBeInTheDocument();
    expect(screen.getByText('5 connections')).toBeInTheDocument();
  });

  it('should render singular "connection" for count of 1', () => {
    render(
      <GraphTooltip
        title="Test"
        linkCount={1}
        x={100}
        y={100}
        visible={true}
      />
    );
    expect(screen.getByText('1 connection')).toBeInTheDocument();
  });

  it('should not render when not visible', () => {
    const { container } = render(
      <GraphTooltip
        title="Test"
        linkCount={1}
        x={100}
        y={100}
        visible={false}
      />
    );
    expect(container.firstChild).toBeNull();
  });
});
```

### E2E Test: `tests/e2e/graph.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Knowledge Graph', () => {
  test('should render graph page with canvas', async ({ page }) => {
    await page.goto('/graph');

    // Page should load
    await expect(page.locator('h1')).toHaveText('Knowledge Graph');

    // Canvas should be present (ForceGraph2D renders to canvas)
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
  });

  test('should show node and edge counts', async ({ page }) => {
    await page.goto('/graph');

    // Stats footer should be visible
    const stats = page.locator('text=/\\d+ pages, \\d+ connections/');
    await expect(stats).toBeVisible();
  });
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `src/components/graph/GraphView.tsx` |
| CREATE | `src/components/graph/GraphTooltip.tsx` |
| MODIFY | `src/app/(workspace)/graph/page.tsx` (replace placeholder with GraphView) |
| CREATE | `src/__tests__/components/graph/GraphView.test.tsx` |
| CREATE | `src/__tests__/components/graph/GraphTooltip.test.tsx` |
| CREATE | `tests/e2e/graph.spec.ts` |

---

**Last Updated:** 2026-02-21
