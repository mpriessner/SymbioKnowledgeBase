# Story SKB-22.2: Right-Edge Scroll Indicator Bars

**Epic:** Epic 22 - Table of Contents & Scroll Spy Navigation
**Story ID:** SKB-22.2
**Story Points:** 5 | **Priority:** Medium | **Status:** Draft
**Depends On:** SKB-22.1 (useTableOfContents hook must provide headings and activeHeadingId)

---

## User Story

As a SymbioKnowledgeBase user reading a long page, I want to see subtle indicator bars along the right edge of the content area that show me where sections are and which section I'm currently reading, So that I always know my position in the document without any extra effort.

---

## Acceptance Criteria

### Bar Rendering
- [ ] A vertical strip (~20px wide) is positioned along the right edge of the main content area
- [ ] One horizontal bar per heading in the document
- [ ] Bars are thin (2-4px height) with rounded ends
- [ ] Bars are positioned proportionally: if a heading is at 30% of the document height, its bar is at 30% of the strip height
- [ ] The strip only appears when the page has 2+ headings (not useful for 0-1)
- [ ] Bars are absolutely positioned within the content area — they do NOT affect content layout or width

### Active Bar Highlight
- [ ] The bar corresponding to the `activeHeadingId` (from the scroll spy) is highlighted
- [ ] Active bar: bright white in dark theme, dark grey in light theme (high contrast)
- [ ] Inactive bars: dim grey (opacity ~0.3) in both themes
- [ ] Transition: active bar change animates smoothly (200ms opacity/color transition)

### Proportional Positioning
- [ ] Bar positions are calculated from heading element positions relative to the total document height
- [ ] Formula: `barTop = (headingElement.offsetTop / scrollableHeight) * stripHeight`
- [ ] Positions recalculate when:
  - Content changes (headings added/removed/reordered)
  - Window/container resizes
  - Images load (can shift heading positions)
- [ ] Debounced position recalculation (200ms) to avoid excessive layout reads

### Visual Design
- [ ] Strip background: transparent (bars float over content edge)
- [ ] Bar width: 16px (fits within the content padding/margin)
- [ ] Bar height: 3px with `border-radius: 1.5px`
- [ ] Bar spacing: minimum 4px between bars (if headings are very close together, bars don't overlap)
- [ ] The entire strip is semi-transparent when the page is not hovered, and becomes more visible on hover
- [ ] Strip fades in/out smoothly (300ms transition)

### Responsive Behavior
- [ ] Indicator bars are hidden on screens < 1024px (not enough horizontal space)
- [ ] Bars are visible on screens >= 1024px
- [ ] Bars adjust position when the content area resizes (e.g., right sidebar collapses/expands)

### Mouse Interaction
- [ ] Hovering anywhere on the indicator strip is the trigger for the TOC panel (SKB-22.3)
- [ ] The strip area has `cursor: pointer` on hover
- [ ] The strip captures hover events and passes them up to the parent TableOfContents component

### Edge Cases
- [ ] Page with 0 headings: strip not rendered
- [ ] Page with 1 heading: strip not rendered (not useful)
- [ ] Page with 50+ headings: bars render correctly, minimum spacing maintained (some may be very close)
- [ ] Very short page (no scroll needed): bars still render proportionally
- [ ] Editor in read-only mode: bars still work

---

## Architecture Overview

```
ScrollIndicatorBars Component
──────────────────────────────

Positioning within page layout:
┌───────────────────────────────────────────────────────────────┐
│  Main Content Area (overflow-y-auto)                           │
│  ┌─────────────────────────────────────────────────────┐┌──┐ │
│  │                                                      ││▮ │ │
│  │  # Introduction                                      ││  │ │
│  │  paragraph...                                        ││▮ │ │
│  │                                                      ││  │ │
│  │  ## Overview                                         ││▮ │ │← active
│  │  paragraph...                                        ││  │ │
│  │  paragraph...                                        ││▮ │ │
│  │                                                      ││  │ │
│  │  ## Details                                          ││▮ │ │
│  │  paragraph...                                        ││  │ │
│  │                                                      ││  │ │
│  │  ### Sub-detail                                      ││  │ │
│  │  paragraph...                                        ││  │ │
│  │                                                      ││  │ │
│  └─────────────────────────────────────────────────────┘└──┘ │
│                                                    strip (20px)│
└───────────────────────────────────────────────────────────────┘

Props Flow:
───────────

useTableOfContents(editor, scrollRef)
  │ headings: TOCHeading[]
  │ activeHeadingId: string | null
  ▼
TableOfContents (container)
  │
  ├── ScrollIndicatorBars
  │     Props: headings, activeHeadingId, scrollContainerRef
  │     Calculates: bar positions from heading element offsets
  │     Renders: absolutely positioned bars
  │     Events: onMouseEnter → show TOC panel
  │
  └── TOCPanel (SKB-22.3)

Position Calculation:
─────────────────────

scrollContainer.scrollHeight = 3000px (total document height)
stripElement.clientHeight = 600px (visible strip height)

Heading "Overview" → offsetTop = 900px
  barTop = (900 / 3000) * 600 = 180px from strip top

Heading "Details" → offsetTop = 1800px
  barTop = (1800 / 3000) * 600 = 360px from strip top
```

---

## Implementation Steps

### Step 1: Create useHeadingPositions Hook

**File: `src/hooks/useHeadingPositions.ts`**

```typescript
interface HeadingPosition {
  id: string;
  proportionalTop: number; // 0.0 - 1.0 (fraction of total document)
}

export function useHeadingPositions(
  headings: TOCHeading[],
  scrollContainerRef: React.RefObject<HTMLElement>
): HeadingPosition[] {
  // 1. For each heading, find the DOM element by ID
  // 2. Calculate its offsetTop relative to the scroll container
  // 3. Divide by scrollContainer.scrollHeight to get proportional position
  // 4. Recalculate on:
  //    - headings array change
  //    - window resize (debounced)
  //    - ResizeObserver on scroll container
  //    - Images loaded (MutationObserver watching for img load events)
}
```

### Step 2: Create ScrollIndicatorBars Component

**File: `src/components/page/ScrollIndicatorBars.tsx`**

```typescript
interface ScrollIndicatorBarsProps {
  headings: TOCHeading[];
  activeHeadingId: string | null;
  positions: HeadingPosition[];
  onHoverChange: (isHovered: boolean) => void;
}

// Renders:
// <div className="absolute right-0 top-0 bottom-0 w-5" onMouseEnter/Leave>
//   {positions.map(pos => (
//     <div
//       key={pos.id}
//       className={`indicator-bar ${pos.id === activeHeadingId ? "active" : ""}`}
//       style={{ top: `${pos.proportionalTop * 100}%` }}
//     />
//   ))}
// </div>
```

### Step 3: Create TableOfContents Container

**File: `src/components/page/TableOfContents.tsx`**

```typescript
interface TableOfContentsProps {
  editor: Editor | null;
  scrollContainerRef: React.RefObject<HTMLElement>;
}

// Orchestrates:
// 1. useTableOfContents(editor, scrollContainerRef) → headings, activeHeadingId
// 2. useHeadingPositions(headings, scrollContainerRef) → positions
// 3. Render ScrollIndicatorBars
// 4. Manage hover state for TOC panel (SKB-22.3)
// 5. Only render if headings.length >= 2
```

### Step 4: Mount in Page View

**File: `src/app/(workspace)/pages/[id]/page.tsx`** (modify)

Add `TableOfContents` as a sibling of the content area, positioned absolutely on the right edge:

```typescript
<div className="flex-1 min-w-0 overflow-y-auto relative" ref={scrollContainerRef}>
  <PageHeader ... />
  <BlockEditor ref={editorRef} ... />
  <BacklinksPanel ... />
  <LocalGraph ... />

  {/* Table of Contents indicator bars */}
  <TableOfContents editor={editorRef.current} scrollContainerRef={scrollContainerRef} />
</div>
```

### Step 5: Add CSS Styles

**File: `src/components/page/table-of-contents.css`**

```css
.toc-indicator-strip {
  position: sticky;
  top: 0;
  right: 0;
  width: 20px;
  height: 100vh;
  pointer-events: auto;
  z-index: 10;
  opacity: 0.4;
  transition: opacity 300ms ease;
}

.toc-indicator-strip:hover {
  opacity: 1;
}

.indicator-bar {
  position: absolute;
  right: 2px;
  width: 16px;
  height: 3px;
  border-radius: 1.5px;
  background: var(--text-tertiary);
  transition: background-color 200ms ease, opacity 200ms ease;
}

.indicator-bar.active {
  background: var(--text-primary);
}

/* Hide on smaller screens */
@media (max-width: 1023px) {
  .toc-indicator-strip {
    display: none;
  }
}
```

---

## Testing Requirements

### Unit Tests (15+ cases)

**File: `src/__tests__/hooks/useHeadingPositions.test.ts`**

- Returns empty array when headings is empty
- Returns proportional positions for 3 headings
- Position is 0.0 for heading at top of document
- Position is ~1.0 for heading near bottom
- Positions recalculate on heading array change
- Positions recalculate on container resize

**File: `src/__tests__/components/page/ScrollIndicatorBars.test.tsx`**

- Renders correct number of bars matching heading count
- Active bar has "active" class
- Inactive bars don't have "active" class
- Bars positioned at correct proportional top
- onHoverChange fires true on mouseEnter
- onHoverChange fires false on mouseLeave
- No bars rendered when headings is empty
- Cursor is pointer on strip hover

**File: `src/__tests__/components/page/TableOfContents.test.tsx`**

- Not rendered when editor has 0 headings
- Not rendered when editor has 1 heading
- Rendered when editor has 2+ headings
- Passes correct props to ScrollIndicatorBars

### Integration Tests (6+ cases)

**File: `src/__tests__/integration/scroll-indicator-bars.test.tsx`**

- Render page with 5 headings → 5 indicator bars visible
- Scroll to third heading → third bar becomes active
- Add heading in editor → new bar appears
- Remove heading → bar disappears
- Collapse right sidebar → bars reposition correctly
- Resize window → bars reposition correctly

### E2E Tests (3+ cases)

**File: `src/__tests__/e2e/scroll-indicator-bars.test.ts`**

- Page with headings shows indicator bars on right edge
- Scroll down → active bar moves to lower bar
- Narrow viewport (< 1024px) → bars hidden

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/hooks/useHeadingPositions.ts` | Create | Proportional position calculation hook |
| `src/components/page/ScrollIndicatorBars.tsx` | Create | Indicator bar rendering component |
| `src/components/page/TableOfContents.tsx` | Create | Container orchestrating bars + panel |
| `src/components/page/table-of-contents.css` | Create | Styles for indicator strip and bars |
| `src/app/(workspace)/pages/[id]/page.tsx` | Modify | Mount TableOfContents in page view |
| `src/components/editor/BlockEditor.tsx` | Modify | Expose editor ref for parent access |
| `src/__tests__/hooks/useHeadingPositions.test.ts` | Create | Position hook tests |
| `src/__tests__/components/page/ScrollIndicatorBars.test.tsx` | Create | Bar component tests |
| `src/__tests__/components/page/TableOfContents.test.tsx` | Create | Container tests |
| `src/__tests__/integration/scroll-indicator-bars.test.tsx` | Create | Integration tests |
| `src/__tests__/e2e/scroll-indicator-bars.test.ts` | Create | E2E tests |

---

**Last Updated:** 2026-02-25
