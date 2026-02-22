# Story SKB-18.1: Graph Visual Styling

**Epic:** Epic 18 - Enhanced Graph Visualization
**Story ID:** SKB-18.1
**Story Points:** 5 | **Priority:** High | **Status:** Planned
**Depends On:** EPIC-07 (existing graph implementation), react-force-graph must be installed correctly

---

## User Story

As a user viewing the knowledge graph, I want nodes and edges to be visually distinct by type and importance, So that I can quickly identify patterns and navigate the graph more effectively.

---

## Acceptance Criteria

1. **Node Colors by Type**
   - [ ] Pages: Blue (#529CCA light mode, #60A5FA dark mode)
   - [ ] Databases: Purple (#8B5CF6 light mode, #A78BFA dark mode)
   - [ ] Orphan nodes (0 connections): Gray (#9CA3AF light mode, #6B7280 dark mode)
   - [ ] Color determined by `node.type` or `node.linkCount`

2. **Node Size by Connection Count**
   - [ ] Radius = `sqrt(linkCount + 1) * baseRadius`
   - [ ] Base radius: 4px (min), max radius: 20px
   - [ ] Larger nodes = more connections (hub pages)

3. **Edge Thickness by Strength**
   - [ ] Default edge: 1px
   - [ ] Bidirectional link (A→B and B→A): 2px
   - [ ] TODO (future): Weight by link count (if multiple links exist)

4. **Labels on Hover Only**
   - [ ] Labels hidden by default (reduce clutter)
   - [ ] Show label on node hover (via `onNodeHover` callback)
   - [ ] Label style: 12px font, white background, black text, rounded border

5. **Dark/Light Mode Support**
   - [ ] Colors defined in CSS variables: `--graph-node-page`, `--graph-node-database`, etc.
   - [ ] Automatically switches based on `[data-theme]` attribute
   - [ ] Test in both light and dark modes

6. **Configurable Color Palette**
   - [ ] `colorPalette.ts` exports light and dark color maps
   - [ ] GraphView accepts optional `colorScheme` prop to override defaults
   - [ ] Example: `<GraphView colorScheme="minimal" />` uses grayscale palette

---

## Technical Implementation

### Color Palette

**File: `src/lib/graph/colorPalette.ts`**

```typescript
export const graphColors = {
  light: {
    page: '#529CCA',
    database: '#8B5CF6',
    orphan: '#9CA3AF',
    edge: '#D1D5DB',
    edgeBidirectional: '#9CA3AF',
  },
  dark: {
    page: '#60A5FA',
    database: '#A78BFA',
    orphan: '#6B7280',
    edge: '#4B5563',
    edgeBidirectional: '#6B7280',
  },
};

export function getNodeColor(node: GraphNode, theme: 'light' | 'dark'): string {
  if (node.linkCount === 0) return graphColors[theme].orphan;
  if (node.type === 'database') return graphColors[theme].database;
  return graphColors[theme].page;
}

export function getNodeRadius(linkCount: number, baseRadius = 4): number {
  return Math.min(Math.max(Math.sqrt(linkCount + 1) * baseRadius, baseRadius), 20);
}

export function getEdgeWidth(edge: GraphEdge, allEdges: GraphEdge[]): number {
  // Check if bidirectional link exists
  const isBidirectional = allEdges.some(
    (e) => e.source === edge.target && e.target === edge.source
  );
  return isBidirectional ? 2 : 1;
}
```

---

### GraphView Updates

**File: `src/components/graph/GraphView.tsx` (modifications)**

```typescript
import { graphColors, getNodeColor, getNodeRadius, getEdgeWidth } from '@/lib/graph/colorPalette';
import { useTheme } from 'next-themes'; // or your theme hook

export function GraphView({ ... }: GraphViewProps) {
  const { theme } = useTheme(); // 'light' or 'dark'

  const nodeCanvasObject = useCallback(
    (node: ForceGraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const radius = getNodeRadius(node.linkCount);
      const color = getNodeColor(node, theme === 'dark' ? 'dark' : 'light');

      // Draw circle
      ctx.beginPath();
      ctx.arc(node.x || 0, node.y || 0, radius, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();

      // Draw label only on hover (handled by separate label layer)
    },
    [theme]
  );

  const linkWidth = useCallback(
    (link: ForceGraphLink) => {
      return getEdgeWidth(link, graphData.links);
    },
    [graphData.links]
  );

  return (
    <ForceGraph2D
      // ... existing props
      nodeCanvasObject={nodeCanvasObject}
      linkWidth={linkWidth}
      linkColor={() => graphColors[theme === 'dark' ? 'dark' : 'light'].edge}
    />
  );
}
```

---

### CSS Variables (Dark/Light Mode)

**File: `src/app/globals.css`**

```css
:root {
  --graph-node-page: #529CCA;
  --graph-node-database: #8B5CF6;
  --graph-node-orphan: #9CA3AF;
  --graph-edge: #D1D5DB;
}

[data-theme='dark'] {
  --graph-node-page: #60A5FA;
  --graph-node-database: #A78BFA;
  --graph-node-orphan: #6B7280;
  --graph-edge: #4B5563;
}
```

---

## Test Scenarios

### Unit Tests

```typescript
import { getNodeColor, getNodeRadius } from '@/lib/graph/colorPalette';

describe('Graph Color Palette', () => {
  it('should return blue for page nodes', () => {
    const node = { id: '1', label: 'Page', type: 'page', linkCount: 5 };
    expect(getNodeColor(node, 'light')).toBe('#529CCA');
  });

  it('should return gray for orphan nodes', () => {
    const node = { id: '1', label: 'Orphan', linkCount: 0 };
    expect(getNodeColor(node, 'light')).toBe('#9CA3AF');
  });

  it('should calculate radius using sqrt scale', () => {
    expect(getNodeRadius(0)).toBe(4); // sqrt(1) * 4
    expect(getNodeRadius(8)).toBe(12); // sqrt(9) * 4 = 12
  });
});
```

### E2E Tests

```typescript
test('graph nodes should have different colors', async ({ page }) => {
  await page.goto('/graph');

  // Verify canvas is rendered
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();

  // Snapshot test (visual regression)
  await expect(page).toHaveScreenshot('graph-colors.png');
});
```

---

## Dependencies

- **EPIC-07:** Existing GraphView component must be functional
- **react-force-graph:** Must be installed correctly (`npm i react-force-graph`)

---

## Dev Notes

- **Theme detection:** Use `next-themes` or `prefers-color-scheme` media query
- **Performance:** Node color calculation is cached by useMemo
- **Bidirectional edge detection:** O(n) lookup for each edge — consider memoization if graph is large

---

**Last Updated:** 2026-02-22
