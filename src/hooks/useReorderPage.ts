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
export function optimisticReorder(
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
