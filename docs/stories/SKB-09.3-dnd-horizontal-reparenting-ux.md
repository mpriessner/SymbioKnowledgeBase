# Story SKB-09.3: Drag-and-Drop Horizontal Reparenting UX Improvement

**Epic:** Epic 09 — Theming and UI Polish
**Story ID:** SKB-09.3
**Story Points:** 3 | **Priority:** Medium | **Status:** Pending
**Depends On:** SKB-11.4 (DnD Reparenting Fix — existing horizontal nesting logic)

---

## User Story

As a user reorganizing my knowledge base, I want clear visual feedback when dragging a page left or right to change its nesting level, So that I can intuitively control whether a page becomes a subcategory (drag right) or a top-level page (drag left) without guessing.

---

## Context

The horizontal nesting gesture **already works** (implemented in SKB-11.4). When you drag a page 30px+ to the right of the target's content area, it registers as a "child" drop. However:

- There is **no visual indication** that dragging left/right changes behavior — users don't know the feature exists
- The **indentation preview** doesn't shift during the drag to show the resulting depth
- There is **no way to "un-nest"** a page by dragging it left (promote from subcategory to sibling)
- The drop indicator line doesn't change indentation to preview the final position

This story improves the UX so the left/right reparenting is discoverable and feels natural — similar to how Notion, Todoist, and Linear handle tree drag-and-drop.

---

## Acceptance Criteria

1. **Indentation Preview During Drag**
   - [ ] As the user drags horizontally, a ghost indentation line shows the target depth level
   - [ ] Dragging right: indentation preview shifts one level deeper (child of target)
   - [ ] Dragging left: indentation preview shifts one level shallower (sibling of target's parent)
   - [ ] Indentation snaps to valid depth levels (multiples of 16px) — no fractional positions
   - [ ] Maximum depth: 4 levels (configurable)

2. **Drop Indicator Line Shows Target Depth**
   - [ ] The blue drop indicator line (before/after) renders at the **target indentation level**, not the source level
   - [ ] When `wantsNest` is true: indicator line indented one level deeper than the hover target
   - [ ] When dragging left past the target's indent: indicator line at the target's parent level
   - [ ] Indicator line length adjusts to match the target depth (shorter line = deeper nesting)

3. **Left-Drag to Promote (Un-nest)**
   - [ ] Dragging a page to the LEFT of its current indentation level promotes it to a sibling of its current parent
   - [ ] Threshold: cursor moves 30px+ left of the current item's content edge
   - [ ] Drop position calculated: `parentId = target's grandparent`, `position = after target's parent`
   - [ ] Works for both before/after positions (not just child)
   - [ ] Cannot promote past root level (depth 0)

4. **Visual Feedback Enhancements**
   - [ ] Subtle depth-level guides: faint vertical lines at each indentation level during drag (like code editor indent guides)
   - [ ] These guides only appear while actively dragging — hidden otherwise to keep sidebar clean
   - [ ] Current valid drop depth highlighted with slightly brighter guide line
   - [ ] Tooltip or small label: "Move inside [Parent Name]" when nesting, "Move to top level" when promoting

5. **Cursor Feedback**
   - [ ] Cursor changes during horizontal movement to hint at nesting:
     - Standard drag cursor for vertical reordering
     - Right-arrow hint (or indent icon) when entering nest zone
     - Left-arrow hint (or outdent icon) when entering promote zone

6. **Sensitivity Tuning**
   - [ ] Nest threshold: 30px right of target content edge (keep current value)
   - [ ] Promote threshold: 30px left of source content edge (new)
   - [ ] Dead zone: 10px around current depth level where no reparenting occurs (prevents accidental nesting during vertical drag)
   - [ ] Vertical movement prioritized: if vertical delta > horizontal delta, don't change nesting (prevents accidental reparent during fast vertical drags)

---

## Technical Implementation Notes

### Modified Files

| File | Changes |
|------|---------|
| `DndSidebarTree.tsx` | Add left-drag promote logic, calculate target depth, emit depth info to indicator |
| `SortableSidebarTreeNode.tsx` | Render depth-aware indicator line, show indent guides during drag, cursor changes |
| `globals.css` | Add indent guide styles, drag cursor styles |

### Key Changes to `handleDragOver`

```typescript
// In DndSidebarTree.tsx handleDragOver callback

// Existing: nest detection (drag right)
const nestThreshold = 30;
const wantsNest = currentX > targetContentLeft + nestThreshold;

// New: promote detection (drag left)
const sourceDepth = (active.data?.current as { depth?: number })?.depth ?? 0;
const sourceContentLeft = overRect.left + 12 + sourceDepth * 16;
const promoteThreshold = 30;
const wantsPromote = currentX < sourceContentLeft - promoteThreshold;

// New: dead zone — ignore horizontal position if mostly vertical movement
const verticalDelta = Math.abs(deltaY);
const horizontalDelta = Math.abs(deltaX);
const isVerticalDrag = verticalDelta > horizontalDelta * 1.5;

// Calculate target depth for indicator
let targetDepth = overDepth;
if (!isVerticalDrag) {
  if (wantsNest) {
    targetDepth = overDepth + 1;
  } else if (wantsPromote && overDepth > 0) {
    targetDepth = overDepth - 1;
  }
}

setDropPosition({
  type: dropType,        // before | after | child
  targetDepth,           // New: for indicator line positioning
  isNesting: wantsNest,  // New: for visual feedback
  isPromoting: wantsPromote, // New: for visual feedback
});
```

### Depth-Aware Drop Indicator

```tsx
// In SortableSidebarTreeNode.tsx

// Before indicator — now uses targetDepth for indentation
{isDropTarget && dropPosition?.type === "before" && (
  <div
    className="h-0.5 rounded-full bg-blue-500 mx-2"
    style={{ marginLeft: `${12 + (dropPosition.targetDepth ?? depth) * 16}px` }}
  />
)}
```

### Indent Guides During Drag

```tsx
// Show faint vertical lines at each depth level while any drag is active
{isDraggingAny && (
  <div className="absolute inset-y-0 pointer-events-none">
    {Array.from({ length: maxDepth }, (_, i) => (
      <div
        key={i}
        className={`absolute top-0 bottom-0 w-px ${
          i === dropPosition?.targetDepth
            ? "bg-blue-300 dark:bg-blue-500"
            : "bg-gray-200 dark:bg-gray-700"
        }`}
        style={{ left: `${12 + i * 16}px` }}
      />
    ))}
  </div>
)}
```

### Promote Logic in `handleDragEnd`

```typescript
// In handleDragEnd — handle promote (un-nest)
if (dropPosition?.isPromoting && targetInfo) {
  // Move to be a sibling of target's parent
  const grandparent = findNodeWithParent(tree, targetInfo.parentId);
  newParentId = grandparent?.parentId ?? null; // null = root level
  newPosition = /* position after target's parent among its siblings */;
}
```

---

## Test Scenarios

| Scenario | Expected Result |
|----------|----------------|
| Drag page right over leaf node | Blue indicator indented one level deeper, "child" drop zone |
| Drag page right over parent node | Same as above, wider child zone (60%) |
| Drag page left past its current indent | Indicator at parent level, page promoted on drop |
| Drag page left at root level | No change — can't promote past root |
| Fast vertical drag with slight horizontal | No reparenting — dead zone protects against accidental nesting |
| Drag with horizontal movement | Indent guide lines appear at each depth level |
| Drop as child of collapsed parent | Parent auto-expands, page visible as child |
| Drop to promote deeply nested page | Page moves to grandparent level correctly |
| Indicator line during nest | Line shortened and indented to preview final position |
| Indicator line during promote | Line extended and moved left to preview final position |

---

## Design Reference

**Notion behavior:** Dragging left/right changes nesting. A horizontal blue line shows the exact target depth. The line length changes to indicate depth level.

**Todoist behavior:** Indent/outdent with left/right drag. Shows gray indent guides during drag.

**Key difference from Notion:** We add the indent guide lines (vertical depth markers) for extra clarity, since our sidebar can be quite deep.

---

## Definition of Done

- [ ] Dragging right nests page as subcategory (already works — verify preserved)
- [ ] Dragging left promotes page to parent level (new)
- [ ] Drop indicator line shows target depth (not source depth)
- [ ] Indent guide lines appear during drag
- [ ] Dead zone prevents accidental reparenting during vertical drags
- [ ] No regression in existing vertical reordering
- [ ] Works in both light and dark mode
- [ ] Unit tests for promote logic and depth calculation
- [ ] Manual verification: drag feels natural, no jitter or accidental nesting
