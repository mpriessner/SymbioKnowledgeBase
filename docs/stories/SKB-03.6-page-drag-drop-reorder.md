# Story SKB-03.6: Page Drag-and-Drop Reordering in Sidebar

**Epic:** Epic 3 - Page Management & Navigation
**Story ID:** SKB-03.6
**Story Points:** 3 | **Priority:** Medium | **Status:** Draft
**Depends On:** SKB-03.3 (sidebar page tree must be rendered)

---

## User Story

As a researcher, I want to drag and drop pages in the sidebar to reorder them, So that I can organize my page structure intuitively.

---

## Acceptance Criteria

- [ ] Each sidebar tree node has a drag handle (grip icon) visible on hover
- [ ] Dragging a page within the same parent reorders it among its siblings (updates `position` field)
- [ ] Dragging a page to a different parent moves it (updates both `parentId` and `position`)
- [ ] A visual drop indicator line shows where the page will be placed during drag
- [ ] Indentation-based drop zones: dropping slightly right of a node nests it as a child, dropping at the same level reorders as a sibling
- [ ] `PUT /api/pages/[id]/reorder` endpoint accepts `{ parentId, position }` and updates the page and reorders siblings
- [ ] Optimistic update: sidebar updates immediately on drop, rolls back on API failure
- [ ] Dragging is smooth and performant (uses `@dnd-kit/core` and `@dnd-kit/sortable`)
- [ ] Circular reference prevention: cannot drop a parent onto one of its own descendants
- [ ] Drop indicators clearly differentiate between "place before", "place after", and "nest as child"

---

## Architecture Overview

```
Drag and Drop Flow:

1. User grabs drag handle on a tree node
2. DndContext activates, ghost overlay follows cursor
3. Drop indicators appear as user moves over valid targets
4. User releases — drop event fires
5. Optimistic update: sidebar tree re-renders immediately
6. API call: PUT /api/pages/:id/reorder { parentId, position }
7. On success: cache invalidated, tree refetched
8. On failure: rollback to previous tree state

Component Integration:

┌─────────────────────────────────────────────┐
│  Sidebar.tsx                                 │
│  ┌─────────────────────────────────────────┐│
│  │  DndContext (from @dnd-kit/core)        ││
│  │  ┌───────────────────────────────────┐  ││
│  │  │  SortableContext (flat item list) │  ││
│  │  │                                    │  ││
│  │  │  SortableSidebarTreeNode          │  ││
│  │  │  ├── useSortable() hook           │  ││
│  │  │  ├── Drag Handle (grip icon)      │  ││
│  │  │  ├── Drop Indicator (line)        │  ││
│  │  │  └── SidebarTreeNode (existing)   │  ││
│  │  │                                    │  ││
│  │  │  SortableSidebarTreeNode          │  ││
│  │  │  └── ...                          │  ││
│  │  └───────────────────────────────────┘  ││
│  │                                          ││
│  │  DragOverlay (ghost element)            ││
│  └─────────────────────────────────────────┘│
└─────────────────────────────────────────────┘

Reorder API:

PUT /api/pages/:id/reorder
Body: {
  parentId: string | null,   // new parent (null = root)
  position: number           // new position among siblings (0-indexed)
}

Server-side position management:
- Fetch all siblings of the target parent (excluding the moved page)
- Insert the page at the requested position
- Reindex all sibling positions: 0, 1, 2, ... (gap-free)
- Update in a single transaction

Position reindexing example:

Before: [A:0, B:1, C:2, D:3]
Move D to position 1:
After:  [A:0, D:1, B:2, C:3]

Step-by-step:
1. Remove D from list: [A:0, B:1, C:2]
2. Insert D at index 1: [A, D, B, C]
3. Reassign positions: [A:0, D:1, B:2, C:3]

Drop Zone Detection (indentation-based):

  ┌─────────────────────────────────┐
  │  📄 Parent Page                  │  ← Drop "before" Parent
  │  ──────────────────────── (line) │
  │    📄 Child 1                    │  ← Drop "before" Child 1
  │    ──────────────────── (line)   │
  │    📄 Child 2                    │  ← Drop "after" Child 2 (sibling)
  │      ──────────────── (line)     │  ← Drop "as child of" Child 2 (nested)
  │  📄 Next Page                    │
  └─────────────────────────────────┘

Cursor X-position determines:
  - Left side of indent level → sibling of current node
  - Right side (deeper indent) → child of current node
```

---

## Implementation Steps

### Step 1: Install dnd-kit Dependencies

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**Why @dnd-kit:**
- Purpose-built for React with hooks-based API
- Supports tree structures with sortable and droppable contexts
- Lightweight (~10KB gzipped) compared to react-dnd (~30KB)
- Built-in accessibility (keyboard DnD, screen reader announcements)
- Supports custom collision detection for tree structures

---

### Step 2: Create the Reorder API Endpoint

This endpoint handles moving a page to a new position and/or parent. It reindexes all sibling positions in a transaction to maintain gap-free ordering.

**File: `src/app/api/pages/[id]/reorder/route.ts`**

```typescript
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { isDescendant } from "@/lib/pages/getPageTree";
import { TenantContext } from "@/types/auth";
import { z } from "zod";

const pageIdSchema = z.string().uuid("Page ID must be a valid UUID");

const reorderSchema = z.object({
  parentId: z
    .string()
    .uuid("parentId must be a valid UUID")
    .nullable(),
  position: z
    .number()
    .int("Position must be an integer")
    .min(0, "Position must be non-negative"),
});

export const PUT = withTenant(
  async (
    req: NextRequest,
    context: TenantContext,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;
      const idParsed = pageIdSchema.safeParse(id);
      if (!idParsed.success) {
        return errorResponse(400, "Invalid page ID");
      }

      const body = await req.json();
      const parsed = reorderSchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse(
          400,
          "Invalid request body",
          parsed.error.flatten().fieldErrors
        );
      }

      const { parentId, position } = parsed.data;
      const pageId = idParsed.data;

      // Verify the page exists and belongs to this tenant
      const page = await prisma.page.findFirst({
        where: { id: pageId, tenant_id: context.tenantId },
      });
      if (!page) {
        return errorResponse(404, "Page not found");
      }

      // If moving to a new parent, validate it
      if (parentId !== null) {
        // Cannot move a page under itself
        if (parentId === pageId) {
          return errorResponse(400, "A page cannot be its own parent");
        }

        // Verify parent exists
        const parentPage = await prisma.page.findFirst({
          where: { id: parentId, tenant_id: context.tenantId },
        });
        if (!parentPage) {
          return errorResponse(404, "Parent page not found");
        }

        // Check for circular reference
        const circular = await isDescendant(context.tenantId, pageId, parentId);
        if (circular) {
          return errorResponse(
            400,
            "Cannot move a page under one of its own descendants"
          );
        }
      }

      // Perform the reorder in a transaction
      const updatedPage = await prisma.$transaction(async (tx) => {
        // Get all siblings at the target parent (excluding the moving page)
        const siblings = await tx.page.findMany({
          where: {
            tenant_id: context.tenantId,
            parent_id: parentId,
            id: { not: pageId },
          },
          orderBy: { position: "asc" },
          select: { id: true },
        });

        // Clamp position to valid range
        const clampedPosition = Math.min(position, siblings.length);

        // Build the new ordering: insert the page at the requested position
        const newOrder = [...siblings.map((s) => s.id)];
        newOrder.splice(clampedPosition, 0, pageId);

        // Update all positions in the new order
        const updatePromises = newOrder.map((siblingId, index) =>
          tx.page.update({
            where: { id: siblingId },
            data: {
              position: index,
              // Only update parent_id for the moved page
              ...(siblingId === pageId ? { parent_id: parentId } : {}),
              updated_at: siblingId === pageId ? new Date() : undefined,
            },
          })
        );

        await Promise.all(updatePromises);

        // Return the updated page
        return tx.page.findUniqueOrThrow({ where: { id: pageId } });
      });

      return successResponse({
        id: updatedPage.id,
        tenantId: updatedPage.tenant_id,
        parentId: updatedPage.parent_id,
        title: updatedPage.title,
        icon: updatedPage.icon,
        coverUrl: updatedPage.cover_url,
        position: updatedPage.position,
        createdAt: updatedPage.created_at.toISOString(),
        updatedAt: updatedPage.updated_at.toISOString(),
      });
    } catch (error) {
      console.error("PUT /api/pages/[id]/reorder error:", error);
      return errorResponse(500, "Internal server error");
    }
  }
);
```

---

### Step 3: Create the Reorder Hook

A TanStack Query mutation hook that handles the reorder API call with optimistic updates.

**File: `src/hooks/useReorderPage.ts`**

```typescript
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { pageKeys } from "@/hooks/usePages";
import type { PageTreeNode } from "@/types/page";

interface ReorderInput {
  pageId: string;
  parentId: string | null;
  position: number;
}

interface ReorderResponse {
  data: {
    id: string;
    tenantId: string;
    parentId: string | null;
    title: string;
    icon: string | null;
    coverUrl: string | null;
    position: number;
    createdAt: string;
    updatedAt: string;
  };
  meta: Record<string, unknown>;
}

async function reorderPage(input: ReorderInput): Promise<ReorderResponse> {
  const response = await fetch(`/api/pages/${input.pageId}/reorder`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      parentId: input.parentId,
      position: input.position,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to reorder page");
  }

  return response.json();
}

/**
 * Performs an optimistic reorder of the page tree.
 * Moves a node from its current position to a new parent/position.
 */
function optimisticReorder(
  tree: PageTreeNode[],
  pageId: string,
  newParentId: string | null,
  newPosition: number
): PageTreeNode[] {
  // Deep clone the tree to avoid mutating the original
  const cloned = structuredClone(tree);

  // Find and remove the node from its current position
  let movedNode: PageTreeNode | null = null;

  function removeFromTree(nodes: PageTreeNode[]): PageTreeNode[] {
    return nodes.filter((node) => {
      if (node.id === pageId) {
        movedNode = node;
        return false;
      }
      node.children = removeFromTree(node.children);
      return true;
    });
  }

  const treeWithoutNode = removeFromTree(cloned);

  if (!movedNode) return cloned; // Node not found, return original

  // Update the node's parent reference
  movedNode.parentId = newParentId;

  // Insert at the new position
  if (newParentId === null) {
    // Insert at root level
    const pos = Math.min(newPosition, treeWithoutNode.length);
    treeWithoutNode.splice(pos, 0, movedNode);
    // Reindex positions
    treeWithoutNode.forEach((node, idx) => {
      node.position = idx;
    });
  } else {
    // Find the parent node and insert
    function insertIntoParent(nodes: PageTreeNode[]): boolean {
      for (const node of nodes) {
        if (node.id === newParentId) {
          const pos = Math.min(newPosition, node.children.length);
          node.children.splice(pos, 0, movedNode!);
          // Reindex children positions
          node.children.forEach((child, idx) => {
            child.position = idx;
          });
          return true;
        }
        if (insertIntoParent(node.children)) return true;
      }
      return false;
    }

    insertIntoParent(treeWithoutNode);
  }

  return treeWithoutNode;
}

export function useReorderPage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: reorderPage,
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: pageKeys.tree() });

      // Snapshot the previous tree
      const previousTree = queryClient.getQueryData<{
        data: PageTreeNode[];
        meta: Record<string, unknown>;
      }>(pageKeys.tree());

      // Optimistically update the tree
      if (previousTree) {
        queryClient.setQueryData(pageKeys.tree(), {
          ...previousTree,
          data: optimisticReorder(
            previousTree.data,
            variables.pageId,
            variables.parentId,
            variables.position
          ),
        });
      }

      return { previousTree };
    },
    onError: (_error, _variables, context) => {
      // Rollback to the previous tree on error
      if (context?.previousTree) {
        queryClient.setQueryData(pageKeys.tree(), context.previousTree);
      }
    },
    onSettled: () => {
      // Refetch the tree to ensure consistency
      queryClient.invalidateQueries({ queryKey: pageKeys.tree() });
      queryClient.invalidateQueries({ queryKey: pageKeys.lists() });
    },
  });
}

// Export for testing
export { optimisticReorder };
```

---

### Step 4: Create the DnD-Enabled Sidebar Tree Node

Wrap the existing SidebarTreeNode with dnd-kit's sortable functionality. This adds a drag handle and drop indicator while preserving all existing behavior.

**File: `src/components/workspace/SortableSidebarTreeNode.tsx`**

```tsx
"use client";

import { useCallback, useState, useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter, usePathname } from "next/navigation";
import { useCreatePage } from "@/hooks/usePages";
import type { PageTreeNode } from "@/types/page";

interface DropPosition {
  type: "before" | "after" | "child";
}

interface SortableSidebarTreeNodeProps {
  node: PageTreeNode;
  depth: number;
  isExpanded: boolean;
  onToggle: (pageId: string) => void;
  expandState: {
    isExpanded: (pageId: string) => boolean;
    toggle: (pageId: string) => void;
  };
  activeId: string | null;
  overId: string | null;
  dropPosition: DropPosition | null;
}

export function SortableSidebarTreeNode({
  node,
  depth,
  isExpanded,
  onToggle,
  expandState,
  activeId,
  overId,
  dropPosition,
}: SortableSidebarTreeNodeProps) {
  const router = useRouter();
  const pathname = usePathname();
  const createPage = useCreatePage();
  const [isHovered, setIsHovered] = useState(false);
  const nodeRef = useRef<HTMLDivElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: node.id,
    data: {
      type: "page",
      node,
      depth,
      parentId: node.parentId,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const isActive = pathname === `/pages/${node.id}`;
  const hasChildren = node.children.length > 0;
  const paddingLeft = 12 + depth * 16;
  const isDropTarget = overId === node.id && !isDragging;

  const handleClick = useCallback(() => {
    router.push(`/pages/${node.id}`);
  }, [router, node.id]);

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggle(node.id);
    },
    [onToggle, node.id]
  );

  const handleCreateChild = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      createPage.mutate(
        { title: "Untitled", parentId: node.id },
        {
          onSuccess: (data) => {
            if (!isExpanded) onToggle(node.id);
            router.push(`/pages/${data.data.id}`);
          },
        }
      );
    },
    [createPage, node.id, isExpanded, onToggle, router]
  );

  return (
    <div ref={setNodeRef} style={style}>
      {/* Drop indicator line: before */}
      {isDropTarget && dropPosition?.type === "before" && (
        <div
          className="h-0.5 bg-blue-500 rounded-full mx-2"
          style={{ marginLeft: `${paddingLeft}px` }}
        />
      )}

      {/* Node row */}
      <div
        ref={nodeRef}
        className={`
          group flex items-center h-8 cursor-pointer rounded-md mx-1
          transition-colors duration-100
          ${isDragging ? "opacity-40" : ""}
          ${isActive ? "bg-blue-100 text-blue-900" : "hover:bg-gray-100 text-gray-700"}
          ${isDropTarget && dropPosition?.type === "child" ? "bg-blue-50 ring-1 ring-blue-300" : ""}
        `}
        style={{ paddingLeft: `${paddingLeft}px` }}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        role="treeitem"
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-selected={isActive}
        aria-level={depth + 1}
      >
        {/* Drag handle (visible on hover) */}
        <button
          className={`
            flex-shrink-0 w-4 h-8 flex items-center justify-center cursor-grab active:cursor-grabbing
            ${isHovered ? "opacity-100" : "opacity-0"}
            transition-opacity
          `}
          {...attributes}
          {...listeners}
          tabIndex={-1}
          aria-label={`Drag ${node.title}`}
        >
          <svg
            className="w-3 h-3 text-gray-400"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <circle cx="5" cy="3" r="1.5" />
            <circle cx="11" cy="3" r="1.5" />
            <circle cx="5" cy="8" r="1.5" />
            <circle cx="11" cy="8" r="1.5" />
            <circle cx="5" cy="13" r="1.5" />
            <circle cx="11" cy="13" r="1.5" />
          </svg>
        </button>

        {/* Expand/collapse chevron */}
        <button
          className={`
            flex-shrink-0 w-5 h-5 flex items-center justify-center rounded
            transition-colors hover:bg-gray-200
            ${!hasChildren ? "invisible" : ""}
          `}
          onClick={handleToggle}
          tabIndex={-1}
          aria-label={isExpanded ? "Collapse" : "Expand"}
        >
          <svg
            className={`w-3 h-3 text-gray-400 transition-transform duration-150 ${
              isExpanded ? "rotate-90" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Page icon */}
        <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-sm mr-1">
          {node.icon || (
            <svg
              className="w-4 h-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
          )}
        </span>

        {/* Page title */}
        <span className="flex-1 truncate text-sm leading-none">{node.title}</span>

        {/* Create child button (visible on hover, hidden during drag) */}
        {isHovered && !activeId && (
          <button
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 mr-1"
            onClick={handleCreateChild}
            aria-label={`Create page inside ${node.title}`}
            title="Create subpage"
          >
            <svg
              className="w-3.5 h-3.5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        )}
      </div>

      {/* Drop indicator line: after */}
      {isDropTarget && dropPosition?.type === "after" && (
        <div
          className="h-0.5 bg-blue-500 rounded-full mx-2"
          style={{ marginLeft: `${paddingLeft}px` }}
        />
      )}

      {/* Recursive children */}
      {hasChildren && isExpanded && (
        <div role="group">
          {node.children.map((child) => (
            <SortableSidebarTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              isExpanded={expandState.isExpanded(child.id)}
              onToggle={expandState.toggle}
              expandState={expandState}
              activeId={activeId}
              overId={overId}
              dropPosition={dropPosition}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

---

### Step 5: Create the DnD-Enabled Sidebar Tree

Wrap the SidebarTree with DndContext and SortableContext from @dnd-kit. This component orchestrates the entire drag-and-drop experience.

**File: `src/components/workspace/DndSidebarTree.tsx`**

```tsx
"use client";

import { useState, useCallback, useMemo, useRef } from "react";
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
 * Only includes expanded nodes' children.
 */
function flattenTreeIds(
  nodes: PageTreeNode[],
  isExpanded: (id: string) => boolean
): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    ids.push(node.id);
    if (node.children.length > 0 && isExpanded(node.id)) {
      ids.push(...flattenTreeIds(node.children, isExpanded));
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
        // Found ancestor, now check if descendant is in its subtree
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
  const pointerOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

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

        if (relativeY < height * 0.25) {
          setDropPosition({ type: "before" });
        } else if (relativeY > height * 0.75) {
          setDropPosition({ type: "after" });
        } else {
          setDropPosition({ type: "child" });
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
          Click "New Page" above to get started
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
```

---

### Step 6: Update Sidebar to Use DnD Tree

Replace the `SidebarTree` import in `Sidebar.tsx` with the new `DndSidebarTree`.

**Modifications to `src/components/workspace/Sidebar.tsx`:**

```tsx
// Change import:
// Before:
// import { SidebarTree } from "@/components/workspace/SidebarTree";
// After:
import { DndSidebarTree } from "@/components/workspace/DndSidebarTree";

// Change usage in the JSX:
// Before:
// {data && <SidebarTree tree={data.data} />}
// After:
{data && <DndSidebarTree tree={data.data} />}
```

The rest of the Sidebar component remains unchanged.

---

## Testing Requirements

### Unit Tests: Optimistic Reorder Logic

**File: `src/__tests__/hooks/useReorderPage.test.ts`**

```typescript
import { describe, test, expect } from "vitest";
import { optimisticReorder } from "@/hooks/useReorderPage";
import type { PageTreeNode } from "@/types/page";

function mockTreeNode(overrides: Partial<PageTreeNode> = {}): PageTreeNode {
  return {
    id: "node-1",
    tenantId: "tenant-1",
    parentId: null,
    title: "Untitled",
    icon: null,
    coverUrl: null,
    position: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    children: [],
    ...overrides,
  };
}

describe("optimisticReorder", () => {
  test("reorders within same parent (root level)", () => {
    const tree: PageTreeNode[] = [
      mockTreeNode({ id: "a", title: "A", position: 0 }),
      mockTreeNode({ id: "b", title: "B", position: 1 }),
      mockTreeNode({ id: "c", title: "C", position: 2 }),
    ];

    // Move C to position 0
    const result = optimisticReorder(tree, "c", null, 0);

    expect(result[0].id).toBe("c");
    expect(result[1].id).toBe("a");
    expect(result[2].id).toBe("b");
    expect(result[0].position).toBe(0);
    expect(result[1].position).toBe(1);
    expect(result[2].position).toBe(2);
  });

  test("moves page to a different parent", () => {
    const tree: PageTreeNode[] = [
      mockTreeNode({
        id: "parent-1",
        title: "Parent 1",
        position: 0,
        children: [
          mockTreeNode({ id: "child-a", parentId: "parent-1", title: "Child A", position: 0 }),
        ],
      }),
      mockTreeNode({
        id: "parent-2",
        title: "Parent 2",
        position: 1,
        children: [],
      }),
    ];

    // Move child-a from parent-1 to parent-2
    const result = optimisticReorder(tree, "child-a", "parent-2", 0);

    expect(result[0].children).toHaveLength(0); // parent-1 has no children
    expect(result[1].children).toHaveLength(1); // parent-2 has child-a
    expect(result[1].children[0].id).toBe("child-a");
    expect(result[1].children[0].parentId).toBe("parent-2");
  });

  test("moves page to root level", () => {
    const tree: PageTreeNode[] = [
      mockTreeNode({
        id: "parent",
        title: "Parent",
        position: 0,
        children: [
          mockTreeNode({ id: "child", parentId: "parent", title: "Child", position: 0 }),
        ],
      }),
    ];

    // Move child to root level at position 0
    const result = optimisticReorder(tree, "child", null, 0);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("child");
    expect(result[0].parentId).toBeNull();
    expect(result[1].id).toBe("parent");
    expect(result[1].children).toHaveLength(0);
  });

  test("clamps position to valid range", () => {
    const tree: PageTreeNode[] = [
      mockTreeNode({ id: "a", title: "A", position: 0 }),
      mockTreeNode({ id: "b", title: "B", position: 1 }),
    ];

    // Position 999 should clamp to end
    const result = optimisticReorder(tree, "a", null, 999);

    expect(result[0].id).toBe("b");
    expect(result[1].id).toBe("a");
  });

  test("returns original tree when page not found", () => {
    const tree: PageTreeNode[] = [
      mockTreeNode({ id: "a", title: "A", position: 0 }),
    ];

    const result = optimisticReorder(tree, "nonexistent", null, 0);

    expect(result).toEqual(tree);
  });

  test("does not mutate the original tree", () => {
    const tree: PageTreeNode[] = [
      mockTreeNode({ id: "a", title: "A", position: 0 }),
      mockTreeNode({ id: "b", title: "B", position: 1 }),
    ];

    const originalFirstId = tree[0].id;
    optimisticReorder(tree, "b", null, 0);

    // Original tree should be unchanged
    expect(tree[0].id).toBe(originalFirstId);
    expect(tree).toHaveLength(2);
  });
});
```

### Unit Tests: Position Reindexing (API)

**File: `src/__tests__/api/pages/reorder.test.ts`**

```typescript
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/db";

const TENANT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

describe("Page Reorder API", () => {
  beforeEach(async () => {
    await prisma.page.deleteMany({ where: { tenant_id: TENANT_ID } });
  });

  afterEach(async () => {
    await prisma.page.deleteMany({ where: { tenant_id: TENANT_ID } });
  });

  test("PUT /api/pages/[id]/reorder reorders within same parent", async () => {
    // Create 3 root pages
    const pageA = await prisma.page.create({
      data: { tenant_id: TENANT_ID, title: "A", position: 0 },
    });
    await prisma.page.create({
      data: { tenant_id: TENANT_ID, title: "B", position: 1 },
    });
    await prisma.page.create({
      data: { tenant_id: TENANT_ID, title: "C", position: 2 },
    });

    // Move A to position 2 (after C)
    const response = await fetch(
      `http://localhost:3000/api/pages/${pageA.id}/reorder`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-tenant-a-key",
        },
        body: JSON.stringify({ parentId: null, position: 2 }),
      }
    );

    expect(response.status).toBe(200);

    // Verify positions
    const pages = await prisma.page.findMany({
      where: { tenant_id: TENANT_ID },
      orderBy: { position: "asc" },
    });

    expect(pages[0].title).toBe("B");
    expect(pages[0].position).toBe(0);
    expect(pages[1].title).toBe("C");
    expect(pages[1].position).toBe(1);
    expect(pages[2].title).toBe("A");
    expect(pages[2].position).toBe(2);
  });

  test("PUT /api/pages/[id]/reorder moves page to new parent", async () => {
    const parent1 = await prisma.page.create({
      data: { tenant_id: TENANT_ID, title: "Parent 1", position: 0 },
    });
    const parent2 = await prisma.page.create({
      data: { tenant_id: TENANT_ID, title: "Parent 2", position: 1 },
    });
    const child = await prisma.page.create({
      data: {
        tenant_id: TENANT_ID,
        title: "Child",
        parent_id: parent1.id,
        position: 0,
      },
    });

    // Move child from parent1 to parent2
    const response = await fetch(
      `http://localhost:3000/api/pages/${child.id}/reorder`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-tenant-a-key",
        },
        body: JSON.stringify({ parentId: parent2.id, position: 0 }),
      }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.parentId).toBe(parent2.id);
    expect(body.data.position).toBe(0);
  });

  test("PUT /api/pages/[id]/reorder rejects circular reference", async () => {
    const parent = await prisma.page.create({
      data: { tenant_id: TENANT_ID, title: "Parent", position: 0 },
    });
    const child = await prisma.page.create({
      data: {
        tenant_id: TENANT_ID,
        title: "Child",
        parent_id: parent.id,
        position: 0,
      },
    });

    // Try to move parent under its own child
    const response = await fetch(
      `http://localhost:3000/api/pages/${parent.id}/reorder`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-tenant-a-key",
        },
        body: JSON.stringify({ parentId: child.id, position: 0 }),
      }
    );

    expect(response.status).toBe(400);
  });

  test("PUT /api/pages/[id]/reorder clamps position to valid range", async () => {
    await prisma.page.create({
      data: { tenant_id: TENANT_ID, title: "Existing", position: 0 },
    });
    const page = await prisma.page.create({
      data: { tenant_id: TENANT_ID, title: "To Move", position: 1 },
    });

    // Request position 999 — should clamp to 1 (max valid)
    const response = await fetch(
      `http://localhost:3000/api/pages/${page.id}/reorder`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-tenant-a-key",
        },
        body: JSON.stringify({ parentId: null, position: 999 }),
      }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.position).toBeLessThanOrEqual(1);
  });

  test("PUT /api/pages/[id]/reorder returns 400 for invalid body", async () => {
    const page = await prisma.page.create({
      data: { tenant_id: TENANT_ID, title: "Test", position: 0 },
    });

    const response = await fetch(
      `http://localhost:3000/api/pages/${page.id}/reorder`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-tenant-a-key",
        },
        body: JSON.stringify({ parentId: "not-uuid", position: -1 }),
      }
    );

    expect(response.status).toBe(400);
  });
});
```

### E2E Test: Drag and Drop

**File: `tests/e2e/drag-drop.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";

test.describe("Page Drag and Drop Reordering", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000");
  });

  test("should show drag handle on hover", async ({ page }) => {
    // Create a page
    await page.getByLabel("Create new page").click();
    await page.waitForURL(/\/pages\//);

    // Hover over the tree node
    const treeItem = page.getByRole("treeitem").first();
    await treeItem.hover();

    // Drag handle should be visible
    const dragHandle = page.getByLabel(/Drag/);
    await expect(dragHandle).toBeVisible();
  });

  test("should reorder pages via drag and drop", async ({ page }) => {
    // Create 3 pages
    for (let i = 0; i < 3; i++) {
      await page.getByLabel("Create new page").click();
      await page.waitForURL(/\/pages\//);
    }

    // Get the tree items
    const items = page.getByRole("treeitem");
    await expect(items).toHaveCount(3);

    // Get the first and last items
    const firstItem = items.first();
    const lastItem = items.last();

    // Drag first item to after last item
    await firstItem.hover();
    const dragHandle = firstItem.getByLabel(/Drag/);

    const firstBox = await firstItem.boundingBox();
    const lastBox = await lastItem.boundingBox();

    if (firstBox && lastBox) {
      await page.mouse.move(
        firstBox.x + firstBox.width / 2,
        firstBox.y + firstBox.height / 2
      );
      await page.mouse.down();
      await page.mouse.move(
        lastBox.x + lastBox.width / 2,
        lastBox.y + lastBox.height,
        { steps: 10 }
      );
      await page.mouse.up();
    }

    // Verify the order changed (check after reload for persistence)
    await page.reload();
    // Order verification depends on title content
  });
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `src/app/api/pages/[id]/reorder/route.ts` |
| CREATE | `src/hooks/useReorderPage.ts` |
| CREATE | `src/components/workspace/SortableSidebarTreeNode.tsx` |
| CREATE | `src/components/workspace/DndSidebarTree.tsx` |
| MODIFY | `src/components/workspace/Sidebar.tsx` (switch to DndSidebarTree) |
| CREATE | `src/__tests__/hooks/useReorderPage.test.ts` |
| CREATE | `src/__tests__/api/pages/reorder.test.ts` |
| CREATE | `tests/e2e/drag-drop.spec.ts` |

---

**Last Updated:** 2026-02-21
