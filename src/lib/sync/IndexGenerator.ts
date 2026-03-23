import fs from "fs/promises";
import path from "path";
import { MIRROR_ROOT, META_FILENAME, INDEX_FILENAME, DATABASES_DIR } from "./config";
import { syncLock } from "./SyncLock";
import type { SyncMetadata, SyncPageEntry, SyncDatabaseEntry } from "./types";
import { migrateMetadata } from "./types";

interface PageTreeNode {
  name: string;
  filePath: string;
  icon: string | null;
  position: number;
  children: PageTreeNode[];
}

/**
 * Write a file atomically: write to a temp file, then rename.
 */
async function atomicWrite(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  const tmpPath = filePath + ".tmp." + process.pid;
  await fs.writeFile(tmpPath, content, "utf-8");
  await fs.rename(tmpPath, filePath);
}

/**
 * Read the icon from a page's .md file frontmatter.
 * Returns the icon string or null if not found.
 */
async function readIconFromFile(tenantRoot: string, filePath: string): Promise<string | null> {
  try {
    const absPath = path.join(tenantRoot, filePath);
    const content = await fs.readFile(absPath, "utf-8");
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) return null;
    const iconMatch = fmMatch[1].match(/^icon:\s*(.+)$/m);
    if (!iconMatch) return null;
    const val = iconMatch[1].trim();
    // Strip quotes if present
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      return val.slice(1, -1) || null;
    }
    return val === "null" || val === "" ? null : val;
  } catch {
    return null;
  }
}

/**
 * Read column count from a database .md file frontmatter.
 */
async function readColumnCount(tenantRoot: string, filePath: string): Promise<number> {
  try {
    const absPath = path.join(tenantRoot, filePath);
    const content = await fs.readFile(absPath, "utf-8");
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) return 0;
    const yaml = fmMatch[1];
    // Find the columns: section and count list items (lines starting with "  - id:")
    const colStart = yaml.indexOf("columns:");
    if (colStart === -1) return 0;
    const colSection = yaml.slice(colStart);
    const idMatches = colSection.match(/^\s+-\s+id:/gm);
    return idMatches ? idMatches.length : 0;
  } catch {
    return 0;
  }
}

/**
 * Build a hierarchical tree from flat page entries using file paths.
 */
function buildPageTree(pages: Record<string, SyncPageEntry>, icons: Map<string, string | null>): PageTreeNode[] {
  // Group entries by directory depth
  const entries = Object.values(pages);

  // Build a map from directory path to its _index.md entry
  const dirToIndex = new Map<string, SyncPageEntry>();
  const leafEntries: SyncPageEntry[] = [];

  for (const entry of entries) {
    const basename = path.basename(entry.filePath);
    if (basename === INDEX_FILENAME) {
      const dir = path.dirname(entry.filePath);
      dirToIndex.set(dir, entry);
    } else {
      leafEntries.push(entry);
    }
  }

  // Build tree nodes for _index.md pages (parent pages)
  const nodeMap = new Map<string, PageTreeNode>();

  for (const [dir, entry] of dirToIndex) {
    const name = path.basename(dir);
    nodeMap.set(dir, {
      name,
      filePath: entry.filePath,
      icon: icons.get(entry.id) ?? null,
      position: 0,
      children: [],
    });
  }

  // Add leaf pages as nodes
  for (const entry of leafEntries) {
    const name = path.basename(entry.filePath, ".md");
    const dir = path.dirname(entry.filePath);
    const node: PageTreeNode = {
      name,
      filePath: entry.filePath,
      icon: icons.get(entry.id) ?? null,
      position: 0,
      children: [],
    };

    // Find parent directory node
    if (dir === "." || dir === "") {
      // Root-level leaf — will be collected below
      nodeMap.set(`__leaf__${entry.id}`, node);
    } else {
      const parentNode = nodeMap.get(dir);
      if (parentNode) {
        parentNode.children.push(node);
      } else {
        // Orphan — put at root
        nodeMap.set(`__leaf__${entry.id}`, node);
      }
    }
  }

  // Now build the hierarchy among directory nodes
  const rootNodes: PageTreeNode[] = [];

  for (const [dir, node] of nodeMap) {
    if (dir.startsWith("__leaf__")) {
      rootNodes.push(node);
      continue;
    }
    const parentDir = path.dirname(dir);
    if (parentDir === "." || parentDir === "") {
      rootNodes.push(node);
    } else {
      const parentNode = nodeMap.get(parentDir);
      if (parentNode) {
        parentNode.children.push(node);
      } else {
        rootNodes.push(node);
      }
    }
  }

  // Sort all children arrays alphabetically by name
  const sortTree = (nodes: PageTreeNode[]): void => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    for (const node of nodes) {
      sortTree(node.children);
    }
  };
  sortTree(rootNodes);

  return rootNodes;
}

/**
 * Render a page tree to markdown lines with indentation.
 */
function renderPageTree(nodes: PageTreeNode[], indent: number = 0): string[] {
  const lines: string[] = [];
  const prefix = "  ".repeat(indent);

  for (const node of nodes) {
    const iconPrefix = node.icon ? `${node.icon} ` : "";
    lines.push(`${prefix}- ${iconPrefix}[${node.name}](${node.filePath})`);
    if (node.children.length > 0) {
      lines.push(...renderPageTree(node.children, indent + 1));
    }
  }

  return lines;
}

/**
 * Generate the _index.md content for a tenant's mirror root.
 * Reads current page tree and database list from .skb-meta.json
 * and the database files themselves.
 */
export async function generateIndex(tenantId: string): Promise<string> {
  const tenantRoot = path.join(MIRROR_ROOT, tenantId);
  const metaPath = path.join(tenantRoot, META_FILENAME);

  let meta: SyncMetadata;
  try {
    const raw = await fs.readFile(metaPath, "utf-8");
    meta = migrateMetadata(JSON.parse(raw) as SyncMetadata);
  } catch {
    meta = {
      version: 2,
      tenantId,
      lastFullSync: new Date().toISOString(),
      pages: {},
      databases: {},
    };
  }

  const now = new Date().toISOString();
  const pageCount = Object.keys(meta.pages).length;
  const dbCount = Object.keys(meta.databases).length;
  const lastSync = meta.lastFullSync;

  // Read icons from page files
  const icons = new Map<string, string | null>();
  for (const entry of Object.values(meta.pages)) {
    const icon = await readIconFromFile(tenantRoot, entry.filePath);
    icons.set(entry.id, icon);
  }

  // Build page tree
  const pageTree = buildPageTree(meta.pages, icons);
  const pageLines = renderPageTree(pageTree);

  // Build database list
  const dbEntries = Object.values(meta.databases).sort((a, b) => {
    const nameA = path.basename(a.filePath, ".md");
    const nameB = path.basename(b.filePath, ".md");
    return nameA.localeCompare(nameB);
  });

  const dbLines: string[] = [];
  for (const entry of dbEntries) {
    const name = path.basename(entry.filePath, ".md");
    const icon = await readIconFromFile(tenantRoot, entry.filePath);
    const columnCount = await readColumnCount(tenantRoot, entry.filePath);
    const iconPrefix = icon ? `${icon} ` : "";
    const stats = `${entry.rowCount} rows, ${columnCount} columns`;
    dbLines.push(`- ${iconPrefix}[${name}](${entry.filePath}) — ${stats}`);
  }

  // Assemble the index
  const sections: string[] = [
    "---",
    "generated: true",
    "type: index",
    `updated: ${now}`,
    "---",
    "",
    "# Knowledge Base Index",
    "",
    "> Auto-generated table of contents. Do not edit — changes will be overwritten on next sync.",
    "",
    "## Summary",
    "",
    `- **Pages:** ${pageCount}`,
    `- **Databases:** ${dbCount}`,
    `- **Last sync:** ${lastSync}`,
  ];

  if (pageLines.length > 0) {
    sections.push("", "## Pages", "", ...pageLines);
  }

  if (dbLines.length > 0) {
    sections.push("", "## Databases", "", ...dbLines);
  }

  sections.push("");

  return sections.join("\n");
}

/**
 * Write the _index.md file. Acquires sync lock to prevent
 * FileWatcher from processing it.
 */
export async function writeIndex(tenantId: string): Promise<void> {
  const content = await generateIndex(tenantId);
  const indexPath = path.join(MIRROR_ROOT, tenantId, INDEX_FILENAME);

  syncLock.acquire(indexPath);

  try {
    await atomicWrite(indexPath, content);
  } finally {
    setTimeout(() => syncLock.release(indexPath), 1000);
  }
}

/** Debounce timers per tenant for index generation */
const indexDebounceTimers = new Map<string, NodeJS.Timeout>();

/**
 * Debounced version of writeIndex.
 * Rapid sync operations within 1 second only produce one index write.
 */
export function debouncedWriteIndex(tenantId: string): void {
  const existing = indexDebounceTimers.get(tenantId);
  if (existing) {
    clearTimeout(existing);
  }

  const timer = setTimeout(() => {
    indexDebounceTimers.delete(tenantId);
    writeIndex(tenantId).catch((err) =>
      console.error(`[IndexGenerator] Error writing index for ${tenantId}:`, err)
    );
  }, 1000);

  indexDebounceTimers.set(tenantId, timer);
}
