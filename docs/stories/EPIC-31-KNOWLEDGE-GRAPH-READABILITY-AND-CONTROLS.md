# Epic 31: Knowledge Graph — Readability, Labels & Controls

**Epic ID:** EPIC-31
**Created:** 2026-02-25
**Total Story Points:** 49
**Priority:** High
**Status:** In Progress (~40% complete)
**Notes:** SKB-31.5 (Zoom buttons) done — zoom in/out/fit/reset all working. SKB-31.1 (Dark mode labels) partially done — label color handling exists but min font size still 3px (should be 8px), no text stroke. SKB-31.6 (Visual polish) partially done — highlighted node glow works, but missing: subtle glow for all dark mode nodes, edge brightness, arrow head size, radial gradient background, pulsing animation.

**Remaining work:**
- SKB-31.2: Node spacing control slider (not started)
- SKB-31.3: Always-visible name labels on 3D graph (not started)
- SKB-31.4: Edge labels and distance display (not started)
- SKB-31.7: Move graph legend from bottom-right to top-right (not started)
- SKB-31.8: Node size control slider (not started)
- SKB-31.9: Scale node size by document content length (not started)
- SKB-31.1: Increase min font size to 8px, add text stroke for readability
- SKB-31.6: Complete visual polish (dark mode glow, edge styling, background)

---

## Epic Overview

The knowledge graph page has several usability issues that make it difficult to work with, especially in dark mode:

1. **Labels are nearly invisible in dark mode.** Node labels are rendered in a gray that blends into the dark background. When nodes are dimmed during search, labels become almost unreadable (opacity drops to 0.4). The minimum font size (3px) is far too small at low zoom levels.

2. **No way to control node spacing.** Users cannot adjust how spread out or clustered the nodes are. The force simulation parameters are hardcoded. Users need a slider to push nodes apart or pull them together.

3. **3D graph has no visible node name labels.** The 3D view uses the library's built-in tooltip-on-hover labels, but there are no always-visible or faded name overlays on the 3D nodes. Users have to hover each node to see its name.

4. **No edge distance/weight display.** There's a "Show edge labels" checkbox in the controls panel, but it does nothing — the feature was never implemented. Users want to see the connection strength or distance between nodes.

5. **Zoom buttons don't work.** The Zoom +, Zoom -, Fit, and Reset buttons in the left sidebar call methods on `graphRefHandle.current`, but the ref may not be properly forwarded to the underlying force graph component, so clicks do nothing.

---

## Current Implementation

```
GRAPH CONTROLS (left sidebar):              GRAPH CANVAS:
┌─────────────────┐                         ┌──────────────────────────┐
│ [Search...]     │                         │                          │
│                 │                         │    ●──────●              │
│ [Zoom +][Zoom -]│  ← buttons don't work  │   /  (no labels visible) │
│ [Fit]  [Reset] │                         │  ●────●───●              │
│                 │                         │        \                 │
│ Filters:        │                         │         ●               │
│ ☑ Show labels   │                         │   (all dots, no names)  │
│ ☑ Show edges    │                         │                          │
│ ☐ Edge labels   │  ← does nothing        └──────────────────────────┘
└─────────────────┘
```

**Key files:**
- `src/app/(workspace)/graph/page.tsx` — zoom handlers, view mode toggle
- `src/components/graph/GraphView.tsx` — 2D canvas graph, label rendering (lines 206-284)
- `src/components/graph/Graph3DView.tsx` — 3D WebGL graph
- `src/components/graph/GraphControls.tsx` — sidebar with buttons and filters
- `src/lib/graph/colorPalette.ts` — colors: dark mode labels are `#E5E7EB`, dimmed to 0.4 alpha

---

## Business Value

- Users cannot read node names in dark mode — the graph becomes a collection of anonymous dots
- No force control means dense graphs are a tangled mess and sparse graphs are too spread out
- The 3D view is impressive visually but useless without labels — users can't identify nodes
- Broken zoom buttons make the controls panel feel non-functional

---

## Stories Breakdown

### SKB-31.1: Fix Label Readability in Dark Mode (2D Graph) — 5 points, Critical

**Delivers:** Node labels are clearly readable in dark mode at all zoom levels, including when some nodes are dimmed during search.

**Acceptance Criteria:**
- In dark mode, all node labels are clearly readable against the dark background
- Labels have a subtle text shadow or outline stroke so they stand out from any background elements
- During search, non-matching node labels are dimmed but still readable (not invisible)
- The minimum font size is large enough to read at low zoom levels (at least 8px, not 3px)
- Labels automatically hide at very low zoom levels (when there would be too many overlapping) but show at moderate zoom
- Label color has sufficient contrast ratio (at least 4.5:1 against the background)
- Light mode labels continue to work correctly (no regression)

**Root cause details:**
- `GraphView.tsx` line 267: dark mode label color is `#E5E7EB` — acceptable, but...
- Line 237: dimmed nodes use `rgba(100,100,100,0.4)` — labels for these become nearly invisible
- Line 215: minimum font size is `Math.max(12 / globalScale, 3)` — 3px is unreadable
- No text outline/stroke is applied to labels — they blend into edges and node glows

**Implementation approach:**
1. In `GraphView.tsx`, increase minimum font size from 3 to 8:
   - Line 215: change `Math.max(12 / globalScale, 3)` to `Math.max(12 / globalScale, 8)`
2. Add a text outline/stroke to all labels for better contrast:
   - Before drawing label text, set `ctx.strokeStyle` to the background color (dark or light)
   - Set `ctx.lineWidth = 3` and call `ctx.strokeText()` before `ctx.fillText()`
   - This creates a halo effect around the text
3. Increase dimmed label opacity from 0.4 to 0.6:
   - When nodes are dimmed during search, labels should use alpha 0.6 instead of 0.4
4. Adjust the zoom threshold for label visibility:
   - Line 256: labels show when `globalScale > 0.8` — consider lowering to `0.5` so labels appear earlier when zooming in

**Files to modify:**
| File | Change |
|------|--------|
| `src/components/graph/GraphView.tsx` | Fix min font size, add text stroke, adjust dimmed opacity, adjust zoom threshold |
| `src/lib/graph/colorPalette.ts` | Optionally increase label color brightness in dark mode |

**Do NOT break:**
- Label positioning below nodes
- Search highlighting (blue glow on matched nodes)
- Node canvas rendering (circles, colors, click handlers)
- Light mode label appearance
- Label truncation at 20 characters with ellipsis

**Verification:**
1. Switch to dark mode, open the Graph page
2. All node names should be clearly readable
3. Type a search term — non-matching labels should be dimmed but still legible
4. Zoom out — labels should remain readable until they naturally hide at very low zoom
5. Switch to light mode — labels should still look correct

---

### SKB-31.2: Add Node Spacing Control Slider — 8 points, High

**Delivers:** A slider in the graph controls sidebar that lets users adjust how spread out or clustered the nodes are.

**Acceptance Criteria:**
- A "Node Spacing" slider appears in the Graph Controls sidebar (below the zoom buttons)
- Sliding left makes nodes cluster tighter together (less repulsion)
- Sliding right pushes nodes further apart (more repulsion)
- The slider has a reasonable default position (current behavior)
- Changes take effect in real-time as the slider is dragged (the graph re-simulates)
- The slider works for both 2D and 3D graph views
- A label shows the current value (e.g., "Spacing: 50%")
- A "Reset" button next to the slider returns to the default spacing

**Implementation approach:**
1. In `GraphControls.tsx`: add a range input slider with label
   - Min value: 10 (very tight), Max: 500 (very spread out), Default: ~100
   - Pass the value up to the parent via a new `onSpacingChange` prop
2. In `graph/page.tsx`: store spacing state, pass to GraphView and Graph3DView
3. In `GraphView.tsx`: use the spacing value to control the d3 force simulation
   - Access the force graph ref and call `.d3Force('charge').strength(-spacingValue)`
   - The charge force controls repulsion between nodes
   - Also adjust link distance: `.d3Force('link').distance(spacingValue * 0.5)`
   - After changing forces, reheat the simulation: `.d3ReheatSimulation()`
4. In `Graph3DView.tsx`: same force adjustments using the 3D force graph ref
5. Current hardcoded parameters: `d3VelocityDecay={0.3}`, `d3AlphaDecay={0.02}` — these stay as-is; only the charge strength and link distance change

**Files to modify:**
| File | Change |
|------|--------|
| `src/components/graph/GraphControls.tsx` | Add spacing slider UI with label and reset button |
| `src/app/(workspace)/graph/page.tsx` | Add spacing state, pass to views and controls |
| `src/components/graph/GraphView.tsx` | Apply spacing value to d3 charge force and link distance |
| `src/components/graph/Graph3DView.tsx` | Apply spacing value to d3 charge force and link distance |
| `src/hooks/useGraphFilters.ts` | Optionally persist spacing in URL params |

**Do NOT break:**
- Graph initial layout and simulation cooldown
- Node drag behavior
- Node click navigation
- Edge rendering
- Search highlighting
- 2D/3D view toggle

---

### SKB-31.3: Add Always-Visible Name Labels to 3D Graph — 5 points, High

**Delivers:** Nodes in the 3D graph have visible name labels (faded/semi-transparent) so users can identify nodes without hovering.

**Acceptance Criteria:**
- Each node in the 3D graph has its name displayed next to it
- Labels are semi-transparent (e.g., 60% opacity) so they don't clutter the view
- Labels face the camera (billboard effect — text always readable regardless of rotation)
- Labels are readable in both dark and light mode (white text with dark outline in dark mode, dark text with light outline in light mode)
- Labels scale appropriately — smaller when zoomed out, larger when zoomed in
- At very far zoom, labels can fade out to avoid visual noise
- Labels don't overlap too badly in dense areas (some overlap is acceptable)
- The existing "Show labels" checkbox in the controls panel toggles these labels on/off

**Implementation approach:**
1. In `Graph3DView.tsx`: use `nodeThreeObject` callback instead of/alongside `nodeLabel`
   - Create a `SpriteText` (from `three-spritetext` library) or a `THREE.Sprite` with canvas texture for each node
   - Set text to `node.label`, color based on theme, opacity to 0.6
   - Position the sprite slightly above/below the node sphere
2. Alternative: use `nodeThreeObjectExtend={true}` to add text sprites alongside the default node spheres
3. Use the `showLabels` filter state to toggle visibility:
   - When `showLabels` is false, set sprite opacity to 0 or remove sprites
4. Ensure the text scales with distance (three-spritetext handles this automatically)

**Files to modify:**
| File | Change |
|------|--------|
| `src/components/graph/Graph3DView.tsx` | Add SpriteText or canvas-based label sprites to nodes |

**Dependencies:** May need to install `three-spritetext` package if not already available. Check if it exists in `package.json` first.

**Do NOT break:**
- 3D graph rotation, zoom, pan
- Node click navigation
- Node drag behavior
- Tooltip on hover (can keep alongside always-visible labels)
- Dark/light theme switching
- Graph performance (labels should be lightweight — use sprites, not DOM elements)

---

### SKB-31.4: Implement Edge Labels and Distance Display — 8 points, Medium

**Delivers:** Users can see labels on the edges between nodes, showing the connection type or distance.

**Acceptance Criteria:**
- When "Show edge labels" is checked in the controls, labels appear on each edge line
- Edge labels show the link relationship or a numeric distance/weight value
- Labels are positioned at the midpoint of each edge
- Labels are small and semi-transparent so they don't dominate the view
- Labels are readable in both dark and light mode
- In the 2D view: canvas-rendered text at edge midpoints
- In the 3D view: sprite text at edge midpoints
- Very short edges hide their labels to avoid clutter (label only shown if edge is longer than a minimum pixel length)
- The "Show edge labels" checkbox in GraphControls already exists — just wire it up

**Implementation approach:**
1. **2D Graph** (`GraphView.tsx`): use the `linkCanvasObject` or `linkCanvasObjectMode` callback
   - Calculate midpoint: `mx = (source.x + target.x) / 2`, `my = (source.y + target.y) / 2`
   - Draw label text at midpoint: small font, semi-transparent
   - Label content: use link label/type if available, otherwise show "linked"
   - Only render if the `showEdgeLabels` filter is true
2. **3D Graph** (`Graph3DView.tsx`): use `linkThreeObject` callback
   - Create a SpriteText at the midpoint of each link
   - Toggle visibility based on `showEdgeLabels`
3. In both views: skip rendering edge labels if the edge's pixel length is below a threshold (e.g., 30px in 2D, or 3D-distance equivalent)

**Files to modify:**
| File | Change |
|------|--------|
| `src/components/graph/GraphView.tsx` | Add linkCanvasObject for edge label rendering |
| `src/components/graph/Graph3DView.tsx` | Add linkThreeObject for 3D edge labels |
| `src/app/(workspace)/graph/page.tsx` | Pass showEdgeLabels filter to both views |

**Do NOT break:**
- Edge rendering (arrows, colors, widths)
- Edge click behavior (if any)
- Graph performance — edge labels should be lightweight
- The existing "Show edge labels" checkbox state management

---

### SKB-31.5: Fix Zoom Buttons (Zoom In, Zoom Out, Fit, Reset) — 3 points, Critical

**Delivers:** The four zoom control buttons in the left sidebar actually work when clicked.

**Acceptance Criteria:**
- Click "Zoom +" — the graph zooms in (nodes get bigger, fewer visible)
- Click "Zoom -" — the graph zooms out (nodes get smaller, more visible)
- Click "Fit" — the graph zooms and pans to fit all nodes in the viewport with padding
- Click "Reset" — the graph centers at the origin and resets zoom to 1x
- All four buttons work in both 2D and 3D view modes
- Buttons give visual feedback on click (button press effect, already styled)
- Rapid clicking (e.g., zoom+ 5 times quickly) accumulates correctly

**Root cause analysis:**
The zoom handlers in `page.tsx` (lines 43-58) call methods on `graphRefHandle.current`:
```
graphRefHandle.current?.zoom(2, 500)
graphRefHandle.current?.zoomToFit(500, 50)
graphRefHandle.current?.centerAt(0, 0, 500)
```
The `GraphRefHandle` interface defines these methods, but the ref may not be properly connected to the underlying `react-force-graph-2d` / `react-force-graph-3d` component instance. The issue is likely:
- `useImperativeHandle` in `GraphView.tsx` may not be forwarding the ref correctly
- Or the force graph component ref isn't captured before the buttons are clicked
- Or in 3D mode, the ref isn't connected at all

**Implementation approach:**
1. In `GraphView.tsx`: verify `useImperativeHandle` correctly exposes `zoom`, `centerAt`, `zoomToFit` methods from the force graph ref
2. In `Graph3DView.tsx`: verify the same — the 3D library may use different method names (e.g., `cameraPosition` instead of `zoom`)
3. In `page.tsx`: ensure the `graphRefHandle` ref is passed to whichever view component is active (2D or 3D) — when the view mode toggles, the ref must reconnect
4. Add null-checks and console logging to debug if ref is null when button is clicked
5. For 3D view: map zoom controls to camera position changes:
   - Zoom in: move camera closer to center
   - Zoom out: move camera further from center
   - Fit: call `zoomToFit()` if available, or calculate bounding box and position camera
   - Reset: reset camera to default position

**Files to modify:**
| File | Change |
|------|--------|
| `src/components/graph/GraphView.tsx` | Verify/fix useImperativeHandle ref forwarding |
| `src/components/graph/Graph3DView.tsx` | Verify/fix ref forwarding for 3D zoom methods |
| `src/app/(workspace)/graph/page.tsx` | Ensure ref is properly connected on view mode toggle |

**Do NOT break:**
- Mouse wheel zoom (should continue working independently)
- Mouse pan/drag
- Node click navigation
- 2D/3D view toggle

**Verification:**
1. Open Graph page in 2D mode
2. Click Zoom + — graph zooms in
3. Click Zoom - — graph zooms out
4. Click Fit — all nodes fit in view
5. Click Reset — returns to default view
6. Switch to 3D mode — repeat all 4 buttons
7. Switch back to 2D — buttons still work

---

### SKB-31.6: Visual Polish — Node Glow, Edge Styling, Graph Background — 5 points, Low

**Delivers:** Overall visual improvements to make the graph look more polished and professional.

**Acceptance Criteria:**
- Nodes have a subtle glow/shadow in dark mode (not just on highlight) for better visibility against the dark background
- Edge lines are slightly more visible in dark mode (currently `#4B5563` which is very faint)
- Edge arrows are more distinct (slightly larger or colored)
- The graph background has a very subtle grid pattern or radial gradient (optional, for spatial orientation)
- Highlighted/selected node has a more prominent visual indicator (pulsing glow or thicker ring)
- The graph legend colors exactly match the actual node colors rendered on canvas

**Implementation approach:**
1. In `colorPalette.ts`: brighten the dark mode edge color from `#4B5563` to `#6B7280`
2. In `GraphView.tsx`: add a subtle outer glow (shadow) to all nodes in dark mode (canvas shadow blur)
3. Increase arrow head size from 4 to 6 pixels for better visibility
4. Optionally add a subtle radial gradient to the canvas background for depth perception
5. For highlighted nodes: add a pulsing animation (alternate glow radius over time using requestAnimationFrame)

**Files to modify:**
| File | Change |
|------|--------|
| `src/lib/graph/colorPalette.ts` | Brighten dark mode edge color |
| `src/components/graph/GraphView.tsx` | Add node glow, increase arrow size, optional background gradient |
| `src/components/graph/Graph3DView.tsx` | Match 3D visual improvements |

**Do NOT break:**
- All existing graph functionality
- Performance (avoid expensive per-frame operations)
- Light mode appearance
- Theme switching

---

### SKB-31.7: Move Graph Legend from Bottom-Right to Top-Right — 2 points, Medium

**Delivers:** The graph legend panel is positioned at the top-right corner of the graph canvas instead of the bottom-right, so it is no longer overlaid by the SymbioAI chat button.

**Acceptance Criteria:**
- The legend panel appears at the top-right corner of the graph area (below the page header)
- The legend does not overlap the SymbioAI chat button (which sits at bottom-right)
- The legend does not overlap the GraphControls sidebar (which is on the left)
- The collapsed state (showing "5n · 12e" summary) is at top-right
- The expanded state (showing color legend + statistics) opens downward from the top-right
- The legend does not overlap the compact graph sidebar window (if EPIC-30 is implemented — graph sidebar is also top-right but on the page, not the graph page)
- Both light and dark mode look correct
- The legend does not block interaction with graph nodes underneath it

**Root cause:**
- `GraphLegend.tsx` line 30 (collapsed) and line 39 (expanded): `absolute bottom-4 right-4`
- The SymbioAI floating chat button is also positioned at the bottom-right, overlaying the legend

**Implementation approach:**
1. In `GraphLegend.tsx`: change positioning from `bottom-4 right-4` to `top-4 right-4`
   - Line 30 (collapsed): change `absolute bottom-4 right-4` to `absolute top-4 right-4`
   - Line 39 (expanded): change `absolute bottom-4 right-4` to `absolute top-4 right-4`
2. Ensure the expanded legend opens downward (it should naturally since it grows in height)
3. Verify the legend doesn't overlap the page header or the graph controls panel

**Files to modify:**
| File | Change |
|------|--------|
| `src/components/graph/GraphLegend.tsx` | Change `bottom-4` to `top-4` on both collapsed and expanded states |

**Do NOT break:**
- Legend expand/collapse toggle behavior
- Color legend accuracy (colors must match actual node colors)
- Node/edge count display
- Dark/light theme appearance
- Click-through to graph nodes when legend is collapsed

**Verification:**
1. Open the Graph page
2. Legend appears at top-right corner (not bottom-right)
3. Click the legend to expand — it opens downward showing color legend
4. The SymbioAI chat button at bottom-right is fully visible and not covered
5. Switch between dark and light mode — legend looks correct in both

---

### SKB-31.8: Add Node Size Control Slider — 5 points, Medium

**Delivers:** A slider in the graph controls sidebar that lets users adjust the size of node dots in both 2D and 3D graph views.

**Acceptance Criteria:**
- A "Node Size" slider appears in the Graph Controls sidebar (near the existing "Min. connections" slider)
- Sliding left makes all nodes smaller (minimum dot size)
- Sliding right makes all nodes larger (maximum dot size)
- The slider has a reasonable default matching the current node size
- Changes take effect immediately as the slider is dragged
- The slider works for both 2D and 3D graph views
- A label shows the current value (e.g., "Node Size: 4")
- Node size still scales with link count (the slider adjusts the base size, not an absolute size)
- A "Reset" button next to the slider returns to the default size

**Current node sizing:**
- **2D:** `getNodeRadius(linkCount, 3)` — base radius is 3, formula: `sqrt(linkCount+1) * baseRadius`, clamped to max 20
- **3D:** Fixed `nodeRelSize={4}` — no dynamic sizing at all

**Implementation approach:**
1. In `GraphControls.tsx`: add a range input slider styled like the existing "Min. connections" slider
   - Min value: 1, Max: 10, Default: 3 (for 2D) / 4 (for 3D) — or use a single unified default of 4
   - Pass the value up via a new `onNodeSizeChange` prop
2. In `graph/page.tsx`: store `nodeSize` state, pass to GraphView, Graph3DView, and GraphControls
3. In `GraphView.tsx`: replace the hardcoded `3` in `getNodeRadius(node.linkCount, 3)` with the dynamic `nodeSize` value from props
   - Line 216: change to `getNodeRadius(node.linkCount, nodeSize)`
4. In `Graph3DView.tsx`: replace the hardcoded `nodeRelSize={4}` with the dynamic `nodeSize` value
   - Line 184: change to `nodeRelSize={nodeSize}`

**Files to modify:**
| File | Change |
|------|--------|
| `src/components/graph/GraphControls.tsx` | Add "Node Size" slider with label and reset button |
| `src/app/(workspace)/graph/page.tsx` | Add nodeSize state, pass to views and controls |
| `src/components/graph/GraphView.tsx` | Use dynamic nodeSize instead of hardcoded 3 |
| `src/components/graph/Graph3DView.tsx` | Use dynamic nodeSize instead of hardcoded 4 |

**Do NOT break:**
- Node coloring and highlighting
- Link-count-based size scaling (slider changes the base, not overrides the scale)
- Search highlighting (bigger glow on matched nodes)
- Node click navigation
- Node drag behavior
- Existing "Min. connections" slider

**Verification:**
1. Open Graph page in 2D mode
2. Drag "Node Size" slider to the right — all nodes get larger
3. Drag slider to the left — all nodes get smaller
4. Nodes with more connections are still relatively larger than orphan nodes
5. Click "Reset" — nodes return to default size
6. Switch to 3D mode — slider still works, nodes resize in 3D
7. Switch back to 2D — size setting preserved

---

### SKB-31.9: Scale Node Size by Document Content Length — 8 points, High

**Delivers:** Node dot size in the graph reflects the length of each page's content, so users can visually identify which documents are long (big dots) versus short (small dots).

**Acceptance Criteria:**
- Nodes for pages with more content appear as larger dots
- Nodes for pages with less content appear as smaller dots
- A page with no content (empty) appears as the minimum dot size
- The scaling is logarithmic (not linear) so a 10,000-word document isn't 100x the size of a 100-word document
- The "Node Size" slider from SKB-31.8 still works as a multiplier on top of the content-based sizing
- A toggle or radio button lets users choose between: "Size by connections" (current, default) and "Size by content length"
- The toggle appears in the Graph Controls sidebar near the Node Size slider
- When "Size by content length" is selected, the tooltip/hover on a node shows the word count
- Both 2D and 3D views respect the sizing mode

**Current data gap:**
- The `GraphNode` interface (`src/types/graph.ts`) currently only has: `id`, `label`, `icon`, `linkCount`, `updatedAt`
- No `contentLength` or `wordCount` field exists
- The graph API endpoint needs to include this data

**Implementation approach:**
1. **Schema/API layer:**
   - In `src/types/graph.ts`: add `contentLength: number` field to the `GraphNode` interface
   - In the graph data API endpoint (likely in `src/app/api/graph/route.ts` or similar): query the page content length when building graph nodes
   - Content length can be calculated from the TipTap JSON content stored in the database — count the text characters or words from the content blocks
   - If content is stored as JSON, use a utility to walk the document tree and sum text node lengths
2. **Sizing logic:**
   - Create a `getNodeRadiusByContent(contentLength: number, baseRadius: number)` function in `colorPalette.ts`
   - Use logarithmic scale: `Math.min(Math.max(Math.log10(contentLength + 1) * baseRadius, baseRadius), maxRadius)`
   - Example sizes: 0 chars → base, 100 chars → base×1.3, 1000 chars → base×2, 10000 chars → base×2.7
3. **Controls:**
   - In `GraphControls.tsx`: add a "Size by" toggle with options "Connections" and "Content length"
   - Pass the selected mode up via `onSizeModeChange` prop
4. **View integration:**
   - In `GraphView.tsx`: check the size mode — if "connections", use `getNodeRadius(linkCount, baseRadius)` (current); if "content", use `getNodeRadiusByContent(contentLength, baseRadius)`
   - In `Graph3DView.tsx`: use `nodeVal` callback to return dynamic size based on the sizing mode

**Files to modify:**
| File | Change |
|------|--------|
| `src/types/graph.ts` | Add `contentLength: number` to `GraphNode` interface |
| `src/app/api/graph/route.ts` (or equivalent) | Include content length in graph node data |
| `src/lib/graph/colorPalette.ts` | Add `getNodeRadiusByContent()` function |
| `src/components/graph/GraphControls.tsx` | Add "Size by" toggle (Connections / Content length) |
| `src/app/(workspace)/graph/page.tsx` | Add sizeMode state, pass to views and controls |
| `src/components/graph/GraphView.tsx` | Use sizeMode to switch between sizing functions |
| `src/components/graph/Graph3DView.tsx` | Use sizeMode with `nodeVal` callback for dynamic sizing |

**Do NOT break:**
- Graph data loading performance (content length should be a lightweight query, not full content fetch)
- Existing link-count-based sizing (it remains the default)
- Node coloring, highlighting, search
- The Node Size slider from SKB-31.8 (it acts as a multiplier regardless of sizing mode)
- Any existing API behavior

**Verification:**
1. Open Graph page, select "Size by: Content length" in controls
2. Nodes resize — pages with lots of content are visibly larger
3. Hover a node — tooltip shows word count or character count
4. Switch to "Size by: Connections" — nodes resize based on link count (original behavior)
5. Adjust the Node Size slider — it multiplies both sizing modes
6. Switch to 3D view — sizing mode still applies
7. The graph API still loads quickly (no performance regression)

---

## Test Coverage Requirements

| Story | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 31.1 | Label font size >= 8px; stroke applied before fill; dimmed alpha >= 0.6 | Labels visible in dark mode screenshot comparison | Switch dark mode, verify labels readable; search, verify dimmed labels readable |
| 31.2 | Slider renders; value changes update force strength | Graph re-simulates on slider change; nodes spread/cluster | Drag slider left → nodes cluster; drag right → nodes spread |
| 31.3 | SpriteText created for each node; opacity 0.6; toggle hides labels | Labels visible in 3D view; toggle hides them | Open 3D graph, see node names; uncheck "Show labels", names disappear |
| 31.4 | Edge label rendered at midpoint; hidden when unchecked | Labels appear/disappear with checkbox | Check "Show edge labels", see labels on edges; uncheck, they disappear |
| 31.5 | Zoom methods called on button click; ref is not null | Zoom level changes after button click | Click Zoom+, graph zooms in; repeat for all 4 buttons in both modes |
| 31.6 | Node glow rendered; edge color brighter | Visual comparison passes | Dark mode graph looks polished; edges visible; nodes have glow |
| 31.7 | Legend has `top-4` class, not `bottom-4` | Legend visible, not overlapped by chat button | Open graph, legend at top-right; AI chat button at bottom-right, no overlap |
| 31.8 | Slider renders; value changes update node radius | Nodes resize on slider drag; 2D and 3D both respond | Drag slider right → bigger nodes; drag left → smaller; reset → default |
| 31.9 | `contentLength` in GraphNode; logarithmic sizing function correct | API returns contentLength; nodes sized by content | Toggle "Size by content length", large docs = big dots, empty docs = small dots |

---

## Implementation Order

```
Phase 1: Quick wins
  31.5 (zoom fix) → 31.7 (legend move)

Phase 2: Core readability
  31.1 (dark mode labels) → 31.3 (3D labels) → 31.4 (edge labels)

Phase 3: Node sizing
  31.8 (size slider) → 31.9 (size by content — depends on 31.8)

Phase 4: Layout & polish
  31.2 (spacing slider) → 31.6 (visual polish)

┌──────┐    ┌──────┐
│ 31.5 │ →  │ 31.7 │
│ Zoom │    │Legend │
│ Fix  │    │Move  │
└──────┘    └──────┘
                        ┌──────┐    ┌──────┐    ┌──────┐
                        │ 31.1 │ →  │ 31.3 │ →  │ 31.4 │
                        │Label │    │ 3D   │    │ Edge │
                        │Dark  │    │Labels│    │Labels│
                        └──────┘    └──────┘    └──────┘
                                                            ┌──────┐    ┌──────┐
                                                            │ 31.8 │ →  │ 31.9 │
                                                            │ Size │    │Size× │
                                                            │Slider│    │Content│
                                                            └──────┘    └──────┘
                        ┌──────┐    ┌──────┐
                        │ 31.2 │ →  │ 31.6 │
                        │Space │    │Polish│
                        │Slider│    │      │
                        └──────┘    └──────┘
```

---

## Shared Constraints

- **Performance:** The graph must remain responsive with 50+ nodes. Label rendering and force changes must not drop frame rate below 30fps.
- **Theming:** All changes must work in both dark and light modes. Test both.
- **Two Views:** All functional changes (zoom, spacing, labels) must work in both 2D and 3D views where applicable.
- **No Breaking Changes:** Search, node click navigation, node drag, edge rendering, 2D/3D toggle must all continue working.
- **Library Compatibility:** Changes must work with `react-force-graph-2d` and `react-force-graph-3d` APIs. Check library docs before implementing.

---

## Files Modified by This Epic

| File | Action | Description |
|------|--------|-------------|
| `src/components/graph/GraphView.tsx` | Modify | Fix labels (font size, stroke, opacity), fix zoom ref, add edge labels, spacing force, node glow, dynamic node sizing |
| `src/components/graph/Graph3DView.tsx` | Modify | Add 3D node labels, fix zoom ref, add edge labels, spacing force, dynamic node sizing |
| `src/components/graph/GraphControls.tsx` | Modify | Add spacing slider, node size slider, "Size by" toggle, reset buttons |
| `src/components/graph/GraphLegend.tsx` | Modify | Move from bottom-right to top-right positioning |
| `src/app/(workspace)/graph/page.tsx` | Modify | Add spacing/nodeSize/sizeMode state, fix ref forwarding on view toggle |
| `src/lib/graph/colorPalette.ts` | Modify | Brighten dark mode edge color, adjust label colors, add `getNodeRadiusByContent()` |
| `src/types/graph.ts` | Modify | Add `contentLength` field to `GraphNode` interface |
| `src/app/api/graph/route.ts` | Modify | Include content length in graph node API response |
| `src/hooks/useGraphFilters.ts` | Possibly Modify | Persist spacing and node size values in URL params |

---

**Last Updated:** 2026-02-27
