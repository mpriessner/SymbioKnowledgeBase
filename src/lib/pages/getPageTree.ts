import { prisma } from "@/lib/db";
import type { PageTreeNode } from "@/types/page";

interface PageRow {
  id: string;
  tenantId: string;
  parentId: string | null;
  teamspaceId?: string | null;
  spaceType?: string;
  title: string;
  icon: string | null;
  coverUrl: string | null;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Transforms a flat array of page records into a nested tree structure.
 * Uses a single-pass hash map approach — O(n) time complexity.
 *
 * Algorithm:
 * 1. Create a map of id -> node (with empty children array)
 * 2. Iterate all nodes, push each into its parent's children array
 * 3. Return only root nodes (parentId === null)
 */
export function buildPageTree(pages: PageRow[]): PageTreeNode[] {
  const nodeMap = new Map<string, PageTreeNode>();

  // First pass: create all nodes
  for (const page of pages) {
    nodeMap.set(page.id, {
      id: page.id,
      tenantId: page.tenantId,
      parentId: page.parentId,
      teamspaceId: page.teamspaceId ?? null,
      spaceType: (page.spaceType as "PRIVATE" | "TEAM" | "AGENT") ?? "PRIVATE",
      title: page.title,
      icon: page.icon,
      coverUrl: page.coverUrl,
      position: page.position,
      createdAt: page.createdAt.toISOString(),
      updatedAt: page.updatedAt.toISOString(),
      children: [],
    });
  }

  const roots: PageTreeNode[] = [];

  // Second pass: link children to parents
  for (const page of pages) {
    const node = nodeMap.get(page.id);
    if (!node) continue;

    if (page.parentId === null) {
      roots.push(node);
    } else {
      const parent = nodeMap.get(page.parentId);
      if (parent) {
        parent.children.push(node);
      } else {
        // Orphan page — parent does not exist, treat as root
        roots.push(node);
      }
    }
  }

  // Sort children by position at each level
  function sortChildren(nodes: PageTreeNode[]): void {
    nodes.sort((a, b) => a.position - b.position);
    for (const node of nodes) {
      if (node.children.length > 0) {
        sortChildren(node.children);
      }
    }
  }

  sortChildren(roots);

  return roots;
}

/**
 * Fetches all pages for a tenant and returns them as a nested tree.
 */
export async function getPageTree(tenantId: string): Promise<PageTreeNode[]> {
  const pages = await prisma.page.findMany({
    where: { tenantId },
    orderBy: { position: "asc" },
  });

  return buildPageTree(pages);
}

/**
 * Checks whether `targetId` is a descendant of `ancestorId`.
 * Used for circular reference detection when moving pages.
 *
 * Walks upward from targetId through parentId chain.
 * Returns true if ancestorId is found (circular), false otherwise.
 */
export async function isDescendant(
  tenantId: string,
  ancestorId: string,
  targetId: string
): Promise<boolean> {
  let currentId: string | null = targetId;
  const visited = new Set<string>();

  while (currentId !== null) {
    if (currentId === ancestorId) {
      return true;
    }

    // Prevent infinite loops from corrupted data
    if (visited.has(currentId)) {
      return false;
    }
    visited.add(currentId);

    const page: { parentId: string | null } | null =
      await prisma.page.findFirst({
        where: { id: currentId, tenantId },
        select: { parentId: true },
      });

    currentId = page?.parentId ?? null;
  }

  return false;
}

/**
 * Returns the ancestry chain for a given page (from root down to the page).
 * Useful for breadcrumbs.
 */
export async function getPageAncestry(
  tenantId: string,
  pageId: string
): Promise<{ id: string; title: string; icon: string | null }[]> {
  const ancestors: { id: string; title: string; icon: string | null }[] = [];
  let currentId: string | null = pageId;
  const visited = new Set<string>();

  while (currentId !== null) {
    if (visited.has(currentId)) break;
    visited.add(currentId);

    const page: {
      id: string;
      title: string;
      icon: string | null;
      parentId: string | null;
    } | null = await prisma.page.findFirst({
      where: { id: currentId, tenantId },
      select: { id: true, title: true, icon: true, parentId: true },
    });

    if (!page) break;

    ancestors.unshift({ id: page.id, title: page.title, icon: page.icon });
    currentId = page.parentId;
  }

  return ancestors;
}

/**
 * Fetches all pages for a tenant grouped by spaceType and returns them as nested trees.
 * Returns separate trees for PRIVATE, TEAM, and AGENT spaces.
 */
export async function getPageTreeBySpace(tenantId: string) {
  const pages = await prisma.page.findMany({
    where: { tenantId },
    select: {
      id: true,
      title: true,
      icon: true,
      parentId: true,
      position: true,
      spaceType: true,
      tenantId: true,
      teamspaceId: true,
      coverUrl: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });

  const grouped = {
    private: pages.filter((p) => p.spaceType === "PRIVATE"),
    team: pages.filter((p) => p.spaceType === "TEAM"),
    agent: pages.filter((p) => p.spaceType === "AGENT"),
  };

  return {
    private: buildPageTree(grouped.private),
    team: buildPageTree(grouped.team),
    agent: buildPageTree(grouped.agent),
  };
}
