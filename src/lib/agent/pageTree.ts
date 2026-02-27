/**
 * Tree/flat list building utilities for the Agent Page Tree API (SKB-33.5).
 */

import type {
  PageWithCounts,
  AgentTreeNode,
  AgentFlatNode,
  TreeMeta,
} from "./types";

/**
 * Determine if a page's summary is stale (page updated after summary).
 */
function isSummaryStale(page: PageWithCounts): boolean {
  if (!page.summaryUpdatedAt) return page.oneLiner === null;
  return page.updatedAt > page.summaryUpdatedAt;
}

/**
 * Build a nested tree structure from a flat list of pages.
 * Root pages (parentId = null) are top-level entries.
 * Children are sorted by position within each level.
 */
export function buildAgentPageTree(pages: PageWithCounts[]): AgentTreeNode[] {
  // Group pages by parentId
  const byParent = new Map<string | null, PageWithCounts[]>();
  for (const page of pages) {
    const key = page.parentId ?? "__root__";
    const group = byParent.get(key);
    if (group) {
      group.push(page);
    } else {
      byParent.set(key, [page]);
    }
  }

  function buildSubtree(parentId: string | null): AgentTreeNode[] {
    const key = parentId ?? "__root__";
    const children = byParent.get(key) || [];
    return children
      .sort((a, b) => a.position - b.position)
      .map((page) => ({
        id: page.id,
        title: page.title,
        icon: page.icon,
        oneLiner: page.oneLiner,
        childCount: (byParent.get(page.id) || []).length,
        linkCount: page._count.sourceLinks + page._count.targetLinks,
        updatedAt: page.updatedAt.toISOString(),
        summaryStale: isSummaryStale(page),
        children: buildSubtree(page.id),
      }));
  }

  return buildSubtree(null);
}

/**
 * Build a flat list from pages in tree order (parent before children, by position).
 * Each node includes depth and breadcrumb path.
 */
export function buildFlatList(pages: PageWithCounts[]): AgentFlatNode[] {
  const byParent = new Map<string | null, PageWithCounts[]>();
  const pagesById = new Map<string, PageWithCounts>();

  for (const page of pages) {
    pagesById.set(page.id, page);
    const key = page.parentId ?? "__root__";
    const group = byParent.get(key);
    if (group) {
      group.push(page);
    } else {
      byParent.set(key, [page]);
    }
  }

  const result: AgentFlatNode[] = [];

  function walk(parentId: string | null, depth: number, pathPrefix: string) {
    const key = parentId ?? "__root__";
    const children = byParent.get(key) || [];
    for (const page of children.sort((a, b) => a.position - b.position)) {
      const pagePath = pathPrefix + "/" + page.title;
      result.push({
        id: page.id,
        title: page.title,
        icon: page.icon,
        oneLiner: page.oneLiner,
        parentId: page.parentId,
        depth,
        path: pagePath,
        childCount: (byParent.get(page.id) || []).length,
        linkCount: page._count.sourceLinks + page._count.targetLinks,
        updatedAt: page.updatedAt.toISOString(),
        summaryStale: isSummaryStale(page),
      });
      walk(page.id, depth + 1, pagePath);
    }
  }

  walk(null, 0, "");
  return result;
}

/**
 * Generate the breadcrumb path for a single page.
 */
export function generatePagePath(
  pageId: string,
  pagesById: Map<string, { title: string; parentId: string | null }>
): string {
  const segments: string[] = [];
  let currentId: string | null = pageId;

  while (currentId) {
    const page = pagesById.get(currentId);
    if (!page) break;
    segments.unshift(page.title);
    currentId = page.parentId;
  }

  return "/" + segments.join("/");
}

/**
 * Compute summary metadata for the response.
 */
export function computeTreeMeta(pages: PageWithCounts[]): TreeMeta {
  let pagesWithSummaries = 0;
  let staleSummaries = 0;

  for (const page of pages) {
    if (page.oneLiner !== null) pagesWithSummaries++;
    if (isSummaryStale(page)) staleSummaries++;
  }

  return {
    totalPages: pages.length,
    pagesWithSummaries,
    staleSummaries,
    generatedAt: new Date().toISOString(),
  };
}
