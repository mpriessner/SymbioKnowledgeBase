# EPIC-38: Sidebar Drag-and-Drop Regression Fix

**Status:** Done

## Overview

After the multi-select feature was added to the sidebar page tree, drag-and-drop page reordering and reparenting (moving pages into other pages as subpages) stopped working. This is a regression that needs to be fixed while preserving multi-select functionality.

## Problem

The multi-select implementation introduced a conditional rendering pattern in `SortableSidebarTreeNode.tsx` where the drag handle button (which carries the `@dnd-kit` `listeners` and `attributes`) is replaced by a checkbox button when any page is selected or when hovering. Since the checkbox button does not carry the drag listeners, drag events are never detected and drag-and-drop becomes completely non-functional.

### Bug Chain

1. User selects any page via multi-select (Cmd+Click) -> `showCheckboxes` becomes `true`
2. `showCheckboxes || isHovered` evaluates to `true` -> renders checkbox (without `{...listeners}`)
3. Drag handle button never renders -> `{...listeners}` never attached to DOM
4. User tries to drag any page -> PointerSensor cannot detect drag events
5. Drag-and-drop completely broken

## Stories

| ID | Title | Points |
|----|-------|--------|
| SKB-38.1 | Fix sidebar drag-and-drop broken by multi-select | 3 |

## Total Points: 3

## Key Files

| File | Purpose |
|------|---------|
| `src/components/workspace/SortableSidebarTreeNode.tsx` | Main bug: conditional rendering removes drag listeners |
| `src/components/workspace/DndSidebarTree.tsx` | DnD context provider with PointerSensor |
| `src/hooks/useMultiSelect.ts` | Multi-select state management |
| `src/components/workspace/Sidebar.tsx` | Passes multiSelect props down the tree |
