# Story SKB-18.4: Optional 3D Graph View

**Epic:** Epic 18 - Enhanced Graph Visualization
**Story ID:** SKB-18.4
**Story Points:** 6 | **Priority:** Low | **Status:** Planned
**Depends On:** SKB-18.3 (filters must work in both 2D and 3D)

---

## User Story

As a power user, I want to toggle between 2D and 3D graph views, So that I can explore spatial relationships and visualize complex knowledge networks in three dimensions.

---

## Acceptance Criteria

1. **Toggle Button:** "2D / 3D" in graph header
2. **3D View:** Uses `react-force-graph-3d` (WebGL, three.js)
3. **Same Data:** 3D view uses same nodes/edges as 2D
4. **Camera Controls:** Orbit, zoom, pan (built into 3D component)
5. **Performance Warning:** If > 500 nodes, show "May be slow" message
6. **WebGL Fallback:** Hide 3D toggle if WebGL unsupported

---

## Technical Implementation

**Graph3DView.tsx** wraps `ForceGraph3D` from `react-force-graph`.
**Graph3DToggle.tsx** button switches between GraphView and Graph3DView.
Install `react-force-graph` and `three` packages.

---

**Last Updated:** 2026-02-22
