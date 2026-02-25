# Story SKB-22.3: Expandable TOC Panel & Click Navigation

**Epic:** Epic 22 - Table of Contents & Scroll Spy Navigation
**Story ID:** SKB-22.3
**Story Points:** 8 | **Priority:** High | **Status:** Draft
**Depends On:** SKB-22.1 (heading data + active heading), SKB-22.2 (indicator bars as hover trigger)

---

## User Story

As a SymbioKnowledgeBase user, I want to hover over the scroll indicator bars and see a full Table of Contents panel with heading titles, and click any heading to jump directly to that section, So that I can quickly navigate long documents without scrolling manually.

---

## Acceptance Criteria

### TOC Panel Appearance
- [ ] Hovering over the indicator bar strip triggers the TOC panel to appear
- [ ] Panel appears as a floating card anchored to the right side of the content area, adjacent to the indicator bars
- [ ] Panel slides in from the right with a smooth animation (200ms ease-out)
- [ ] Panel has:
  - Semi-transparent background with backdrop blur (glassmorphism)
  - Subtle border and shadow
  - Rounded corners (8px)
  - Max width: 280px
  - Max height: 60vh with internal scroll if needed
  - Padding: 12px
- [ ] Panel disappears when the mouse leaves both the indicator strip AND the panel area
- [ ] A 200ms delay before hiding (prevents flicker when moving between strip and panel)

### Heading List
- [ ] All headings from the document are listed in document order
- [ ] Headings are indented by level:
  - H1: no indent (left-aligned, bold text, slightly larger font)
  - H2: 16px left indent (normal weight)
  - H3: 32px left indent (normal weight, slightly smaller/dimmer text)
- [ ] Each heading shows:
  - The heading's icon/emoji if present (from the heading block's emoji attribute, if any)
  - The heading text, truncated with ellipsis if too long (max 1 line)
- [ ] Headings are vertically stacked with 4px gap between items

### Active Section Highlight
- [ ] The heading corresponding to `activeHeadingId` is visually highlighted:
  - Bold text (or slightly brighter color in dark theme)
  - A small vertical bar/accent on the left side (2px wide, accent color)
  - Background: subtle highlight (var(--bg-hover) or similar)
- [ ] As the user scrolls the page (without hovering the TOC), the active highlight updates in real-time
- [ ] Smooth transition when active heading changes (150ms)

### Click to Navigate
- [ ] Clicking a heading in the TOC panel smooth-scrolls the page to that heading
- [ ] Uses `element.scrollIntoView({ behavior: "smooth", block: "start" })` on the heading's DOM element
- [ ] The `scroll-margin-top` CSS (from SKB-22.1) ensures the heading isn't hidden behind sticky headers
- [ ] After clicking, the TOC panel stays visible (user may want to click another heading)
- [ ] The active highlight immediately moves to the clicked heading

### Keyboard Navigation
- [ ] When the TOC panel is visible, pressing Arrow Down moves focus to the next heading
- [ ] Arrow Up moves focus to the previous heading
- [ ] Enter on a focused heading scrolls to it
- [ ] Escape closes the panel
- [ ] Tab order: indicator strip → first heading → subsequent headings
- [ ] Focus ring visible on focused heading (accessibility)

### Accessibility
- [ ] Panel has `role="navigation"` and `aria-label="Table of contents"`
- [ ] Each heading item has `role="link"` (or is a `<button>` with descriptive text)
- [ ] Active heading has `aria-current="true"`
- [ ] Panel announces to screen readers when it appears: "Table of contents, N headings"
- [ ] High contrast mode: bar and text colors meet WCAG AA contrast ratio

### Responsive & Theming
- [ ] Panel follows the indicator strip visibility (hidden on screens < 1024px)
- [ ] Dark theme: dark background with light text, accent color for active indicator
- [ ] Light theme: light background with dark text, accent color for active indicator
- [ ] Panel does not overlap the right sidebar (positions between content and sidebar)

### Edge Cases
- [ ] Very long heading text: truncated with ellipsis on the TOC panel
- [ ] 30+ headings: panel scrolls internally, active heading is auto-scrolled into view within the panel
- [ ] Heading text changes while panel is open: panel updates reactively
- [ ] Heading deleted while panel is open: heading removed from panel
- [ ] Page has no headings: indicator strip and panel are not rendered (handled by SKB-22.2)

---

## Architecture Overview

```
Expandable TOC Panel Architecture
───────────────────────────────────

Hover Trigger Flow:
───────────────────

User hovers indicator strip
        │
        ▼
ScrollIndicatorBars.onHoverChange(true)
        │
        ▼
TableOfContents sets isHovered = true
        │
        ▼
TOCPanel renders (animated slide-in from right)

User moves mouse to panel → stays visible
User moves mouse away from both strip AND panel → 200ms delay → hide

Component Tree:
───────────────

TableOfContents
├── ScrollIndicatorBars (hover trigger)
│     onHoverChange → isHovered state
│
└── TOCPanel (conditional, animated)
      ├── PanelHeader ("Table of Contents")
      └── HeadingList
            ├── TOCHeadingItem (H1: "Introduction" — active ●)
            ├── TOCHeadingItem (H2: "Overview")
            ├── TOCHeadingItem (H2: "Details")
            └── TOCHeadingItem (H3: "Sub-detail")

TOCPanel Positioning:
─────────────────────

┌──────────────────────────────────────┐ ┌──────────────┐
│  Main Content                         │ │ TOC Panel    │
│                                       │ │              │
│  # Introduction                       │ │ ● Intro      │ ← active
│  paragraph...                         │ │   Overview   │
│                                       │ │   Details    │
│  ## Overview                          │ │     Sub-det  │
│  paragraph...                         │ │              │
│                                       │ └──────────────┘
│  ## Details                           │ │▮│ indicator
│  paragraph...                         │ │ │ strip
│                                       │ │▮│
│  ### Sub-detail                       │ │ │
│  paragraph...                         │ │▮│
│                                       │ │ │
└──────────────────────────────────────┘ └──┘

Click Navigation:
─────────────────

User clicks "Details" in TOC panel
        │
        ▼
const element = document.getElementById("heading-details");
element.scrollIntoView({ behavior: "smooth", block: "start" });
        │
        ▼
IntersectionObserver detects "Details" heading entering viewport
        │
        ▼
activeHeadingId updates to "heading-details"
        │
        ▼
TOCPanel highlight moves to "Details"
```

---

## Implementation Steps

### Step 1: Create TOCPanel Component

**File: `src/components/page/TOCPanel.tsx`**

```typescript
interface TOCPanelProps {
  headings: TOCHeading[];
  activeHeadingId: string | null;
  isVisible: boolean;
  onHeadingClick: (headingId: string) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

// Renders a floating panel with heading list
// Animated entrance: translateX(100%) → translateX(0) over 200ms
// Animated exit: opacity 1 → 0 over 200ms
// Internal scroll for 10+ headings
// Auto-scrolls active heading into view within panel
```

### Step 2: Create TOCHeadingItem Component

**File: `src/components/page/TOCHeadingItem.tsx`**

```typescript
interface TOCHeadingItemProps {
  heading: TOCHeading;
  isActive: boolean;
  onClick: () => void;
  isFocused: boolean;
}

// Single heading item in the TOC list:
// - Indentation based on level (0px, 16px, 32px)
// - Font weight: H1 bold, H2/H3 normal
// - Font size: H1 14px, H2 13px, H3 12px
// - Active: accent left border + highlight bg + bold
// - Hover: bg highlight
// - Click: fires onClick
// - Truncate long text with text-overflow: ellipsis
```

### Step 3: Implement Smooth Scroll Navigation

Inside `TableOfContents.tsx`, add the click handler:

```typescript
function handleHeadingClick(headingId: string) {
  const element = document.getElementById(headingId);
  if (!element) return;

  element.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });

  // Immediately update active heading for responsive feel
  setActiveHeadingId(headingId);
}
```

### Step 4: Implement Hover Logic with Delay

Inside `TableOfContents.tsx`, manage the hover state:

```typescript
const [isStripHovered, setIsStripHovered] = useState(false);
const [isPanelHovered, setIsPanelHovered] = useState(false);
const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

const isPanelVisible = isStripHovered || isPanelHovered;

// When both unhover, wait 200ms before hiding
useEffect(() => {
  if (!isStripHovered && !isPanelHovered) {
    hideTimeoutRef.current = setTimeout(() => {
      // Panel will hide via isPanelVisible becoming false
    }, 200);
  } else {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
  }
  return () => { if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current); };
}, [isStripHovered, isPanelHovered]);
```

### Step 5: Implement Keyboard Navigation

Inside `TOCPanel`, add keyboard event handler:

```typescript
function handleKeyDown(e: React.KeyboardEvent) {
  const currentIndex = headings.findIndex(h => h.id === focusedId);

  switch (e.key) {
    case "ArrowDown":
      e.preventDefault();
      setFocusedId(headings[Math.min(currentIndex + 1, headings.length - 1)]?.id);
      break;
    case "ArrowUp":
      e.preventDefault();
      setFocusedId(headings[Math.max(currentIndex - 1, 0)]?.id);
      break;
    case "Enter":
      if (focusedId) onHeadingClick(focusedId);
      break;
    case "Escape":
      onClose();
      break;
  }
}
```

### Step 6: Add Panel Styles

**File: `src/components/page/table-of-contents.css`** (extend from SKB-22.2)

```css
.toc-panel {
  position: absolute;
  right: 24px;
  top: 60px;
  max-width: 280px;
  max-height: 60vh;
  overflow-y: auto;
  background: var(--bg-elevated);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border-secondary);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  padding: 12px;
  z-index: 20;
  transform: translateX(0);
  opacity: 1;
  transition: transform 200ms ease-out, opacity 200ms ease-out;
}

.toc-panel.entering {
  transform: translateX(20px);
  opacity: 0;
}

.toc-panel.exiting {
  opacity: 0;
  transition: opacity 150ms ease-in;
}

.toc-heading-item {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.4;
  transition: background-color 100ms ease, color 100ms ease;
}

.toc-heading-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.toc-heading-item.active {
  color: var(--text-primary);
  font-weight: 600;
  border-left: 2px solid var(--accent);
  padding-left: 6px;
  background: var(--bg-hover);
}

.toc-heading-item.level-1 { padding-left: 8px; font-size: 14px; font-weight: 600; }
.toc-heading-item.level-2 { padding-left: 24px; font-size: 13px; }
.toc-heading-item.level-3 { padding-left: 40px; font-size: 12px; color: var(--text-tertiary); }

.toc-heading-item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
```

### Step 7: Wire Panel into TableOfContents Container

**File: `src/components/page/TableOfContents.tsx`** (modify from SKB-22.2)

Add `TOCPanel` rendering alongside `ScrollIndicatorBars`:

```typescript
return (
  <>
    <ScrollIndicatorBars
      headings={headings}
      positions={positions}
      activeHeadingId={activeHeadingId}
      onHoverChange={setIsStripHovered}
    />
    {isPanelVisible && (
      <TOCPanel
        headings={headings}
        activeHeadingId={activeHeadingId}
        isVisible={isPanelVisible}
        onHeadingClick={handleHeadingClick}
        onMouseEnter={() => setIsPanelHovered(true)}
        onMouseLeave={() => setIsPanelHovered(false)}
      />
    )}
  </>
);
```

---

## Testing Requirements

### Unit Tests (20+ cases)

**File: `src/__tests__/components/page/TOCPanel.test.tsx`**

- Panel renders all headings from props
- Headings are in correct document order
- H1 items have level-1 class (no indent, bold)
- H2 items have level-2 class (16px indent)
- H3 items have level-3 class (32px indent)
- Active heading has "active" class and accent border
- Only one heading can be active at a time
- Clicking heading fires onHeadingClick with correct ID
- Panel has role="navigation" and aria-label
- Active heading has aria-current="true"
- Long heading text is truncated with ellipsis
- Panel scrolls when 10+ headings overflow
- Active heading auto-scrolled into view in panel

**File: `src/__tests__/components/page/TOCHeadingItem.test.tsx`**

- Renders heading text
- Shows correct indentation for level 1, 2, 3
- Active state shows highlight and bold
- Hover shows background highlight
- Click fires onClick handler
- Focus ring visible on focus
- Text truncated at one line

### Integration Tests (10+ cases)

**File: `src/__tests__/integration/toc-panel.test.tsx`**

- Hover indicator strip → TOC panel appears (animated)
- Move mouse to panel → panel stays visible
- Move mouse away from both → panel disappears after 200ms delay
- Click heading in panel → page scrolls to that section
- After click scroll → active heading updates in panel
- Scroll page while panel is open → active highlight moves
- Add heading in editor → panel updates with new heading
- Remove heading in editor → panel updates without removed heading
- Keyboard ArrowDown → focus moves to next heading
- Keyboard Enter on focused heading → page scrolls
- Keyboard Escape → panel closes

### E2E Tests (5+ cases)

**File: `src/__tests__/e2e/toc-panel.test.ts`**

- Hover right edge → TOC panel with heading titles appears
- Click "Details" heading → page smooth-scrolls to Details section
- Scroll page manually → active heading changes in panel
- Panel shows correct heading hierarchy (H1 bold, H2 indented, H3 more indented)
- Move mouse away from panel → panel fades out

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/page/TOCPanel.tsx` | Create | Floating TOC panel with heading list |
| `src/components/page/TOCHeadingItem.tsx` | Create | Individual heading item in TOC |
| `src/components/page/table-of-contents.css` | Modify | Add panel styles (extend from SKB-22.2) |
| `src/components/page/TableOfContents.tsx` | Modify | Add panel rendering and hover logic |
| `src/__tests__/components/page/TOCPanel.test.tsx` | Create | Panel unit tests |
| `src/__tests__/components/page/TOCHeadingItem.test.tsx` | Create | Heading item unit tests |
| `src/__tests__/integration/toc-panel.test.tsx` | Create | Integration tests |
| `src/__tests__/e2e/toc-panel.test.ts` | Create | E2E tests |

---

**Last Updated:** 2026-02-25
