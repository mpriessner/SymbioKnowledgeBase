import fs from "fs/promises";
import path from "path";
import { MIRROR_ROOT, META_FILENAME } from "./config";
import type { SyncMetadata } from "./types";

/**
 * Resolve a user-supplied path *inside* a tenant's mirror root and confine it
 * to that root.
 *
 * Two traversal bugs are guarded here:
 *   1. The previous guard used `resolved.startsWith(tenantRoot)` with no
 *      trailing separator, so tenant "abc" matched sibling "abcd/..." and a
 *      caller could read another tenant's files. We require the resolved path
 *      to equal the root OR sit beneath `tenantRoot + sep`.
 *   2. Any user path segment equal to ".." is rejected before joining, so a
 *      crafted "../../etc/passwd" cannot climb out even if path normalization
 *      would otherwise collapse it.
 *
 * Throws `"Path traversal detected"` on violation — the API routes match this
 * exact message to return a 400, so it must not change.
 */
function resolveTenantPath(tenantId: string, userPath: string): string {
  // Reject explicit parent-directory segments anywhere in the user path,
  // independent of OS separator (handles "..", "a/../b", "a\..\b").
  const segments = userPath.split(/[/\\]+/);
  if (segments.some((seg) => seg === "..")) {
    throw new Error("Path traversal detected");
  }

  const tenantRoot = path.resolve(MIRROR_ROOT, tenantId);
  const absPath = path.join(tenantRoot, userPath);
  const resolved = path.resolve(absPath);

  if (resolved !== tenantRoot && !resolved.startsWith(tenantRoot + path.sep)) {
    throw new Error("Path traversal detected");
  }

  return resolved;
}

/**
 * List files in the mirror directory for a tenant.
 * Returns relative paths within the tenant root.
 */
export async function listMirrorFiles(
  tenantId: string,
  subPath: string = ""
): Promise<
  Array<{
    name: string;
    path: string;
    type: "file" | "directory";
    size?: number;
  }>
> {
  // Confine the user-supplied subPath to the tenant root (was previously
  // joined with no guard, allowing ?path=../<otherTenant> traversal).
  let dirPath: string;
  try {
    dirPath = resolveTenantPath(tenantId, subPath);
  } catch {
    return [];
  }

  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const result = [];
  for (const entry of entries) {
    // Skip metadata and hidden files
    if (entry.name === META_FILENAME || entry.name.startsWith(".")) continue;

    const relativePath = subPath
      ? `${subPath}/${entry.name}`
      : entry.name;

    if (entry.isDirectory()) {
      result.push({
        name: entry.name,
        path: relativePath,
        type: "directory" as const,
      });
    } else {
      const stat = await fs.stat(path.join(dirPath, entry.name));
      result.push({
        name: entry.name,
        path: relativePath,
        type: "file" as const,
        size: stat.size,
      });
    }
  }

  return result.sort((a, b) => {
    // Directories first, then files
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Read a file from the mirror directory.
 */
export async function readMirrorFile(
  tenantId: string,
  filePath: string
): Promise<string | null> {
  // Throws "Path traversal detected" on escape (caught by the route → 400).
  const resolved = resolveTenantPath(tenantId, filePath);

  try {
    return await fs.readFile(resolved, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Write a file to the mirror directory.
 */
export async function writeMirrorFile(
  tenantId: string,
  filePath: string,
  content: string
): Promise<void> {
  // Throws "Path traversal detected" on escape (caught by the route → 400).
  const resolved = resolveTenantPath(tenantId, filePath);

  await fs.mkdir(path.dirname(resolved), { recursive: true });
  await fs.writeFile(resolved, content, "utf-8");
}

/**
 * Delete a file from the mirror directory.
 */
export async function deleteMirrorFile(
  tenantId: string,
  filePath: string
): Promise<boolean> {
  // Throws "Path traversal detected" on escape (caught by the route → 400).
  const resolved = resolveTenantPath(tenantId, filePath);

  try {
    await fs.unlink(resolved);
    return true;
  } catch {
    return false;
  }
}

/**
 * Search for text across all .md files in the mirror.
 */
export async function searchMirrorFiles(
  tenantId: string,
  query: string,
  maxResults: number = 20
): Promise<
  Array<{
    filePath: string;
    pageId: string | null;
    matchCount: number;
    excerpts: string[];
  }>
> {
  const tenantRoot = path.resolve(MIRROR_ROOT, tenantId);
  const metaPath = path.join(tenantRoot, META_FILENAME);

  // Load metadata to map files to page IDs
  let meta: SyncMetadata | null = null;
  try {
    const raw = await fs.readFile(metaPath, "utf-8");
    meta = JSON.parse(raw) as SyncMetadata;
  } catch {
    // No metadata available
  }

  const results: Array<{
    filePath: string;
    pageId: string | null;
    matchCount: number;
    excerpts: string[];
  }> = [];

  const queryLower = query.toLowerCase();

  async function walkDir(dir: string): Promise<void> {
    if (results.length >= maxResults) return;

    // Confinement: never read or recurse outside the tenant root, even if a
    // directory entry resolves elsewhere (e.g. a symlink).
    const resolvedDir = path.resolve(dir);
    if (
      resolvedDir !== tenantRoot &&
      !resolvedDir.startsWith(tenantRoot + path.sep)
    ) {
      return;
    }

    let entries;
    try {
      entries = await fs.readdir(resolvedDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= maxResults) return;
      if (entry.name.startsWith(".")) continue;

      const fullPath = path.join(resolvedDir, entry.name);

      if (entry.isDirectory()) {
        await walkDir(fullPath);
      } else if (entry.name.endsWith(".md")) {
        try {
          const content = await fs.readFile(fullPath, "utf-8");
          const contentLower = content.toLowerCase();

          if (contentLower.includes(queryLower)) {
            const lines = content.split("\n");
            const excerpts: string[] = [];
            let matchCount = 0;

            for (const line of lines) {
              if (line.toLowerCase().includes(queryLower)) {
                matchCount++;
                if (excerpts.length < 3) {
                  excerpts.push(line.trim().slice(0, 200));
                }
              }
            }

            const relativePath = path.relative(tenantRoot, fullPath);

            // Find page ID from metadata
            let pageId: string | null = null;
            if (meta) {
              const entry = Object.values(meta.pages).find(
                (p) => p.filePath === relativePath
              );
              pageId = entry?.id ?? null;
            }

            results.push({
              filePath: relativePath,
              pageId,
              matchCount,
              excerpts,
            });
          }
        } catch {
          // Skip unreadable files
        }
      }
    }
  }

  await walkDir(tenantRoot);
  return results;
}

/**
 * Get mirror tree structure for a tenant.
 */
export async function getMirrorTree(
  tenantId: string,
  maxDepth: number = 5
): Promise<TreeNode[]> {
  const tenantRoot = path.resolve(MIRROR_ROOT, tenantId);
  return buildTree(tenantRoot, "", maxDepth, 0);
}

interface TreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: TreeNode[];
}

async function buildTree(
  basePath: string,
  relativePath: string,
  maxDepth: number,
  currentDepth: number
): Promise<TreeNode[]> {
  if (currentDepth >= maxDepth) return [];

  const fullPath = path.resolve(basePath, relativePath);

  // Confinement: never recurse outside the tenant root (basePath), even if a
  // directory entry resolves elsewhere (e.g. a symlink).
  const root = path.resolve(basePath);
  if (fullPath !== root && !fullPath.startsWith(root + path.sep)) {
    return [];
  }

  let entries;
  try {
    entries = await fs.readdir(fullPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const nodes: TreeNode[] = [];
  for (const entry of entries) {
    if (entry.name === META_FILENAME || entry.name.startsWith(".")) continue;

    const childRelative = relativePath
      ? `${relativePath}/${entry.name}`
      : entry.name;

    if (entry.isDirectory()) {
      const children = await buildTree(
        basePath,
        childRelative,
        maxDepth,
        currentDepth + 1
      );
      nodes.push({
        name: entry.name,
        path: childRelative,
        type: "directory",
        children,
      });
    } else {
      nodes.push({
        name: entry.name,
        path: childRelative,
        type: "file",
      });
    }
  }

  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
