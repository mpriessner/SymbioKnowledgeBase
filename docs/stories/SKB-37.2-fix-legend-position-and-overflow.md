# SKB-37.2: Fix Legend Position and Overflow in Compact Graph Window

**Epic:** EPIC-37 — Local Graph Sidebar UI Fixes
**Points:** 3
**Priority:** High

## Problem

The `GraphLegend` component has two issues in the compact floating graph window:

1. **Wrong position** — The legend button (`27n - 118e`) is at `bottom-4 right-4`, which in the small floating window conflicts with the zoom controls on the right side and is not intuitively placed.

2. **Overflow on expand** — When the user clicks the legend button, the expanded legend panel grows upward from the bottom. In the small 288x320px container, the expanded content extends outside the visible area, making the color labels unreadable.

### Root Cause

**File:** `src/components/graph/GraphLegend.tsx`

Both the collapsed and expanded states use `absolute bottom-4 right-4` positioning (lines 30, 39). The expanded legend has ~4 color items + stats footer, totaling ~150px height, which exceeds the available space when the legend starts at `bottom-4` in a small container.

## Solution

### 1. Move legend to bottom-left

Change the legend position from `bottom-4 right-4` to `bottom-4 left-4` in both collapsed and expanded states. This avoids conflict with the zoom controls (which are at `top-2 right-2`).

**File:** `src/components/graph/GraphLegend.tsx`

```diff
- className="absolute bottom-4 right-4 rounded-lg border ..."
+ className="absolute bottom-4 left-4 rounded-lg border ..."
```

Apply to both the collapsed button (line 30) and expanded panel (line 39).

### 2. Expand legend upward but constrain to container

Add `max-height` and `overflow-y-auto` to the expanded legend so it does not extend outside the graph container. Also, since it is now at bottom-left, the expansion direction (upward) is fine as long as it's constrained:

```tsx
<div className="absolute bottom-4 left-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)]/90 p-3 backdrop-blur-sm max-h-[calc(100%-2rem)] overflow-y-auto">
```

### 3. Alternative: expand legend downward from top-left

If constraining upward expansion is not sufficient, move the legend to `top-2 left-2` (below the depth controls) and have it expand downward:

```tsx
{/* Collapsed */}
className="absolute bottom-4 left-4 ..."
{/* Expanded — could use bottom-4 left-4 with max-h constraint */}
className="absolute bottom-4 left-4 max-h-[calc(100%-2rem)] overflow-y-auto ..."
```

The recommended approach is **bottom-left with max-height constraint** since the user specifically asked for lower-left.

## Acceptance Criteria

- [ ] Legend button ("Xn - Ye") appears at the **bottom-left** of the graph container
- [ ] Legend does not overlap with zoom controls (top-right) or depth controls (top-left)
- [ ] When expanded, all 4 color labels (Page, Database, Orphan, Current page) are visible
- [ ] Expanded legend does not extend outside the floating window boundaries
- [ ] Legend works correctly in both the compact floating window and the full-page graph view
- [ ] Dark mode and light mode both render correctly

## Files to Modify

| File | Change |
|------|--------|
| `src/components/graph/GraphLegend.tsx` | Change `right-4` to `left-4`; add `max-h` and `overflow-y-auto` to expanded state |

## Testing

1. Navigate to any page with connections (so the floating graph shows)
2. Verify the legend button (`Xn - Ye`) is at the **bottom-left** corner
3. Click the legend button — verify the expanded panel shows all 4 color items
4. Verify the expanded panel does not overflow outside the floating window
5. Navigate to the full-page graph (`/graph`) and verify the legend still works correctly there
6. Test in both light and dark mode
7. Test with a page that has very few connections (small legend) and many connections (large legend)
