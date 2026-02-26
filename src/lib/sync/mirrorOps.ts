import fs from "fs/promises";
import path from "path";
import { MIRROR_ROOT, META_FILENAME } from "./config";
import type { SyncMetadata } from "./types";

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
  const dirPath = path.join(MIRROR_ROOT, tenantId, subPath);

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
  const absPath = path.join(MIRROR_ROOT, tenantId, filePath);

  // Security: ensure the resolved path is within the tenant root
  const tenantRoot = path.join(MIRROR_ROOT, tenantId);
  const resolved = path.resolve(absPath);
  if (!resolved.startsWith(tenantRoot)) {
    throw new Error("Path traversal detected");
  }

  try {
    return await fs.readFile(absPath, "utf-8");
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
  const absPath = path.join(MIRROR_ROOT, tenantId, filePath);

  // Security: ensure the resolved path is within the tenant root
  const tenantRoot = path.join(MIRROR_ROOT, tenantId);
  const resolved = path.resolve(absPath);
  if (!resolved.startsWith(tenantRoot)) {
    throw new Error("Path traversal detected");
  }

  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, content, "utf-8");
}

/**
 * Delete a file from the mirror directory.
 */
export async function deleteMirrorFile(
  tenantId: string,
  filePath: string
): Promise<boolean> {
  const absPath = path.join(MIRROR_ROOT, tenantId, filePath);

  const tenantRoot = path.join(MIRROR_ROOT, tenantId);
  const resolved = path.resolve(absPath);
  if (!resolved.startsWith(tenantRoot)) {
    throw new Error("Path traversal detected");
  }

  try {
    await fs.unlink(absPath);
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
  const tenantRoot = path.join(MIRROR_ROOT, tenantId);
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

    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= maxResults) return;
      if (entry.name.startsWith(".")) continue;

      const fullPath = path.join(dir, entry.name);

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
  const tenantRoot = path.join(MIRROR_ROOT, tenantId);
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

  const fullPath = path.join(basePath, relativePath);
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
