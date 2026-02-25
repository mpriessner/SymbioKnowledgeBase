# Epic 22: Page Table of Contents & Scroll Spy Navigation

**Epic ID:** EPIC-22
**Created:** 2026-02-25
**Total Story Points:** 18
**Priority:** Medium
**Status:** Draft

---

## Epic Overview

Epic 22 implements Notion's scroll-position-aware Table of Contents feature. When a page has headings (H1, H2, H3), the right edge of the content area shows thin horizontal indicator bars — one per heading — positioned proportionally to their location in the document. The bar corresponding to the currently visible section is highlighted (bright white in dark theme, dark in light theme).

When the user hovers over these indicator bars, a full Table of Contents panel expands showing heading titles with proper indentation by level. Clicking any heading in the panel smooth-scrolls to that section. As the user scrolls the page, both the indicator bar highlight and the TOC panel highlight update in real-time.

Currently, SymbioKnowledgeBase has:
- A TipTap block editor with H1, H2, H3 heading support (via StarterKit)
- A right sidebar (280px, collapsible) with LocalGraphSidebar and a TOC placeholder
- A scrollable main content area (`overflow-y-auto`)
- No table of contents or scroll tracking of any kind

This epic adds:
1. **Heading extraction hook** — reactive extraction of headings from TipTap editor content with stable IDs
2. **Scroll spy** — IntersectionObserver-based tracking of which heading is currently in the viewport
3. **Right-edge indicator bars** — thin position-proportional bars along the right edge of the page, with active section highlight
4. **Expandable TOC panel** — hover over indicator bars to reveal full heading titles; click to navigate

**Dependencies:**
- EPIC-04 (Block Editor with TipTap) — must be working (done)
- Heading levels 1-3 via StarterKit (done)
- Right sidebar placeholder exists in `pages/[id]/page.tsx` (done)

---

## Business Value

- **Faster Navigation:** Long pages (1000+ words) become instantly navigable — users jump to any section in one click instead of scrolling
- **Orientation:** The scroll indicator bars give users a constant sense of "where am I?" in the document without any UI overhead
- **Progressive Disclosure:** Indicator bars are minimal and unobtrusive; full TOC only appears on hover — no screen real estate wasted
- **Notion Parity:** This is a signature Notion UX feature that power users expect; missing it feels like a gap

---

## Architecture Summary

```
Table of Contents & Scroll Spy Architecture
──────────────────────────────────────────────

Page Layout (current):
┌─────────────────────────────────────────────────────────────────────┐
│ ┌───────────┐ ┌──────────────────────────────────────┐ ┌────────┐ │
│ │           │ │  Main Content (scrollable)            │ │ Right  │ │
│ │  Sidebar  │ │                                       │ │Sidebar │ │
│ │  (nav)    │ │  PageHeader                           │ │(graph) │ │
│ │           │ │  BlockEditor                          │ │        │ │
│ │           │ │    H1: Introduction                   │ │        │ │
│ │           │ │    paragraph...                       │ │        │ │
│ │           │ │    H2: Overview                       │ │        │ │
│ │           │ │    paragraph...                       │ │        │ │
│ │           │ │    H2: Details                        │ │        │ │
│ │           │ │    paragraph...                       │ │        │ │
│ │           │ │    H3: Sub-detail                     │ │        │ │
│ │           │ │    paragraph...                       │ │        │ │
│ │           │ │  BacklinksPanel                       │ │        │ │
│ └───────────┘ └──────────────────────────────────────┘ └────────┘ │
└─────────────────────────────────────────────────────────────────────┘

After this epic — adds indicator bars + expandable TOC:
┌─────────────────────────────────────────────────────────────────────┐
│ ┌───────────┐ ┌──────────────────────────────────┐│┐ ┌────────┐   │
│ │           │ │  Main Content (scrollable)        ││▮│ Right   │   │
│ │  Sidebar  │ │                                   ││ │ Sidebar │   │
│ │           │ │  H1: Introduction     ←currently  ││▮│ (graph) │   │
│ │           │ │  paragraph...           visible   ││ │         │   │
│ │           │ │  H2: Overview                     ││▮│         │   │
│ │           │ │  paragraph...                     ││ │         │   │
│ │           │ │  H2: Details                      ││▮│         │   │
│ │           │ │  paragraph...                     ││ │         │   │
│ │           │ │  H3: Sub-detail                   ││▮│         │   │
│ │           │ │  paragraph...                     ││ │         │   │
│ └───────────┘ └──────────────────────────────────┘│┘ └────────┘   │
│                                                    │               │
│                                              Indicator bars        │
│                                              (▮ = active,         │
│                                               ▮ = inactive)       │
└─────────────────────────────────────────────────────────────────────┘

On hover over indicator bars:
┌──────────────────────────────────┐┌────────────────────────┐
│  Main Content                     ││ ● Introduction  ← bold │
│                                   ││   Overview             │
│                                   ││   Details              │
│                                   ││     Sub-detail         │
│                                   ││                        │
└──────────────────────────────────┘└────────────────────────┘
                                     TOC Panel (floating)
```

---

## Stories Breakdown

### SKB-22.1: Heading Extraction & Scroll Spy Hook — 5 points, High

**Delivers:** A `useTableOfContents` hook that (1) extracts headings from TipTap editor content reactively, (2) assigns stable anchor IDs to heading DOM elements, and (3) tracks which heading is currently in the viewport via IntersectionObserver.

**Depends on:** Nothing (foundational hook)

---

### SKB-22.2: Right-Edge Scroll Indicator Bars — 5 points, Medium

**Delivers:** Thin horizontal indicator bars along the right edge of the page content area. Each bar corresponds to a heading. The bar for the currently visible section is highlighted. Bars are positioned proportionally to the heading's location in the document.

**Depends on:** SKB-22.1 (heading data and active heading tracking)

---

### SKB-22.3: Expandable TOC Panel & Click Navigation — 8 points, High

**Delivers:** When the user hovers over the indicator bars, a floating panel appears showing the full Table of Contents with heading titles indented by level. The active section is highlighted. Clicking a heading smooth-scrolls to that section. The panel auto-hides when the mouse leaves.

**Depends on:** SKB-22.1 (heading data), SKB-22.2 (indicator bar area as hover trigger)

---

## Test Coverage Requirements

| Story | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 22.1 | Heading extraction from TipTap JSON; ID assignment; active heading tracking | Editor with headings → hook returns correct list; scroll → active heading updates | - |
| 22.2 | Bar count matches heading count; active bar highlighted; proportional positioning | Bars render alongside editor; scroll changes active bar | Scroll page → active bar moves |
| 22.3 | TOC panel renders headings; indentation by level; active item highlight | Hover bars → panel appears; click heading → scroll position changes | Hover → TOC visible; click H2 → page scrolls to H2 |

---

## Implementation Order

```
22.1 → 22.2 → 22.3

┌────────┐     ┌────────┐     ┌────────┐
│ 22.1   │────▶│ 22.2   │────▶│ 22.3   │
│ Hook   │     │ Bars   │     │ Panel  │
└────────┘     └────────┘     └────────┘
```

---

## Shared Constraints

- **No New Dependencies:** Use native IntersectionObserver, CSS positioning, and existing TipTap APIs — no external TOC or scroll-spy libraries
- **Performance:** Heading extraction must not re-run on every keystroke — debounce or use TipTap's `onUpdate` with content comparison
- **Responsive:** Indicator bars hidden on screens < 768px (not enough space)
- **Theming:** Bars and TOC panel support light and dark themes via CSS custom properties
- **Accessibility:** TOC panel has `role="navigation"`, `aria-label="Table of contents"`, headings are focusable, keyboard navigable (Arrow Up/Down + Enter)
- **TypeScript Strict:** No `any` types in new code
- **Minimal Footprint:** Indicator bars are ~4px wide, positioned absolutely — zero layout impact on main content

---

## Files Created/Modified by This Epic

### New Files
- `src/hooks/useTableOfContents.ts` — Heading extraction + scroll spy hook
- `src/components/page/ScrollIndicatorBars.tsx` — Right-edge indicator bars
- `src/components/page/TOCPanel.tsx` — Expandable table of contents panel
- `src/components/page/TableOfContents.tsx` — Container orchestrating bars + panel
- Tests for each component and hook

### Modified Files
- `src/app/(workspace)/pages/[id]/page.tsx` — Mount TableOfContents alongside content area
- `src/components/editor/BlockEditor.tsx` — Expose editor instance ref for heading extraction
- `src/components/editor/editor.css` — Add heading anchor styles (scroll-margin-top)

---

**Last Updated:** 2026-02-25
