# Epic 3: Knowledge Graph Enhancements

**Status:** Ready for Implementation  
**Priority:** Medium  
**Dependencies:** None (base feature exists)

## Overview
Enhance the existing Knowledge Graph with working search, node navigation, and local graph integration on document pages.

## Current State
The Knowledge Graph feature exists at `/graph` with:
- ✅ 2D/3D view toggle
- ✅ Zoom/Fit/Reset controls
- ✅ Date range filters
- ✅ Min connections slider
- ✅ Node/Edge labels toggle
- ✅ Statistics display

**Issues to fix:**
- ❌ Search input exists but `onSearchNode` is not implemented
- ❌ Clicking nodes does nothing
- ❌ LocalGraph component exists but not used

---

## Story 9: Node Search Implementation

**Points:** 3  
**Files to modify:**
- `src/app/(workspace)/graph/page.tsx`
- `src/components/graph/GraphView.tsx`
- `src/hooks/useGraphFilters.ts`

### Requirements

1. **Wire up Search in page.tsx**
   ```typescript
   const handleSearchNode = useCallback((query: string) => {
     // Find matching nodes
     const matches = filteredData.nodes.filter(node => 
       node.label?.toLowerCase().includes(query.toLowerCase())
     );
     
     // Highlight matches (update node colors/sizes)
     setHighlightedNodes(matches.map(n => n.id));
     
     // Center on first match
     if (matches.length > 0 && graphRefHandle.current) {
       graphRefHandle.current.centerAt(matches[0].x, matches[0].y, 500);
       graphRefHandle.current.zoom(2, 500);
     }
   }, [filteredData]);
   ```

2. **Pass to GraphControls**
   ```typescript
   <GraphControls
     ...
     onSearchNode={handleSearchNode}
   />
   ```

3. **Visual Feedback**
   - Matching nodes get highlighted (brighter color, larger size)
   - Non-matching nodes dim slightly
   - Show "X matches found" below search input
   - Clear highlights when search is cleared

4. **GraphView Updates**
   - Accept `highlightedNodes?: string[]` prop
   - Apply highlight styling to matching nodes

### Acceptance Criteria
- [ ] Typing in search filters/highlights nodes
- [ ] Graph centers on first match
- [ ] Match count displayed
- [ ] Clearing search resets highlights
- [ ] Case-insensitive matching

---

## Story 10: Node Click Navigation

**Points:** 3  
**Files to modify:**
- `src/components/graph/GraphView.tsx`
- `src/components/graph/Graph3DView.tsx`

### Requirements

1. **Add Click Handler to GraphView**
   ```typescript
   // In ForceGraph2D component
   onNodeClick={(node) => {
     // Navigate to the page
     router.push(`/pages/${node.id}`);
   }}
   ```

2. **Cursor Styling**
   - Show pointer cursor on node hover
   - Add via nodeCanvasObject or CSS

3. **Tooltip on Hover**
   - Show node title on hover
   - Show "Click to open" hint
   - Use existing GraphTooltip component

4. **Apply to Both Views**
   - 2D view (GraphView.tsx)
   - 3D view (Graph3DView.tsx)

### Acceptance Criteria
- [ ] Single click on node navigates to `/pages/[id]`
- [ ] Pointer cursor on hover
- [ ] Tooltip shows page title
- [ ] Works in both 2D and 3D views

---

## Story 11: LocalGraph Integration on Document Pages

**Points:** 5  
**Files to modify:**
- `src/app/(workspace)/pages/[pageId]/page.tsx`
- `src/components/graph/LocalGraph.tsx`
- `src/app/api/graph/local/route.ts` (create if needed)

### Requirements

1. **Add LocalGraph to Document Sidebar**
   - Show in right sidebar or collapsible panel
   - Display current document as center node
   - Show connected documents as surrounding nodes

2. **LocalGraph Component Updates**
   ```typescript
   interface LocalGraphProps {
     pageId: string;
     maxDepth?: number; // How many hops to show (default 1)
     maxNodes?: number; // Limit nodes (default 20)
   }
   ```

3. **API Endpoint for Local Graph Data**
   ```typescript
   // GET /api/graph/local?pageId=xxx&depth=1
   // Returns nodes and edges connected to the specified page
   ```

4. **Interaction**
   - Click node to navigate to that page
   - Current page highlighted differently
   - Hover shows page title

5. **Styling**
   - Compact size (fits in sidebar ~300px)
   - Minimal controls (just the graph)
   - Match dark theme

### Acceptance Criteria
- [ ] LocalGraph shows on document pages
- [ ] Current document is centered/highlighted
- [ ] Connected documents shown as nodes
- [ ] Click navigates to connected document
- [ ] Responsive sizing

---

## Implementation Order

1. **Story 10** (Click Navigation) - Quick win, improves existing feature
2. **Story 9** (Search) - Completes the search functionality
3. **Story 11** (LocalGraph) - Larger feature, more integration

## Technical Notes

### Graph Libraries Used
- `react-force-graph-2d` for 2D view
- `react-force-graph-3d` for 3D view

### Existing Hooks
- `useGraphData` - Fetches graph data from API
- `useGraphFilters` - Manages filter state

### GraphRefHandle Interface
```typescript
interface GraphRefHandle {
  zoom: (k: number, ms?: number) => void;
  zoomToFit: (ms?: number, padding?: number) => void;
  centerAt: (x: number, y: number, ms?: number) => void;
}
```
