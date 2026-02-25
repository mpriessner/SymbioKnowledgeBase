# Epic 28: Table of Contents & Scroll Indicator Polish

**Epic ID:** EPIC-28
**Created:** 2026-02-25
**Total Story Points:** 13
**Priority:** Medium
**Status:** Draft

---

## Epic Overview

The Table of Contents (TOC) and scroll indicator bars work but have three UX issues:

1. **TOC panel is static.** It does not scroll with the user. It should remain sticky (always visible at the same screen position) as the user scrolls down the page, like a fixed sidebar that stays at the top-right.

2. **Scroll indicator bars have uneven spacing.** Currently the thin bars on the right edge are positioned based on the actual heading positions in the document (proportional to scroll height). This means some bars clump together and others are far apart. They should have **equal spacing** between them, regardless of where headings are in the document.

3. **Hovering over bars should show heading names.** Currently hovering a bar only changes its opacity. When a user hovers over a bar, a small tooltip or inline label should appear showing the heading name, aligned with the bar position.

---

## Current Implementation

```
CURRENT (bars positioned by actual heading position):
    │ ━━  Heading 1 (near top)
    │ ━━  Heading 2 (near top — clustered!)
    │ ━━  Heading 3 (near top — clustered!)
    │
    │
    │
    │ ━━  Heading 4 (far down — isolated)
    │
    │ ━━  Heading 5 (near bottom)

DESIRED (bars equally spaced, with hover labels):
    │ ━━  Heading 1           ← hover shows "Introduction"
    │
    │ ━━  Heading 2           ← hover shows "Architecture"
    │
    │ ━━  Heading 3           ← hover shows "API Design"
    │
    │ ━━  Heading 4           ← hover shows "Testing"
    │
    │ ━━  Heading 5           ← hover shows "Deployment"
```

**Key files:**
- `src/components/page/TOCPanel.tsx` — position: `absolute right-6 top-16`
- `src/components/page/ScrollIndicatorBars.tsx` — uses `proportionalTop * 100%` for positioning
- `src/hooks/useHeadingPositions.ts` — calculates `proportionalTop` from actual DOM positions
- `src/components/page/table-of-contents.css` — bar hover styles (opacity only)

---

## Business Value

- **Sticky TOC:** Users on long pages lose access to navigation when they scroll past the TOC
- **Equal spacing:** Visual clarity — users can quickly scan which section they're in
- **Hover labels:** Users can see heading names without opening the full TOC panel

---

## Stories Breakdown

### SKB-28.1: Make TOC Panel Sticky on Scroll — 5 points, High

**Delivers:** The TOC panel stays visible at a fixed screen position as the user scrolls down the page.

**Acceptance Criteria:**
- The TOC panel remains at the same vertical position on screen when scrolling
- It does not scroll out of view when the user scrolls down
- It does not overlap the page header or toolbar at the top
- It does not extend below the visible viewport (scrollable within its own container if there are many headings)
- On short pages with few headings, the TOC sits at its normal position without floating awkwardly
- The panel still opens/closes when clicking the indicator bars area

**Implementation approach:**
1. In `TOCPanel.tsx`: change from `absolute right-6 top-16` to `fixed` or `sticky` positioning
2. Use `position: sticky; top: 80px;` (below the page header) on the TOC container
3. Ensure the parent container has the correct overflow settings for sticky to work
4. The TOC panel's `max-h-[60vh]` already handles overflow — keep this for long heading lists
5. Test that the panel doesn't cover the header when at top of page

**Files to modify:**
| File | Change |
|------|--------|
| `src/components/page/TOCPanel.tsx` | Change positioning from absolute to sticky |
| `src/components/page/PageContent.tsx` | Ensure parent container supports sticky positioning |
| `src/components/page/TableOfContents.tsx` | Adjust wrapper if needed for sticky behavior |

**Do NOT break:**
- TOC panel open/close toggle behavior
- Click-to-scroll-to-heading functionality
- Active heading highlighting
- Scroll indicator bars interaction (hovering bars should still show/hide TOC)
- The TOC panel must not cover main page content or make it unclickable

**Verification:**
1. Open a long page with 5+ headings
2. Scroll down — TOC panel stays visible at the same position on screen
3. Click a heading in the TOC — page scrolls to that heading
4. The active heading updates as you scroll
5. Close the TOC panel — it hides; scroll indicator bars remain visible

---

### SKB-28.2: Equal Spacing for Scroll Indicator Bars — 4 points, Medium

**Delivers:** The thin colored bars on the right edge are evenly distributed vertically, regardless of where headings are in the document.

**Acceptance Criteria:**
- If there are 5 headings, the bars are spaced at 0%, 25%, 50%, 75%, 100% of the indicator strip height
- If there are 3 headings, bars are at 0%, 50%, 100%
- If there is 1 heading, the single bar is centered
- The active heading bar is still highlighted (different color/opacity)
- Clicking a bar still scrolls to the corresponding heading in the document
- The equal spacing makes it easy to visually identify which section you're in

**Implementation approach:**
1. In `ScrollIndicatorBars.tsx`: instead of using `proportionalTop * 100%` for the CSS `top` value, calculate even distribution:
   - `top = (index / (totalHeadings - 1)) * 100%` for each bar
   - Special case: if only 1 heading, place at 50%
2. Keep the `isActive` logic from `useHeadingPositions` for highlighting — that should still use actual scroll position to determine which heading is in view
3. Do NOT change the hook — only change how bar positions are rendered

**Files to modify:**
| File | Change |
|------|--------|
| `src/components/page/ScrollIndicatorBars.tsx` | Replace `proportionalTop` positioning with equal-interval calculation |

**Do NOT break:**
- Active heading detection (still based on actual scroll position)
- Bar click to scroll to heading
- Bar hover to show/hide TOC panel
- Bar colors and opacity transitions

---

### SKB-28.3: Show Heading Names on Bar Hover — 4 points, Medium

**Delivers:** When a user hovers over a scroll indicator bar, a tooltip appears showing the heading name.

**Acceptance Criteria:**
- Hover over any bar — a small label appears to the left of the bar showing the heading text
- The label is aligned vertically with the bar it belongs to
- The label appears with a slight fade-in (150ms transition)
- The label disappears when the mouse leaves the bar
- Labels don't overflow outside the viewport (flip to right side if too close to left edge)
- On mobile/touch devices, labels don't appear (no hover on touch)
- The heading name is truncated with "..." if longer than ~25 characters

**Implementation approach:**
1. In `ScrollIndicatorBars.tsx`: add a tooltip/label element next to each bar
2. Use CSS hover to show/hide the label: `opacity-0 group-hover:opacity-100`
3. Position the label to the left of the bar strip: `right-full mr-2`
4. Add a small background pill (semi-transparent) behind the text for readability
5. Truncate long heading names with `text-ellipsis overflow-hidden max-w-[200px]`

**Files to modify:**
| File | Change |
|------|--------|
| `src/components/page/ScrollIndicatorBars.tsx` | Add hover tooltip label for each bar |
| `src/components/page/table-of-contents.css` | Add tooltip transition styles if needed |

**Do NOT break:**
- Bar click to scroll to heading
- Bar hover to show/hide TOC panel (tooltip should coexist with panel trigger)
- Active heading highlighting
- Equal bar spacing from SKB-28.2

---

## Test Coverage Requirements

| Story | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 28.1 | TOCPanel has sticky positioning class; stays within viewport bounds | Panel visible after scrolling 500px down | Scroll long page, verify TOC stays visible, click heading, verify scroll |
| 28.2 | Bars rendered at equal intervals; 5 headings → 0/25/50/75/100% | Active bar updates on scroll | Visual check: bars evenly spaced, active bar highlighted |
| 28.3 | Tooltip renders on hover; truncated for long names | Tooltip positioned correctly left of bar | Hover bar, see heading name, move away, tooltip disappears |

---

## Implementation Order

```
28.2 (spacing) → 28.3 (hover labels, depends on spacing) → 28.1 (sticky, independent)

┌──────┐    ┌──────┐
│ 28.2 │ →  │ 28.3 │     ┌──────┐
│Space │    │Hover │     │ 28.1 │
│ Even │    │Label │     │Sticky│
└──────┘    └──────┘     └──────┘
                          (parallel)
```

---

## Shared Constraints

- **Performance:** `useHeadingPositions` hook should not re-calculate on every scroll event — it already uses `IntersectionObserver` or throttled scroll; do not degrade this
- **Theming:** Tooltip labels and bar colors must work in both light and dark themes
- **Responsive:** On screens narrower than `lg`, the TOC and bars should be hidden (already handled)
- **Z-Index:** TOC panel and tooltips must be above page content but below modals

---

## Files Modified by This Epic

| File | Action | Description |
|------|--------|-------------|
| `src/components/page/TOCPanel.tsx` | Modify | Change to sticky positioning |
| `src/components/page/ScrollIndicatorBars.tsx` | Modify | Equal spacing + hover tooltips |
| `src/components/page/PageContent.tsx` | Modify | Ensure parent supports sticky |
| `src/components/page/TableOfContents.tsx` | Possibly Modify | Adjust wrapper for sticky |
| `src/components/page/table-of-contents.css` | Modify | Tooltip transition styles |

---

**Last Updated:** 2026-02-25
