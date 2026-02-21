# Story SKB-07.3: Local Per-Page Graph View

**Epic:** Epic 7 - Knowledge Graph Visualization
**Story ID:** SKB-07.3
**Story Points:** 5 | **Priority:** High | **Status:** Draft
**Depends On:** SKB-07.2 (Global graph view establishes react-force-graph patterns and shared components)

---

## User Story

As a researcher, I want to see the graph neighborhood of my current page, So that I can understand what connects to and from my current context.

---

## Acceptance Criteria

- [ ] `LocalGraph.tsx` component embedded in the page view (`/pages/[id]`)
- [ ] Uses `GET /api/graph?pageId=X&depth=2` for local graph data
- [ ] Current page node highlighted (different color and larger radius)
- [ ] Same interaction as global graph: click to navigate, hover tooltip, zoom/pan
- [ ] Toggleable panel — user can show/hide the local graph
- [ ] Toggle button: "Show Graph" / "Hide Graph" below backlinks panel
- [ ] Fixed size: 100% width, 350px height (not full viewport)
- [ ] Current page node pinned at center (fixed position, not draggable)
- [ ] "View full graph" link that navigates to `/graph`
- [ ] Empty state when page has no connections
- [ ] `react-force-graph` dynamically imported (client-side only)
- [ ] TypeScript strict mode — no `any` types

---

## Architecture Overview

```
Page View Layout with Local Graph
──────────────────────────────────

  ┌──────────────────────────────────────────────────────┐
  │  Page Header (title, icon)                            │
  ├──────────────────────────────────────────────────────┤
  │                                                        │
  │  Block Editor (TipTap)                                │
  │  ...content...                                         │
  │                                                        │
  ├──────────────────────────────────────────────────────┤
  │                                                        │
  │  ▼ Backlinks (3)                                       │
  │  📄 Page A  │  📄 Page B  │  📄 Page C               │
  │                                                        │
  ├──────────────────────────────────────────────────────┤
  │                                                        │
  │  ▼ Local Graph            [View full graph →]          │
  │  ┌────────────────────────────────────────────────┐   │
  │  │                                                 │   │
  │  │         ● Page B                                │   │
  │  │        /                                        │   │
  │  │  ● Page A ─── ★ Current Page ─── ● Page C      │   │
  │  │                     │                           │   │
  │  │                ● Page D                         │   │
  │  │                                                 │   │
  │  │  Height: 350px                                  │   │
  │  └────────────────────────────────────────────────┘   │
  │                                                        │
  └──────────────────────────────────────────────────────┘

  ★ = Current page (highlighted, larger, pinned at center)
  ● = Connected pages (clickable, navigable)

Data Flow
─────────

  LocalGraph receives pageId prop
        │
        ▼
  useGraphData({ pageId, depth: 2 })
        │
        ▼
  GET /api/graph?pageId=X&depth=2
        │
        ▼
  GraphView with highlightCenter=true, fixed height
```

---

## Implementation Steps

### Step 1: Create the LocalGraph Component

**File: `src/components/graph/LocalGraph.tsx`**

```typescript
'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { GraphView } from './GraphView';
import { useGraphData } from '@/hooks/useGraphData';

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
              isExpanded ? 'rotate-90' : ''
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
```

---

### Step 2: Integrate LocalGraph into Page View

**File: `src/app/(workspace)/pages/[id]/page.tsx` (modification)**

```typescript
import { BacklinksPanel } from '@/components/page/BacklinksPanel';
import { LocalGraph } from '@/components/graph/LocalGraph';

export default function PageView({ params }: { params: { id: string } }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Page header */}
      {/* ... */}

      {/* Block editor */}
      {/* ... */}

      {/* Backlinks panel */}
      <BacklinksPanel pageId={params.id} />

      {/* Local graph */}
      <LocalGraph pageId={params.id} />
    </div>
  );
}
```

---

### Step 3: Update GraphView to Support Center Node Pinning

Add center node pinning logic to the existing `GraphView` component.

**File: `src/components/graph/GraphView.tsx` (modification)**

Add the following to the `ForceGraph2D` props for center node pinning when `highlightCenter` is true:

```typescript
// Inside GraphView component, add to ForceGraph2D props:

// Pin center node at the center of the canvas
onEngineStop={useCallback(() => {
  if (highlightCenter && pageId && graphRef.current) {
    const centerNode = graphData.nodes.find(
      (n: ForceGraphNode) => n.id === pageId
    );
    if (centerNode) {
      centerNode.fx = 0;
      centerNode.fy = 0;
      graphRef.current.centerAt(0, 0, 1000);
    }
  }
}, [highlightCenter, pageId, graphData.nodes])}
```

---

## Testing Requirements

### Unit Tests: `src/__tests__/components/graph/LocalGraph.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/hooks/useGraphData', () => ({
  useGraphData: vi.fn(),
}));

vi.mock('react-force-graph', () => ({
  ForceGraph2D: vi.fn().mockReturnValue(null),
}));

import { LocalGraph } from '@/components/graph/LocalGraph';
import { useGraphData } from '@/hooks/useGraphData';
const mockUseGraphData = vi.mocked(useGraphData);

const queryClient = new QueryClient();

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe('LocalGraph', () => {
  it('should render toggle button', () => {
    mockUseGraphData.mockReturnValue({
      data: undefined,
      isLoading: false,
    } as ReturnType<typeof useGraphData>);

    renderWithProviders(<LocalGraph pageId="test-page" />);
    expect(screen.getByText('Local Graph')).toBeInTheDocument();
  });

  it('should be collapsed by default', () => {
    mockUseGraphData.mockReturnValue({
      data: undefined,
      isLoading: false,
    } as ReturnType<typeof useGraphData>);

    renderWithProviders(<LocalGraph pageId="test-page" />);
    expect(screen.queryByText('View full graph')).not.toBeInTheDocument();
  });

  it('should expand on toggle click', () => {
    mockUseGraphData.mockReturnValue({
      data: {
        data: { nodes: [], edges: [] },
        meta: { nodeCount: 0, edgeCount: 0, timestamp: '' },
      },
      isLoading: false,
    } as ReturnType<typeof useGraphData>);

    renderWithProviders(<LocalGraph pageId="test-page" />);
    fireEvent.click(screen.getByText('Local Graph'));

    // Should now show the graph area or empty state
    expect(screen.getByText('View full graph')).toBeInTheDocument();
  });

  it('should show empty state when no connections', () => {
    mockUseGraphData.mockReturnValue({
      data: {
        data: {
          nodes: [{ id: 'test-page', label: 'Test', icon: null, linkCount: 0, updatedAt: '' }],
          edges: [],
        },
        meta: { nodeCount: 1, edgeCount: 0, timestamp: '' },
      },
      isLoading: false,
    } as ReturnType<typeof useGraphData>);

    renderWithProviders(<LocalGraph pageId="test-page" />);
    fireEvent.click(screen.getByText('Local Graph'));

    expect(
      screen.getByText('No connections yet. Add wikilinks to build your graph.')
    ).toBeInTheDocument();
  });

  it('should show "View full graph" link when expanded', () => {
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

    renderWithProviders(<LocalGraph pageId="1" />);
    fireEvent.click(screen.getByText('Local Graph'));

    const link = screen.getByText('View full graph');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', '/graph');
  });
});
```

### E2E Test: `tests/e2e/local-graph.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Local Page Graph', () => {
  test('should toggle local graph panel on page view', async ({ page }) => {
    await page.goto('/pages/some-page-id');

    const toggle = page.locator('text=Local Graph');
    await expect(toggle).toBeVisible();

    // Click to expand
    await toggle.click();

    // Graph container or empty state should appear
    const graphOrEmpty = page.locator('#local-graph');
    await expect(graphOrEmpty).toBeVisible();

    // Click to collapse
    await toggle.click();
    await expect(graphOrEmpty).not.toBeVisible();
  });

  test('should navigate to full graph via link', async ({ page }) => {
    await page.goto('/pages/some-page-id');

    // Expand the local graph
    await page.click('text=Local Graph');

    const fullGraphLink = page.locator('text=View full graph');
    if (await fullGraphLink.isVisible()) {
      await fullGraphLink.click();
      await expect(page).toHaveURL('/graph');
    }
  });
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `src/components/graph/LocalGraph.tsx` |
| MODIFY | `src/app/(workspace)/pages/[id]/page.tsx` (add LocalGraph below BacklinksPanel) |
| MODIFY | `src/components/graph/GraphView.tsx` (add center node pinning support) |
| CREATE | `src/__tests__/components/graph/LocalGraph.test.tsx` |
| CREATE | `tests/e2e/local-graph.spec.ts` |

---

**Last Updated:** 2026-02-21
