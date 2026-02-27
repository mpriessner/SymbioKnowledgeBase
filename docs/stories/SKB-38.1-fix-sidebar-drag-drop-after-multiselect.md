# SKB-38.1: Fix Sidebar Drag-and-Drop Broken by Multi-Select

**Epic:** EPIC-38 — Sidebar Drag-and-Drop Regression Fix
**Points:** 3
**Priority:** Critical

## Problem

After implementing multi-select (Cmd/Ctrl+Click to select multiple pages), single-page drag-and-drop in the sidebar stopped working entirely. Users can no longer:
- Drag pages to reorder them within the same level
- Drag pages into other pages to create subpages (reparenting)
- Drag pages out of a parent to move them to the root level

This is a critical regression because drag-and-drop is the primary way users organize their page hierarchy.

### Root Cause

**File:** `src/components/workspace/SortableSidebarTreeNode.tsx`

The conditional rendering block (around lines 234-283) switches between two mutually exclusive buttons:

```tsx
{(showCheckboxes || isHovered) ? (
  // Checkbox button — NO drag listeners attached
  <button onClick={...}>
    {isNodeSelected && <Check />}
  </button>
) : (
  // Drag handle button — HAS {...attributes} and {...listeners}
  <button {...attributes} {...listeners}>
    <GripVertical />
  </button>
)}
```

When `showCheckboxes` is true (i.e., `selectionCount > 0`), the drag handle with `{...listeners}` never renders. Since `@dnd-kit`'s `PointerSensor` relies on these listeners to detect drag events, dragging becomes impossible.

Even when no pages are selected, hovering over a node sets `isHovered = true`, which also triggers the checkbox branch (since `showCheckboxes || isHovered` is `true`).

## Solution

### Approach: Always attach drag listeners, show checkbox/handle as CSS overlay

Instead of conditionally rendering two different buttons, always render the drag handle with `{...listeners}` but visually show a checkbox or grip icon depending on the state:

```tsx
{/* Single button that always has drag listeners */}
<button
  className={`
    flex-shrink-0 w-4 h-8 flex items-center justify-center
    ${showCheckboxes || isHovered ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"}
    ${isHovered ? "opacity-100" : "opacity-0"}
    transition-opacity
  `}
  {...attributes}
  {...listeners}
  onClick={(e) => {
    // If in multi-select mode, handle as checkbox click
    if (showCheckboxes || e.metaKey || e.ctrlKey) {
      e.stopPropagation();
      multiSelect?.handleMultiSelectClick(node.id, {
        ...e,
        metaKey: true,
        ctrlKey: false,
        shiftKey: false,
      } as React.MouseEvent);
    }
    // Otherwise, the click on the drag handle does nothing (drag is via pointer move)
  }}
  tabIndex={-1}
  aria-label={showCheckboxes ? (isNodeSelected ? `Deselect ${node.title}` : `Select ${node.title}`) : "Drag to reorder"}
>
  {showCheckboxes ? (
    // Show checkbox icon
    <span className={`w-4 h-4 flex items-center justify-center rounded border transition-colors
      ${isNodeSelected ? "bg-blue-500 border-blue-500 text-white" : "border-gray-300 hover:border-gray-400 bg-transparent"}`}>
      {isNodeSelected && <Check className="w-3 h-3" />}
    </span>
  ) : (
    // Show drag grip icon
    <GripVertical className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
  )}
</button>
```

**Key insight:** The `@dnd-kit` `PointerSensor` has a `distance: 5` activation constraint (in `DndSidebarTree.tsx`). This means a click (no movement) will not trigger a drag. So both click (for checkbox toggle) and drag (for reordering) can coexist on the same button:
- **Click** (no mouse movement) → toggles checkbox selection
- **Drag** (5+ pixels of movement) → initiates drag-and-drop

### Alternative: Separate drag handle area

If combining click and drag on one button causes UX issues, an alternative is to always render the drag handle as a separate thin strip on the far left, and the checkbox next to it:

```
[drag grip] [checkbox] [icon] Page title
```

This keeps both elements always rendered and functional.

## Acceptance Criteria

- [ ] Pages can be dragged to reorder within the same level (even when multi-select is active)
- [ ] Pages can be dragged into other pages to create subpages
- [ ] Pages can be dragged out of a parent to the root level
- [ ] Multi-select (Cmd/Ctrl+Click) still works to select/deselect pages
- [ ] Shift+Click range selection still works
- [ ] Selected pages show checkboxes with blue highlight
- [ ] The drag grip icon shows on hover when no pages are selected
- [ ] Checkbox shows on hover when pages are selected
- [ ] No visual flickering when hovering over tree nodes

## Files to Modify

| File | Change |
|------|--------|
| `src/components/workspace/SortableSidebarTreeNode.tsx` | Merge checkbox and drag handle into a single always-rendered button with `{...listeners}` |
| `src/components/workspace/DndSidebarTree.tsx` | No change expected (PointerSensor config is fine) |

## Testing

1. **Before fix (reproduce bug):**
   - Cmd+Click any page in the sidebar to select it
   - Try to drag any page → drag does not work
   - Clear selection by clicking a page normally
   - Hover over a page and try to drag → still broken (hover triggers checkbox branch)

2. **After fix:**
   - Drag a page up/down to reorder within its level
   - Drag a page onto another page to make it a subpage
   - Drag a subpage out to the root level
   - Cmd+Click to select 2-3 pages (checkboxes should appear)
   - While pages are selected, try to drag a page → should still work
   - Click a checkbox → should toggle selection without triggering drag
   - Shift+Click to range-select → should work
   - Click a page normally → should navigate and clear selection
