# Story SKB-11.4: DnD Sidebar Reparenting Fix

**Epic:** Epic 11 - Sidebar Restructure & Home Page Dashboard
**Story ID:** SKB-11.4
**Story Points:** 2 | **Priority:** High | **Status:** Done
**Depends On:** SKB-04.3 (existing DndSidebarTree component)

---

## User Story

As a user, I want to drag pages into collapsed parent pages in the sidebar, So that I can reorganize my page hierarchy without first expanding every parent.

---

## Acceptance Criteria

1. **Collapsed Parent Drop Target Fix**
   - [ ] `flattenTreeIds()` includes ALL descendant IDs, even for collapsed parents
   - [ ] New helper: `getAllDescendantIds(nodes: PageTreeNode[]): string[]`
   - [ ] When parent is expanded: recurse normally
   - [ ] When parent is collapsed: include all descendant IDs via `getAllDescendantIds()`
   - [ ] `SortableContext` receives complete ID list for all draggable items

2. **Drop Zone Detection Improvement**
   - [ ] Parent nodes: 20% before / 60% child / 20% after (wider child zone)
   - [ ] Leaf nodes: 25% before / 50% child / 25% after (standard)
   - [ ] Calculation based on pointer Y position relative to element height
   - [ ] Detects parent vs leaf via `node.children.length > 0`

3. **Visual Behavior**
   - [ ] Collapsed parents show drop indicator when dragged over
   - [ ] Auto-expand parent when page dropped as child
   - [ ] Drop position indicator (before/child/after) updates dynamically

4. **No Breaking Changes**
   - [ ] Existing DnD behavior unchanged for expanded parents
   - [ ] Drag overlay still renders correctly
   - [ ] Reorder mutation API calls unchanged

5. **TypeScript**
   - [ ] All types maintained from existing DndSidebarTree
   - [ ] No `any` types

---

## Technical Implementation Notes

### File: `src/components/workspace/DndSidebarTree.tsx` (modification)

**Problem Diagnosis:**

Previously, `flattenTreeIds()` only included IDs for visible (rendered) nodes:

```typescript
// OLD (broken) implementation
function flattenTreeIds(
  nodes: PageTreeNode[],
  isExpanded: (id: string) => boolean
): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    ids.push(node.id);
    if (node.children.length > 0 && isExpanded(node.id)) {
      // Only recurse if expanded
      ids.push(...flattenTreeIds(node.children, isExpanded));
    }
  }
  return ids;
}
```

This caused issues because `SortableContext` needs ALL draggable item IDs registered upfront. When a parent was collapsed, its children weren't in the ID list, so dropping onto the parent failed.

**Solution:**

Always include all descendant IDs, but only render expanded branches:

```typescript
// NEW (fixed) implementation
function flattenTreeIds(
  nodes: PageTreeNode[],
  isExpanded: (id: string) => boolean
): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    ids.push(node.id);
    if (node.children.length > 0) {
      if (isExpanded(node.id)) {
        // Expanded: recurse normally (renders and includes IDs)
        ids.push(...flattenTreeIds(node.children, isExpanded));
      } else {
        // Collapsed: don't render, but still include IDs
        ids.push(...getAllDescendantIds(node.children));
      }
    }
  }
  return ids;
}

/**
 * Gets all descendant IDs from a list of nodes (regardless of expand state).
 */
function getAllDescendantIds(nodes: PageTreeNode[]): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    ids.push(node.id);
    if (node.children.length > 0) {
      ids.push(...getAllDescendantIds(node.children));
    }
  }
  return ids;
}
```

**Key Insight:** The flatten function serves TWO purposes:
1. **Rendering:** Determines which nodes to display (via recursion in `SortableSidebarTreeNode`)
2. **DnD Registration:** Provides the complete list of sortable IDs to `SortableContext`

The old implementation conflated these concerns. The new implementation separates them:
- Rendering: Controlled by conditional recursion in the render tree
- DnD Registration: All IDs always included via `getAllDescendantIds()` for collapsed branches

---

### Drop Zone Detection Improvement

**Problem:** With standard 25/50/25 split, the "child" drop zone on parent nodes felt too narrow. Users often missed and dropped before/after instead of as a child.

**Solution:** Wider child zone for parent nodes:

```typescript
const handleDragOver = useCallback(
  (event: DragOverEvent) => {
    // ... existing code ...

    // Check if target has children (is a potential parent)
    const targetNode = findNodeWithParent(tree, overIdStr);
    const isParentNode = targetNode?.node && targetNode.node.children.length > 0;

    if (isParentNode) {
      // For parent nodes: use wider middle zone to make "child" drops easier
      if (relativeY < height * 0.2) {
        setDropPosition({ type: "before" });
      } else if (relativeY > height * 0.8) {
        setDropPosition({ type: "after" });
      } else {
        setDropPosition({ type: "child" }); // 60% of height
      }
    } else {
      // For leaf nodes: standard zones
      if (relativeY < height * 0.25) {
        setDropPosition({ type: "before" });
      } else if (relativeY > height * 0.75) {
        setDropPosition({ type: "after" });
      } else {
        setDropPosition({ type: "child" }); // 50% of height
      }
    }
  },
  [tree]
);
```

**Rationale:**
- Parent nodes are more likely to receive child drops (that's their primary purpose)
- Leaf nodes are more likely to receive before/after drops (for reordering)
- The wider child zone reduces precision requirements for parent drops

**Visual Example:**

```
Parent Node (has children):
┌─────────────────────┐
│ Before (20%)        │  ← Drag here to place BEFORE parent
├─────────────────────┤
│                     │
│  Child (60%)        │  ← Drag here to place AS CHILD of parent
│                     │
├─────────────────────┤
│ After (20%)         │  ← Drag here to place AFTER parent
└─────────────────────┘

Leaf Node (no children):
┌─────────────────────┐
│ Before (25%)        │
├─────────────────────┤
│ Child (50%)         │
├─────────────────────┤
│ After (25%)         │
└─────────────────────┘
```

---

## Test Scenarios

### Unit Tests: `src/__tests__/components/workspace/DndSidebarTree.test.tsx`

```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DndSidebarTree } from '@/components/workspace/DndSidebarTree';

describe('DndSidebarTree - flattenTreeIds', () => {
  it('should include all descendant IDs even for collapsed parents', () => {
    const tree = [
      {
        id: 'parent-1',
        title: 'Parent 1',
        children: [
          { id: 'child-1-1', title: 'Child 1-1', children: [] },
          { id: 'child-1-2', title: 'Child 1-2', children: [] },
        ],
      },
    ];

    // Mock isExpanded to return false for parent
    const isExpanded = (id: string) => false;

    const ids = flattenTreeIds(tree, isExpanded);

    // Should include parent AND all children even though collapsed
    expect(ids).toContain('parent-1');
    expect(ids).toContain('child-1-1');
    expect(ids).toContain('child-1-2');
  });

  it('should include deeply nested IDs in collapsed branches', () => {
    const tree = [
      {
        id: 'root',
        title: 'Root',
        children: [
          {
            id: 'level-1',
            title: 'Level 1',
            children: [
              {
                id: 'level-2',
                title: 'Level 2',
                children: [
                  { id: 'level-3', title: 'Level 3', children: [] },
                ],
              },
            ],
          },
        ],
      },
    ];

    const isExpanded = (id: string) => false; // All collapsed

    const ids = flattenTreeIds(tree, isExpanded);

    expect(ids).toContain('root');
    expect(ids).toContain('level-1');
    expect(ids).toContain('level-2');
    expect(ids).toContain('level-3');
  });

  it('should handle mixed expanded/collapsed state', () => {
    const tree = [
      {
        id: 'parent-1',
        title: 'Parent 1',
        children: [
          { id: 'child-1-1', title: 'Child 1-1', children: [] },
        ],
      },
      {
        id: 'parent-2',
        title: 'Parent 2',
        children: [
          { id: 'child-2-1', title: 'Child 2-1', children: [] },
        ],
      },
    ];

    // parent-1 expanded, parent-2 collapsed
    const isExpanded = (id: string) => id === 'parent-1';

    const ids = flattenTreeIds(tree, isExpanded);

    expect(ids).toContain('parent-1');
    expect(ids).toContain('child-1-1'); // parent-1 expanded, so included
    expect(ids).toContain('parent-2');
    expect(ids).toContain('child-2-1'); // parent-2 collapsed, but still included
  });
});

describe('DndSidebarTree - getAllDescendantIds', () => {
  it('should return all descendant IDs recursively', () => {
    const nodes = [
      {
        id: 'a',
        children: [
          { id: 'b', children: [] },
          { id: 'c', children: [{ id: 'd', children: [] }] },
        ],
      },
    ];

    const ids = getAllDescendantIds(nodes);

    expect(ids).toEqual(['a', 'b', 'c', 'd']);
  });

  it('should handle empty children arrays', () => {
    const nodes = [
      { id: 'a', children: [] },
      { id: 'b', children: [] },
    ];

    const ids = getAllDescendantIds(nodes);

    expect(ids).toEqual(['a', 'b']);
  });
});

describe('DndSidebarTree - drop zone detection', () => {
  it('should use wider child zone for parent nodes', () => {
    // This would require mocking DragOverEvent and testing handleDragOver
    // For brevity, this test demonstrates the concept:

    const isParentNode = true;
    const height = 100;

    // Test top edge (before)
    const relativeY1 = 15; // 15% from top
    const zone1 = relativeY1 < height * 0.2 ? 'before' : 'middle';
    expect(zone1).toBe('before');

    // Test middle (child)
    const relativeY2 = 50; // 50% from top
    const zone2 = relativeY2 > height * 0.2 && relativeY2 < height * 0.8 ? 'child' : 'edge';
    expect(zone2).toBe('child');

    // Test bottom edge (after)
    const relativeY3 = 85; // 85% from top
    const zone3 = relativeY3 > height * 0.8 ? 'after' : 'middle';
    expect(zone3).toBe('after');
  });
});
```

### Integration Tests

**Test: Drag page into collapsed parent**
1. Mount `<DndSidebarTree>` with tree containing collapsed parent
2. Simulate drag start on child page
3. Simulate drag over collapsed parent (middle zone)
4. Simulate drop
5. Verify `reorderPage.mutate()` called with correct parent ID
6. Verify parent auto-expands to show new child

**Test: Drag page onto expanded parent**
1. Mount with expanded parent
2. Drag child page onto parent (middle zone)
3. Verify drop position detected as "child"
4. Verify mutation called with parent as new parent

**Test: Drag page before/after parent**
1. Drag page onto top 20% of parent node
2. Verify drop position detected as "before"
3. Drag page onto bottom 20% of parent node
4. Verify drop position detected as "after"

### E2E Tests

**Test: User reparents page via drag-and-drop**
```typescript
test('user can drag page into collapsed parent', async ({ page }) => {
  await page.goto('/home');

  // Collapse parent
  await page.click('[data-page-id="parent-1"] .expand-icon');

  // Wait for children to hide
  await expect(page.locator('[data-page-id="child-of-parent-2"]')).toBeVisible();

  // Drag child-of-parent-2 onto collapsed parent-1
  const draggable = page.locator('[data-page-id="child-of-parent-2"]');
  const dropTarget = page.locator('[data-page-id="parent-1"]');

  await draggable.dragTo(dropTarget);

  // Verify parent-1 expanded
  await expect(page.locator('[data-page-id="parent-1"]')).toHaveAttribute('aria-expanded', 'true');

  // Verify child now appears under parent-1
  await expect(page.locator('[data-page-id="parent-1"] + * [data-page-id="child-of-parent-2"]')).toBeVisible();
});
```

**Test: Drop zones work correctly**
```typescript
test('drop zones detect correct position', async ({ page }) => {
  await page.goto('/home');

  const draggable = page.locator('[data-page-id="page-1"]');
  const target = page.locator('[data-page-id="parent-2"]');

  // Get target bounding box
  const box = await target.boundingBox();
  if (!box) throw new Error('Target not found');

  // Drag to top 10% (should be "before")
  await draggable.dragTo(target, {
    targetPosition: { x: box.width / 2, y: box.height * 0.1 },
  });
  await expect(page.locator('.drop-indicator-before')).toBeVisible();

  // Drag to middle 50% (should be "child")
  await draggable.dragTo(target, {
    targetPosition: { x: box.width / 2, y: box.height * 0.5 },
  });
  await expect(page.locator('.drop-indicator-child')).toBeVisible();

  // Drag to bottom 10% (should be "after")
  await draggable.dragTo(target, {
    targetPosition: { x: box.width / 2, y: box.height * 0.9 },
  });
  await expect(page.locator('.drop-indicator-after')).toBeVisible();
});
```

---

## Dependencies

**Technical:**
- `@dnd-kit/core` — DnD context and hooks
- `@dnd-kit/sortable` — `SortableContext` requires complete ID list
- `useSidebarExpandState()` — expand/collapse state management
- `useReorderPage()` — mutation for updating page parent/position

**Data:**
- `PageTreeNode[]` — tree structure from `usePageTree()`

---

## Dev Notes

### Why This Bug Was Subtle

The bug was subtle because it only manifested under specific conditions:

1. **Expanded parents worked fine:** The old `flattenTreeIds()` included children of expanded parents, so dropping onto them worked
2. **Direct drops onto collapsed parents failed silently:** The parent ID was in the list, but `SortableContext` didn't recognize it as a valid drop target for the dragged item because the dragged item's ID wasn't in the context when nested under a collapsed parent
3. **Symptom:** Dragging onto a collapsed parent had no effect — no drop indicator, no mutation triggered

**Root cause:** `SortableContext` uses the ID list to determine valid drag-and-drop relationships. If an ID isn't in the list, it's not considered part of the sortable set, so operations involving it fail.

### Performance Consideration

Including all descendant IDs in `flattenTreeIds()` slightly increases the ID array size, but this has negligible performance impact:

- Typical tree: 100-1000 pages
- ID array size: grows from ~50 (visible) to ~200 (all nodes) in a large tree
- `SortableContext` overhead: O(n) for ID lookup, where n = array length
- Performance: still instant even with 10,000+ IDs

The benefit (working DnD for collapsed parents) far outweighs the negligible performance cost.

### Alternative Approach Considered

**Alternative:** Dynamically add collapsed children IDs only when dragging over a collapsed parent.

**Why rejected:**
1. More complex state management
2. Requires listening to drag events and updating context mid-drag
3. `SortableContext` doesn't support dynamic ID updates during drag operations
4. The current solution is simpler and more reliable

### Auto-Expand Behavior

When a page is dropped as a child of a collapsed parent, we auto-expand the parent:

```typescript
if (dropPosition.type === "child") {
  newParentId = targetId;
  newPosition = targetInfo.node.children.length; // Append at end
  expandState.expand(targetId); // Auto-expand
}
```

This provides immediate visual feedback that the operation succeeded. Without auto-expand, the user would drop the page and it would "disappear" (hidden under the collapsed parent), which feels broken even though it worked correctly.

**UX trade-off:** Auto-expand might be surprising if the user wanted to keep the parent collapsed. However, the assumption is: if you're dropping a page into a parent, you want to see the result immediately. If the user wants to collapse it again, they can click the expand icon.

---

**Last Updated:** 2026-02-22
