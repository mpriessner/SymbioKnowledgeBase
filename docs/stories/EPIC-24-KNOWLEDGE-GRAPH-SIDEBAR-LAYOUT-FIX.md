# Epic 24: Knowledge Graph Sidebar Layout Fix

**Epic ID:** EPIC-24
**Created:** 2026-02-25
**Total Story Points:** 5
**Priority:** High
**Status:** Draft

---

## Epic Overview

Epic 24 fixes two layout issues with the right-side knowledge graph sidebar on the page view:

1. **Sidebar pushes content instead of overlaying it.** The right sidebar currently uses a flexbox layout that shrinks the main content area when expanded. This causes the page text to be pushed to the left and reduces the readable content width. The desired behavior is for the sidebar to **overlay** (float over) the main content, so the text beneath remains full-width and readable. Below the graph sidebar area, the content should flow normally without any blockage.

2. **Sidebar toggle button overlaps with the Export Markdown button.** Both the sidebar expand/collapse toggle (`top-4`, `right-[280px]`) and the Export Markdown button (`top-2`, `right-4`) sit in the top-right corner of the page view. When the sidebar is open, they visually collide. The toggle button needs to be repositioned below the Export Markdown section so they are clearly separated.

Currently:
- Right sidebar: `w-[280px]` in a flex row, pushes `flex-1` main content left
- Toggle button: `absolute right-[280px] top-4 z-20`
- Export button: `absolute right-4 top-2 z-10` (in PageHeader)

**Dependencies:**
- Knowledge graph sidebar (EPIC-07 / EPIC-18 — done)
- Page layout and PageHeader (done)

---

## Business Value

- **Readability:** Users can view the knowledge graph without losing content width — especially important on narrower screens
- **Usability:** Clear separation of the toggle and export buttons prevents accidental clicks
- **Professional Polish:** Overlaying sidebar matches modern app patterns (VS Code panels, Notion comments sidebar)

---

## Architecture Summary

```
CURRENT LAYOUT (Flexbox — sidebar pushes content):
┌──────────────────────────────────────────────────────────┐
│  Left Sidebar  │     Main Content (shrinks)    │ Graph  │
│                │     ←── pushed left ──→        │ 280px  │
│                │                                │        │
└──────────────────────────────────────────────────────────┘

DESIRED LAYOUT (Overlay — sidebar floats over content):
┌──────────────────────────────────────────────────────────┐
│  Left Sidebar  │     Main Content (full width)           │
│                │                          ┌────────────┐ │
│                │                          │ Graph 280px│ │
│                │                          │ (overlaid) │ │
│                │                          └────────────┘ │
│                │     Content continues below...          │
└──────────────────────────────────────────────────────────┘

CURRENT BUTTON POSITIONS (overlapping):
    ┌──────────────────────────────────────┐
    │  [Export ↓]              [◀ Toggle]  │  ← both at top-2/top-4
    │                                      │
    └──────────────────────────────────────┘

DESIRED BUTTON POSITIONS (separated):
    ┌──────────────────────────────────────┐
    │  [Export ↓]                          │  ← top-2
    │                             [◀ Toggle]  ← below export, ~top-12
    │                                      │
    └──────────────────────────────────────┘
```

---

## Stories Breakdown

### SKB-24.1: Knowledge Graph Sidebar Overlay & Toggle Repositioning — 5 points, High

**Delivers:** The right sidebar overlays the main content instead of pushing it, and the sidebar toggle button is repositioned below the Export Markdown button so they don't overlap.

**Depends on:** Nothing (standalone fix)

---

## Test Coverage Requirements

| Story | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 24.1 | Sidebar has overlay positioning classes; toggle button positioned below export; main content width unchanged when sidebar open | Sidebar opens/closes with overlay; content scrollable beneath sidebar; toggle and export buttons don't overlap | Open sidebar → content stays full-width; close sidebar → toggle visible; export button always clickable |

---

## Implementation Order

```
24.1 (single story — standalone fix)

┌────────┐
│ 24.1   │
│ Layout │
│  Fix   │
└────────┘
```

---

## Shared Constraints

- **No Breaking Changes:** Graph sidebar must still function (collapsible, zoom, depth controls, navigation)
- **Theming:** Overlay sidebar must work in both light and dark themes
- **Responsive:** Sidebar still hidden on screens < lg breakpoint
- **Animation:** Maintain smooth 200ms transition for open/close
- **Keyboard Navigation:** Toggle button remains keyboard-accessible
- **Z-Index:** Sidebar overlay must sit above content but below modals/dialogs

---

## Files Modified by This Epic

| File | Action | Description |
|------|--------|-------------|
| `src/app/(workspace)/pages/[id]/page.tsx` | Modify | Change sidebar from flex item to overlay positioned; reposition toggle button |
| `src/components/workspace/PageHeader.tsx` | Possibly Modify | Adjust export button z-index if needed for clarity |
| Tests for layout behavior | Create | Verify overlay behavior, button separation, content width |

---

**Last Updated:** 2026-02-25
