"use client";

import { useState, useCallback, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { SortableSidebarTreeNode } from "@/components/workspace/SortableSidebarTreeNode";
import { useSidebarExpandState } from "@/hooks/useSidebarExpandState";
import { useReorderPage } from "@/hooks/useReorderPage";
import type { PageTreeNode } from "@/types/page";

interface DndSidebarTreeProps {
  tree: PageTreeNode[];
}

interface DropPosition {
  type: "before" | "after" | "child";
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

export function DndSidebarTree({ tree }: DndSidebarTreeProps) {
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

      // Determine drop position based on pointer Y relative to the over element
      const overRect = over.rect;
      const pointerY = (event.activatorEvent as PointerEvent)?.clientY ?? 0;
      const deltaY = event.delta?.y ?? 0;
      const currentY = pointerY + deltaY;

      if (overRect) {
        const top = overRect.top;
        const height = overRect.height;
        const relativeY = currentY - top;

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
            setDropPosition({ type: "child" });
          }
        } else {
          // For leaf nodes: standard zones
          if (relativeY < height * 0.25) {
            setDropPosition({ type: "before" });
          } else if (relativeY > height * 0.75) {
            setDropPosition({ type: "after" });
          } else {
            setDropPosition({ type: "child" });
          }
        }
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
      collisionDetection={closestCenter}
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
            />
          ))}
        </div>
      </SortableContext>

      {/* Drag overlay — ghost element following cursor */}
      <DragOverlay dropAnimation={null}>
        {activeNode && (
          <div className="flex items-center h-8 px-3 bg-white border border-blue-200 rounded-md shadow-lg opacity-90">
            <span className="text-sm mr-2">
              {activeNode.icon || "📄"}
            </span>
            <span className="text-sm text-gray-700 truncate max-w-[180px]">
              {activeNode.title}
            </span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
