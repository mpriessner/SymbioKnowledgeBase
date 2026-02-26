import path from "path";
import { fileSlug } from "./slug";
import { INDEX_FILENAME } from "./config";
import type { SyncPageData } from "./types";

/**
 * A resolved file path entry for a page in the mirror directory.
 */
export interface ResolvedPath {
  /** Database page ID */
  pageId: string;
  /** Relative file path within the tenant folder (e.g. "Projects/_index.md") */
  filePath: string;
  /** Relative directory path (e.g. "Projects/") — used for asset folders */
  dirPath: string;
}

/**
 * Build a mapping of page IDs → filesystem paths for all pages.
 *
 * Folder structure rules:
 * 1. Leaf page (no children) → single .md file at parent level
 *    Example: "Welcome.md"
 * 2. Page WITH children → folder named after page + _index.md inside
 *    Example: "Projects/_index.md"
 * 3. Multi-tenant: each tenant gets its own root folder
 * 4. Sibling pages with the same slug get a numeric suffix
 */
export function buildPagePaths(pages: SyncPageData[]): Map<string, ResolvedPath> {
  const pageMap = new Map(pages.map((p) => [p.id, p]));
  const childrenMap = new Map<string | null, SyncPageData[]>();

  // Group pages by parentId
  for (const page of pages) {
    const parentId = page.parentId;
    const siblings = childrenMap.get(parentId) ?? [];
    siblings.push(page);
    childrenMap.set(parentId, siblings);
  }

  // Sort each sibling group by position
  for (const siblings of childrenMap.values()) {
    siblings.sort((a, b) => a.position - b.position);
  }

  // Check which pages have children
  const hasChildren = new Set<string>();
  for (const page of pages) {
    if (page.parentId) hasChildren.add(page.parentId);
  }

  const result = new Map<string, ResolvedPath>();

  /**
   * Build the folder path for a page by walking up the parent chain.
   * Returns an array of slug segments.
   */
  function getAncestorSegments(pageId: string | null): string[] {
    if (!pageId) return [];
    const page = pageMap.get(pageId);
    if (!page) return [];
    const parentSegments = getAncestorSegments(page.parentId);
    return [...parentSegments, fileSlug(page.title)];
  }

  // Track used filenames per directory to handle duplicates
  const usedNames = new Map<string, Set<string>>();

  function getUniqueName(dir: string, baseName: string, ext: string): string {
    const dirKey = dir || "__root__";
    if (!usedNames.has(dirKey)) {
      usedNames.set(dirKey, new Set());
    }
    const used = usedNames.get(dirKey)!;
    const fullName = baseName + ext;
    if (!used.has(fullName.toLowerCase())) {
      used.add(fullName.toLowerCase());
      return fullName;
    }
    // Add numeric suffix
    let i = 2;
    while (used.has(`${baseName}-${i}${ext}`.toLowerCase())) {
      i++;
    }
    const unique = `${baseName}-${i}${ext}`;
    used.add(unique.toLowerCase());
    return unique;
  }

  for (const page of pages) {
    const ancestorSegments = getAncestorSegments(page.parentId);
    const parentDir = ancestorSegments.join("/");
    const slug = fileSlug(page.title);

    if (hasChildren.has(page.id)) {
      // Page has children → folder + _index.md
      const dirName = getUniqueName(parentDir, slug, "");
      // Remove the extension from dirName since it's a folder
      const dirPath = parentDir ? `${parentDir}/${dirName}` : dirName;
      const filePath = `${dirPath}/${INDEX_FILENAME}`;
      result.set(page.id, { pageId: page.id, filePath, dirPath });
    } else {
      // Leaf page → .md file
      const fileName = getUniqueName(parentDir, slug, ".md");
      const filePath = parentDir ? `${parentDir}/${fileName}` : fileName;
      const dirPath = parentDir
        ? `${parentDir}/${slug}`
        : slug;
      result.set(page.id, { pageId: page.id, filePath, dirPath });
    }
  }

  return result;
}

/**
 * Get the absolute file path for a page within the mirror directory.
 */
export function absolutePath(
  mirrorRoot: string,
  tenantId: string,
  relativePath: string
): string {
  return path.join(mirrorRoot, tenantId, relativePath);
}
