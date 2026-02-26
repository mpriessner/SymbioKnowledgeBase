import fs from "fs/promises";
import path from "path";
import chokidar from "chokidar";
import { prisma } from "@/lib/db";
import { markdownToTiptap } from "@/lib/markdown/deserializer";
import { savePageBlocks } from "@/lib/markdown/helpers";
import { MIRROR_ROOT, META_FILENAME, FS_DEBOUNCE_MS } from "./config";
import { syncLock } from "./SyncLock";
import type { SyncMetadata } from "./types";

type FSWatcher = ReturnType<typeof chokidar.watch>;

/**
 * File watcher that monitors the mirror directory and propagates
 * .md file changes back to the database.
 *
 * Handles:
 * - File modification → update page content in DB
 * - File creation → create new page in DB
 * - File deletion → delete page from DB
 */

/** Debounce timers per file path */
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

let watcher: FSWatcher | null = null;

/**
 * Start watching the mirror directory for changes.
 */
export function startFileWatcher(): FSWatcher {
  if (watcher) return watcher;

  watcher = chokidar.watch(MIRROR_ROOT, {
    ignoreInitial: true,
    persistent: true,
    depth: 10,
    ignored: [
      /(^|[/\\])\../, // dotfiles except .skb-meta.json
      /\.tmp\.\d+$/, // temp files from atomic writes
      `**/${META_FILENAME}`, // ignore metadata file changes
    ],
  });

  watcher
    .on("change", (filePath: string) => {
      if (!filePath.endsWith(".md")) return;
      debouncedHandler(filePath, handleFileChange);
    })
    .on("add", (filePath: string) => {
      if (!filePath.endsWith(".md")) return;
      debouncedHandler(filePath, handleFileAdd);
    })
    .on("unlink", (filePath: string) => {
      if (!filePath.endsWith(".md")) return;
      debouncedHandler(filePath, handleFileDelete);
    })
    .on("error", (error: unknown) => {
      console.error("FileWatcher error:", error);
    });

  console.log(`[FileWatcher] Watching ${MIRROR_ROOT}`);
  return watcher;
}

/**
 * Stop the file watcher.
 */
export async function stopFileWatcher(): Promise<void> {
  if (watcher) {
    await watcher.close();
    watcher = null;
  }
  // Clear all pending debounce timers
  for (const timer of debounceTimers.values()) {
    clearTimeout(timer);
  }
  debounceTimers.clear();
}

/**
 * Debounce a handler call for a given file path.
 */
function debouncedHandler(
  filePath: string,
  handler: (filePath: string) => Promise<void>
): void {
  const existing = debounceTimers.get(filePath);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    debounceTimers.delete(filePath);
    handler(filePath).catch((err) =>
      console.error(`[FileWatcher] Error handling ${filePath}:`, err)
    );
  }, FS_DEBOUNCE_MS);

  debounceTimers.set(filePath, timer);
}

/**
 * Resolve tenant ID from a file path.
 * File paths are: MIRROR_ROOT/tenantId/...
 */
function resolveTenantId(filePath: string): string | null {
  const relative = path.relative(MIRROR_ROOT, filePath);
  const parts = relative.split(path.sep);
  return parts.length >= 2 ? parts[0] : null;
}

/**
 * Handle a .md file modification: update existing page content.
 */
async function handleFileChange(filePath: string): Promise<void> {
  // Check sync lock — if locked, this change was triggered by DB→FS sync
  if (syncLock.isLocked(filePath)) {
    return;
  }

  const tenantId = resolveTenantId(filePath);
  if (!tenantId) return;

  const content = await fs.readFile(filePath, "utf-8");
  const { content: tiptapContent, metadata } = markdownToTiptap(content);

  // Find the page by ID from frontmatter
  const pageId = metadata.id;
  if (!pageId) {
    console.warn(
      `[FileWatcher] Changed file has no ID in frontmatter: ${filePath}`
    );
    return;
  }

  // Verify page exists
  const page = await prisma.page.findFirst({
    where: { id: pageId, tenantId },
  });

  if (!page) {
    console.warn(
      `[FileWatcher] Page ${pageId} not found in DB for tenant ${tenantId}`
    );
    return;
  }

  // Update page metadata if changed
  const updates: Record<string, unknown> = {};
  if (metadata.title && metadata.title !== page.title) {
    updates.title = metadata.title;
  }
  if (metadata.icon !== undefined && metadata.icon !== page.icon) {
    updates.icon = metadata.icon;
  }

  if (Object.keys(updates).length > 0) {
    await prisma.page.update({
      where: { id: pageId },
      data: updates,
    });
  }

  // Update block content
  await savePageBlocks(pageId, tenantId, tiptapContent);

  console.log(`[FileWatcher] Updated page ${pageId} from ${filePath}`);
}

/**
 * Handle a new .md file: create a new page in the DB.
 */
async function handleFileAdd(filePath: string): Promise<void> {
  if (syncLock.isLocked(filePath)) {
    return;
  }

  const tenantId = resolveTenantId(filePath);
  if (!tenantId) return;

  const content = await fs.readFile(filePath, "utf-8");
  const { content: tiptapContent, metadata } = markdownToTiptap(content);

  // If the file has an ID, it might already exist (sync created it)
  if (metadata.id) {
    const existing = await prisma.page.findFirst({
      where: { id: metadata.id, tenantId },
    });
    if (existing) {
      // File was created by DB→FS sync, already exists in DB
      return;
    }
  }

  // Determine title from frontmatter or filename
  const fileName = path.basename(filePath, ".md");
  const title = metadata.title || (fileName === "_index" ? "Untitled" : fileName);

  // Determine parent from directory structure
  const relative = path.relative(
    path.join(MIRROR_ROOT, tenantId),
    filePath
  );
  const parts = relative.split(path.sep);
  let parentId: string | null = null;

  if (parts.length > 1) {
    // File is in a subdirectory — try to find parent page by reading metadata
    parentId = await resolveParentFromPath(tenantId, parts.slice(0, -1));
  }

  // Create the new page
  const page = await prisma.page.create({
    data: {
      tenantId,
      title,
      icon: metadata.icon || null,
      parentId,
      position: 0,
    },
  });

  // Save blocks
  await savePageBlocks(page.id, tenantId, tiptapContent);

  // Update the .md file with the new page ID in frontmatter
  const updatedContent = addIdToFrontmatter(content, page.id);
  syncLock.acquire(filePath);
  await fs.writeFile(filePath, updatedContent, "utf-8");
  setTimeout(() => syncLock.release(filePath), 1000);

  // Update metadata file
  await updateMetaForNewPage(tenantId, page.id, filePath);

  console.log(`[FileWatcher] Created page ${page.id} from ${filePath}`);
}

/**
 * Handle a .md file deletion: remove the page from DB.
 */
async function handleFileDelete(filePath: string): Promise<void> {
  if (syncLock.isLocked(filePath)) {
    return;
  }

  const tenantId = resolveTenantId(filePath);
  if (!tenantId) return;

  // Find the page by its file path in the metadata
  const metaPath = path.join(MIRROR_ROOT, tenantId, META_FILENAME);
  let meta: SyncMetadata;
  try {
    const raw = await fs.readFile(metaPath, "utf-8");
    meta = JSON.parse(raw) as SyncMetadata;
  } catch {
    return;
  }

  const relative = path.relative(
    path.join(MIRROR_ROOT, tenantId),
    filePath
  );

  // Find the page entry by file path
  const entry = Object.values(meta.pages).find(
    (p) => p.filePath === relative
  );

  if (!entry) {
    console.warn(
      `[FileWatcher] Deleted file not found in metadata: ${filePath}`
    );
    return;
  }

  // Delete the page from DB
  try {
    await prisma.page.delete({
      where: { id: entry.id },
    });
  } catch {
    // Page may already be deleted
  }

  // Remove from metadata
  delete meta.pages[entry.id];
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), "utf-8");

  console.log(`[FileWatcher] Deleted page ${entry.id} from ${filePath}`);
}

/**
 * Try to resolve a parent page ID from a directory path.
 */
async function resolveParentFromPath(
  tenantId: string,
  dirParts: string[]
): Promise<string | null> {
  const metaPath = path.join(MIRROR_ROOT, tenantId, META_FILENAME);
  try {
    const raw = await fs.readFile(metaPath, "utf-8");
    const meta = JSON.parse(raw) as SyncMetadata;

    // The parent should be the page whose folder matches the directory
    const dirPath = dirParts.join("/");
    const indexPath = dirPath + "/_index.md";

    const entry = Object.values(meta.pages).find(
      (p) => p.filePath === indexPath
    );

    return entry?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Add an "id" field to the frontmatter of a markdown string.
 */
function addIdToFrontmatter(markdown: string, id: string): string {
  const fmMatch = markdown.match(/^---\n([\s\S]*?)\n---\n/);
  if (fmMatch) {
    // Insert id after the opening ---
    const yamlContent = fmMatch[1];
    return `---\nid: ${id}\n${yamlContent}\n---\n${markdown.slice(fmMatch[0].length)}`;
  }

  // No frontmatter — add it
  return `---\nid: ${id}\n---\n\n${markdown}`;
}

/**
 * Update the .skb-meta.json with a new page entry.
 */
async function updateMetaForNewPage(
  tenantId: string,
  pageId: string,
  filePath: string
): Promise<void> {
  const metaPath = path.join(MIRROR_ROOT, tenantId, META_FILENAME);
  let meta: SyncMetadata;
  try {
    const raw = await fs.readFile(metaPath, "utf-8");
    meta = JSON.parse(raw) as SyncMetadata;
  } catch {
    meta = {
      version: 1,
      tenantId,
      lastFullSync: new Date().toISOString(),
      pages: {},
    };
  }

  const relative = path.relative(
    path.join(MIRROR_ROOT, tenantId),
    filePath
  );

  meta.pages[pageId] = {
    id: pageId,
    filePath: relative,
    contentHash: "",
    lastSynced: new Date().toISOString(),
  };

  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), "utf-8");
}
