# Epic 30: Graph Sidebar — Compact Floating Window

**Epic ID:** EPIC-30
**Created:** 2026-02-25
**Total Story Points:** 16
**Priority:** Medium
**Status:** Draft

---

## Epic Overview

The knowledge graph sidebar currently takes the **full height** of the page when opened. Below the actual graph area (which is only ~250px tall), the rest of the sidebar is empty/grayed out space. The user wants the graph to appear as a **small, compact square window** in the top-right corner — showing just the graph and its controls, without the full-height gray overlay filling the rest of the page.

**Current behavior:**
```
┌─────────────────────────────────────────────────┐
│  Page Content                        │ Graph   │
│                                      │ (250px) │
│                                      │─────────│
│                                      │         │
│                                      │ (empty  │
│                                      │  gray   │
│                                      │  space) │
│                                      │         │
│                                      │         │
└─────────────────────────────────────────────────┘
```

**Desired behavior:**
```
┌─────────────────────────────────────────────────┐
│  Page Content                     ┌───────────┐ │
│                                   │   Graph   │ │
│                                   │  (square) │ │
│                                   │  Controls │ │
│                                   └───────────┘ │
│                                                 │
│  Page content continues underneath,             │
│  no gray overlay below the graph                │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Current CSS:** `absolute top-0 right-0 h-full w-[280px]` — full-height overlay
**Desired CSS:** `absolute top-16 right-4 w-72 h-80 rounded-lg shadow-lg` — compact floating window

---

## Business Value

- Less visual clutter — the graph window doesn't dominate the page
- More content visible while graph is open
- Professional appearance matching modern app patterns (floating panels)
- The grayed-out empty space below the graph is wasted and confusing

---

## Stories

| ID | Story | Points | Priority | File |
|----|-------|--------|----------|------|
| SKB-30.1 | Convert Graph Sidebar to Compact Floating Window | 5 | Medium | [SKB-30.1](SKB-30.1-convert-graph-sidebar-to-compact-floating-window.md) |
| SKB-30.2 | Align Toggle Arrows & Keep Header Buttons Visible | 3 | Medium | [SKB-30.2](SKB-30.2-align-toggle-arrows-keep-header-buttons-visible.md) |
| SKB-30.3 | Align Page Header Buttons with Breadcrumbs | 3 | Medium | [SKB-30.3](SKB-30.3-align-page-header-buttons-with-breadcrumbs.md) |
| SKB-30.4 | Sidebar Graph Controls Panel (2D/3D, Node Size) | 5 | Medium | [SKB-30.4](SKB-30.4-sidebar-graph-controls-panel.md) |

---

## Implementation Order

```
30.2 and 30.3 fix layout/positioning issues (do first).
30.1 converts to compact window (depends on 30.2).
30.4 adds controls panel (independent, after 30.1).

┌──────┐    ┌──────┐    ┌──────┐
│ 30.2 │ →  │ 30.1 │ →  │ 30.4 │
│Arrow │    │Compact│    │Graph │
│Align │    │Window │    │Ctrls │
└──────┘    └──────┘    └──────┘

┌──────┐
│ 30.3 │  (parallel with 30.2)
│Header│
│Align │
└──────┘
```

---

## Shared Constraints

- **No Breaking Changes:** Graph functionality (zoom, pan, node clicks, depth control) must all work in the smaller container
- **Theming:** Floating window must look correct in both light and dark themes (shadow, border, background)
- **Responsive:** Hidden on screens < lg breakpoint (existing behavior)
- **Z-Index:** Window must be above page content but below modals/dialogs/dropdowns
- **Performance:** No change to graph rendering performance — same canvas size or smaller

---

## Test Coverage Requirements

| Story | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 30.1 | Sidebar container has compact dimensions; no `h-full` class; has `rounded-xl shadow-xl` | Graph loads in compact window; depth controls functional | Open graph, verify compact window, verify page content accessible underneath, close graph |
| 30.2 | Both toggle buttons use same `top` value; sidebar starts below header buttons | Share/Favorite/Download buttons visible when sidebar open | Open sidebar, verify header buttons visible; toggle arrows at same height |
| 30.3 | Action buttons render inside breadcrumb bar, not absolute-positioned | Buttons at same Y as breadcrumbs; stay fixed on scroll | Verify buttons on same row as breadcrumbs; scroll page, buttons stay at top |
| 30.4 | 2D/3D toggle switches graph component; node size slider updates prop | Graph renders with custom node size; settings persist in localStorage | Toggle 2D/3D, adjust node size slider, refresh page — settings remembered |

---

## Files Modified by This Epic

| File | Action | Description |
|------|--------|-------------|
| `src/app/(workspace)/pages/[id]/page.tsx` | Modify | Change sidebar from full-height to compact floating window CSS; align toggle buttons; lower sidebar start position |
| `src/components/graph/LocalGraphSidebar.tsx` | Modify | Adjust graph to fill container; add close button |
| `src/components/workspace/PageHeader.tsx` | Modify | Move action buttons out of absolute positioning; export as separate component |
| `src/components/workspace/Breadcrumbs.tsx` | Modify | Add right-aligned slot for action buttons |
| `src/components/workspace/BreadcrumbsWrapper.tsx` | Modify | Pass page data and render action buttons in breadcrumb bar |
| `src/components/graph/GraphView.tsx` | Modify | Accept `baseNodeRadius` prop instead of hardcoded value |
| `src/components/graph/Graph3DView.tsx` | Modify | Accept dynamic `nodeRelSize` prop |
| CSS files | Possibly Modify | Remove full-height overlay shadow |

---

**Last Updated:** 2026-02-27
