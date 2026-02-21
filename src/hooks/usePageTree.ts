"use client";

import { useQuery } from "@tanstack/react-query";
import type { PageTreeNode } from "@/types/page";
import { pageKeys } from "@/hooks/usePages";

interface PageTreeResponse {
  data: PageTreeNode[];
  meta: Record<string, unknown>;
}

async function fetchPageTree(): Promise<PageTreeResponse> {
  const response = await fetch("/api/pages/tree");
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch page tree");
  }
  return response.json();
}

/**
 * Fetches the full page tree for the current tenant.
 * Returns a nested structure suitable for rendering the sidebar.
 */
export function usePageTree() {
  return useQuery({
    queryKey: pageKeys.tree(),
    queryFn: fetchPageTree,
    staleTime: 30_000, // 30 seconds
  });
}

/**
 * Utility: find a page node within the tree by ID.
 * Performs a depth-first search through the nested structure.
 */
export function findPageInTree(
  nodes: PageTreeNode[],
  pageId: string
): PageTreeNode | null {
  for (const node of nodes) {
    if (node.id === pageId) return node;
    if (node.children.length > 0) {
      const found = findPageInTree(node.children, pageId);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Utility: get the ancestry path (root to page) from the tree.
 * Returns an array of { id, title, icon } from root ancestor down to the page.
 */
export function getAncestryFromTree(
  nodes: PageTreeNode[],
  pageId: string
): { id: string; title: string; icon: string | null }[] {
  function search(
    currentNodes: PageTreeNode[],
    path: { id: string; title: string; icon: string | null }[]
  ): { id: string; title: string; icon: string | null }[] | null {
    for (const node of currentNodes) {
      const currentPath = [
        ...path,
        { id: node.id, title: node.title, icon: node.icon },
      ];
      if (node.id === pageId) {
        return currentPath;
      }
      if (node.children.length > 0) {
        const result = search(node.children, currentPath);
        if (result) return result;
      }
    }
    return null;
  }

  return search(nodes, []) || [];
}
