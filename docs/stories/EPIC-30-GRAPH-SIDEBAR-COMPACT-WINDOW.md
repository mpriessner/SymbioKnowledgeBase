# Epic 30: Graph Sidebar — Compact Floating Window

**Epic ID:** EPIC-30
**Created:** 2026-02-25
**Total Story Points:** 8
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

---

## Implementation Order

```
30.2 should be done first (arrow alignment), then 30.1 (compact window):

┌──────┐    ┌──────┐
│ 30.2 │ →  │ 30.1 │
│Arrow │    │Compact│
│Align │    │Window │
└──────┘    └──────┘
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

---

## Files Modified by This Epic

| File | Action | Description |
|------|--------|-------------|
| `src/app/(workspace)/pages/[id]/page.tsx` | Modify | Change sidebar from full-height to compact floating window CSS; align toggle buttons; lower sidebar start position |
| `src/components/graph/LocalGraphSidebar.tsx` | Modify | Adjust graph to fill container; add close button |
| `src/components/workspace/PageHeader.tsx` | Possibly Modify | Ensure header buttons z-index is above sidebar |
| CSS files | Possibly Modify | Remove full-height overlay shadow |

---

**Last Updated:** 2026-02-27
