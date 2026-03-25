"use client";

import { useState, useCallback, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  type CollisionDetection,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { SortableSidebarTreeNode } from "@/components/workspace/SortableSidebarTreeNode";
import { useSidebarExpandState } from "@/hooks/useSidebarExpandState";
import { useReorderPage } from "@/hooks/useReorderPage";
import type { PageTreeNode } from "@/types/page";
import type { MultiSelectProps } from "@/components/workspace/Sidebar";

interface DndSidebarTreeProps {
  tree: PageTreeNode[];
  multiSelect?: MultiSelectProps;
}

export interface DropPosition {
  type: "before" | "after" | "child";
  /** The depth level where the item will land (for indicator line positioning) */
  targetDepth: number;
  /** True when cursor is dragged right to nest as child */
  isNesting: boolean;
  /** True when cursor is dragged left to promote to parent level */
  isPromoting: boolean;
}

/**
 * Flattens the tree into a list of IDs (in render order) for SortableContext.
 * Always includes all node IDs so collapsed parents remain valid drop targets.
 */
function flattenTreeIds(
  nodes: PageTreeNode[],
  isExpanded: (id: string) => boolean
): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    ids.push(node.id);
    if (node.children.length > 0) {
      if (isExpanded(node.id)) {
        ids.push(...flattenTreeIds(node.children, isExpanded));
      } else {
        // Include collapsed children IDs so they remain valid sortable items
        // This allows dragging items back into collapsed parents
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

/**
 * Finds a node and its parent in the tree.
 */
function findNodeWithParent(
  nodes: PageTreeNode[],
  nodeId: string,
  parent: PageTreeNode | null = null
): { node: PageTreeNode; parent: PageTreeNode | null } | null {
  for (const node of nodes) {
    if (node.id === nodeId) return { node, parent };
    if (node.children.length > 0) {
      const found = findNodeWithParent(node.children, nodeId, node);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Checks if potentialDescendantId is a descendant of ancestorId in the tree.
 */
function isDescendantInTree(
  nodes: PageTreeNode[],
  ancestorId: string,
  potentialDescendantId: string
): boolean {
  function findAndCheck(currentNodes: PageTreeNode[]): boolean {
    for (const node of currentNodes) {
      if (node.id === ancestorId) {
        return containsNode(node.children, potentialDescendantId);
      }
      if (findAndCheck(node.children)) return true;
    }
    return false;
  }

  function containsNode(currentNodes: PageTreeNode[], targetId: string): boolean {
    for (const node of currentNodes) {
      if (node.id === targetId) return true;
      if (containsNode(node.children, targetId)) return true;
    }
    return false;
  }

  return findAndCheck(nodes);
}

/**
 * Custom collision detection: prefer pointerWithin (pointer is inside an item),
 * fall back to closestCenter (pointer is between items). This ensures that at
 * any nesting depth the correct row is identified as the drop target.
 */
const hybridCollision: CollisionDetection = (args) => {
  const withinCollisions = pointerWithin(args);
  if (withinCollisions.length > 0) {
    return withinCollisions;
  }
  return closestCenter(args);
};

export function DndSidebarTree({ tree, multiSelect }: DndSidebarTreeProps) {
  const expandState = useSidebarExpandState();
  const reorderPage = useReorderPage();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<DropPosition | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px minimum drag distance to prevent accidental drags
      },
    })
  );

  const flatIds = useMemo(
    () => flattenTreeIds(tree, expandState.isExpanded),
    [tree, expandState.isExpanded]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { over, active } = event;
      if (!over || over.id === active.id) {
        setOverId(null);
        setDropPosition(null);
        return;
      }

      const overIdStr = String(over.id);
      setOverId(overIdStr);

      // Prevent dropping on descendants
      if (isDescendantInTree(tree, String(active.id), overIdStr)) {
        setDropPosition(null);
        return;
      }

      const overRect = over.rect;
      const pointerX = (event.activatorEvent as PointerEvent)?.clientX ?? 0;
      const pointerY = (event.activatorEvent as PointerEvent)?.clientY ?? 0;
      const deltaX = event.delta?.x ?? 0;
      const deltaY = event.delta?.y ?? 0;
      const currentX = pointerX + deltaX;
      const currentY = pointerY + deltaY;

      if (overRect) {
        const top = overRect.top;
        const height = overRect.height;
        const relativeY = currentY - top;

        // Get the target's depth from dnd-kit sortable data
        const overDepth = (over.data?.current as { depth?: number })?.depth ?? 0;

        // Calculate the target's content start position.
        // Each depth level adds 16px indent, plus 12px base padding.
        const sidebarLeft = overRect.left;
        const targetContentLeft = sidebarLeft + 12 + overDepth * 16;

        // Check if target already has children
        const targetNode = findNodeWithParent(tree, overIdStr);
        const isParentNode = targetNode?.node && targetNode.node.children.length > 0;

        // Dead zone: if mostly vertical movement, ignore horizontal position
        // to prevent accidental nesting during fast vertical drags
        const verticalDelta = Math.abs(deltaY);
        const horizontalDelta = Math.abs(deltaX);
        const isVerticalDrag = verticalDelta > horizontalDelta * 1.5;

        // Nest detection: cursor >30px right of target's content edge
        const nestThreshold = 30;
        const wantsNest = !isVerticalDrag && currentX > targetContentLeft + nestThreshold;

        // Promote detection: cursor left of target's content start (drag left to un-nest)
        const promoteThreshold = 16; // One indent level
        const wantsPromote = !isVerticalDrag && overDepth > 0 && currentX < targetContentLeft - promoteThreshold;

        // Calculate how many levels to promote based on horizontal distance
        let promoteDepth = overDepth;
        if (wantsPromote) {
          const pixelsLeft = targetContentLeft - currentX;
          const levelsBack = Math.min(
            Math.floor(pixelsLeft / 16),
            overDepth // Can't go above root
          );
          promoteDepth = Math.max(0, overDepth - levelsBack);
        }

        // Determine drop type and target depth
        let dropType: "before" | "after" | "child";
        let targetDepth: number;

        if (isParentNode) {
          // For parent nodes: wider middle zone + horizontal nesting
          if (relativeY < height * 0.2 && !wantsNest) {
            dropType = "before";
            targetDepth = wantsPromote ? promoteDepth : overDepth;
          } else if (relativeY > height * 0.8 && !wantsNest) {
            dropType = "after";
            targetDepth = wantsPromote ? promoteDepth : overDepth;
          } else {
            dropType = "child";
            targetDepth = overDepth + 1;
          }
        } else {
          // For leaf nodes: horizontal offset is the primary nesting signal
          if (wantsNest) {
            dropType = "child";
            targetDepth = overDepth + 1;
          } else if (relativeY < height * 0.5) {
            dropType = "before";
            targetDepth = wantsPromote ? promoteDepth : overDepth;
          } else {
            dropType = "after";
            targetDepth = wantsPromote ? promoteDepth : overDepth;
          }
        }

        setDropPosition({
          type: dropType,
          targetDepth,
          isNesting: wantsNest || dropType === "child",
          isPromoting: wantsPromote,
        });
      }
    },
    [tree]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      setOverId(null);
      setDropPosition(null);

      if (!over || active.id === over.id || !dropPosition) return;

      const draggedId = String(active.id);
      const targetId = String(over.id);

      // Prevent circular drops
      if (isDescendantInTree(tree, draggedId, targetId)) return;

      const targetInfo = findNodeWithParent(tree, targetId);
      if (!targetInfo) return;

      let newParentId: string | null;
      let newPosition: number;

      if (dropPosition.type === "child") {
        // Drop as child of target
        newParentId = targetId;
        newPosition = targetInfo.node.children.length; // Append at end
        // Auto-expand the target so the moved node is visible
        expandState.expand(targetId);
      } else if (dropPosition.isPromoting && dropPosition.targetDepth < ((active.data?.current as { depth?: number })?.depth ?? 0)) {
        // Promote: move to an ancestor level based on how far left user dragged
        // Walk up the tree from the target to find the ancestor at the target depth
        let ancestor: { node: PageTreeNode; parent: PageTreeNode | null } | null = targetInfo;
        let currentDepth = (active.data?.current as { depth?: number })?.depth ?? 0;

        // Walk up to find the right parent for the target depth
        while (ancestor && currentDepth > dropPosition.targetDepth) {
          if (ancestor.parent) {
            ancestor = findNodeWithParent(tree, ancestor.parent.id);
          } else {
            ancestor = null;
          }
          currentDepth--;
        }

        if (ancestor) {
          newParentId = ancestor.parent?.id ?? null;
          newPosition = ancestor.node.position + (dropPosition.type === "after" ? 1 : 0);
        } else {
          // Promoted to root level
          newParentId = null;
          newPosition = targetInfo.node.position + (dropPosition.type === "after" ? 1 : 0);
        }
      } else if (dropPosition.type === "before") {
        // Drop before target (same parent, target's position)
        newParentId = targetInfo.parent?.id ?? null;
        newPosition = targetInfo.node.position;
      } else {
        // Drop after target (same parent, target's position + 1)
        newParentId = targetInfo.parent?.id ?? null;
        newPosition = targetInfo.node.position + 1;
      }

      reorderPage.mutate({
        pageId: draggedId,
        parentId: newParentId,
        position: newPosition,
      });
    },
    [tree, dropPosition, reorderPage, expandState]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setOverId(null);
    setDropPosition(null);
  }, []);

  if (!expandState.isHydrated) {
    return null;
  }

  if (tree.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-sm text-gray-400 mb-2">No pages yet</p>
        <p className="text-xs text-gray-300">
          Click &quot;New Page&quot; above to get started
        </p>
      </div>
    );
  }

  // Find the active node for the drag overlay
  const activeNode = activeId
    ? findNodeWithParent(tree, activeId)?.node ?? null
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={hybridCollision}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={flatIds} strategy={verticalListSortingStrategy}>
        <div className="py-1" role="tree" aria-label="Page tree">
          {tree.map((node) => (
            <SortableSidebarTreeNode
              key={node.id}
              node={node}
              depth={0}
              isExpanded={expandState.isExpanded(node.id)}
              onToggle={expandState.toggle}
              expandState={expandState}
              activeId={activeId}
              overId={overId}
              dropPosition={dropPosition}
              multiSelect={multiSelect}
            />
          ))}
        </div>
      </SortableContext>

      {/* Drag overlay — ghost element following cursor */}
      <DragOverlay dropAnimation={null}>
        {activeNode && (
          <div className="flex items-center h-8 px-3 bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 rounded-md shadow-lg opacity-90">
            {dropPosition?.isNesting && (
              <svg className="w-3 h-3 text-blue-500 mr-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            )}
            {dropPosition?.isPromoting && (
              <svg className="w-3 h-3 text-orange-500 mr-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
              </svg>
            )}
            <span className="text-sm mr-2">
              {activeNode.icon || "📄"}
            </span>
            <span className="text-sm text-gray-700 dark:text-gray-200 truncate max-w-[180px]">
              {activeNode.title}
            </span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
