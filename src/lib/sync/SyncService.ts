import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import type { JSONContent } from "@tiptap/core";
import { prisma } from "@/lib/db";
import { tiptapToMarkdown } from "@/lib/markdown/serializer";
import { MIRROR_ROOT, META_FILENAME } from "./config";
import { buildPagePaths, absolutePath } from "./FolderStructure";
import { syncLock } from "./SyncLock";
import { hasFileChanged, createConflictBackup } from "./conflict";
import type { SyncMetadata, SyncPageData } from "./types";

/**
 * Write a file atomically: write to a temp file, then rename.
 * This prevents partial reads by other processes.
 */
async function atomicWrite(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  const tmpPath = filePath + ".tmp." + process.pid;
  await fs.writeFile(tmpPath, content, "utf-8");
  await fs.rename(tmpPath, filePath);
}

/**
 * Compute MD5 hash of a string.
 */
function md5(content: string): string {
  return crypto.createHash("md5").update(content, "utf-8").digest("hex");
}

/**
 * Convert a SyncPageData to markdown with full frontmatter (id, position, spaceType).
 */
function pageToMarkdownWithSync(page: SyncPageData): string {
  const sortedBlocks = [...page.blocks].sort(
    (a, b) => a.position - b.position
  );
  const doc: JSONContent = {
    type: "doc",
    content: sortedBlocks.map(
      (block) => block.content as unknown as JSONContent
    ),
  };

  return tiptapToMarkdown(doc, {
    includeFrontmatter: true,
    metadata: {
      id: page.id,
      title: page.title,
      icon: page.icon,
      oneLiner: page.oneLiner,
      summary: page.summary,
      summaryUpdatedAt: page.summaryUpdatedAt?.toISOString() ?? null,
      parent: page.parentId,
      position: page.position,
      spaceType: page.spaceType,
      created: page.createdAt.toISOString(),
      updated: page.updatedAt.toISOString(),
    },
  });
}

/**
 * Perform a full sync from database → filesystem for a single tenant.
 *
 * Reads all pages from the DB, generates Markdown files with frontmatter,
 * and writes them to the mirror directory. Also writes .skb-meta.json.
 *
 * Returns the number of pages synced.
 */
export async function fullSync(tenantId: string): Promise<number> {
  const pages = await prisma.page.findMany({
    where: { tenantId },
    include: {
      blocks: { orderBy: { position: "asc" } },
    },
    orderBy: { position: "asc" },
  });

  if (pages.length === 0) return 0;

  const syncPages: SyncPageData[] = pages.map((p) => ({
    id: p.id,
    title: p.title,
    icon: p.icon,
    parentId: p.parentId,
    position: p.position,
    spaceType: p.spaceType,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    blocks: p.blocks.map((b) => ({
      id: b.id,
      content: b.content,
      position: b.position,
    })),
  }));

  return syncPagesToFilesystem(tenantId, syncPages);
}

/**
 * Sync a set of pages to the filesystem.
 */
export async function syncPagesToFilesystem(
  tenantId: string,
  pages: SyncPageData[]
): Promise<number> {
  const tenantRoot = path.join(MIRROR_ROOT, tenantId);
  const pathMap = buildPagePaths(pages);

  // Load or create metadata
  const metaPath = path.join(tenantRoot, META_FILENAME);
  let meta: SyncMetadata;
  try {
    const existing = await fs.readFile(metaPath, "utf-8");
    meta = JSON.parse(existing) as SyncMetadata;
  } catch {
    meta = {
      version: 1,
      tenantId,
      lastFullSync: new Date().toISOString(),
      pages: {},
    };
  }

  let syncCount = 0;

  for (const page of pages) {
    const resolved = pathMap.get(page.id);
    if (!resolved) continue;

    const markdown = pageToMarkdownWithSync(page);
    const absPath = absolutePath(MIRROR_ROOT, tenantId, resolved.filePath);

    // Check for conflict: has the file been modified since last sync?
    const fileChanged = await hasFileChanged(tenantId, page.id);
    if (fileChanged) {
      try {
        const existingContent = await fs.readFile(absPath, "utf-8");
        await createConflictBackup(
          tenantId,
          page.id,
          resolved.filePath,
          existingContent,
          "fs"
        );
      } catch {
        // File may not exist yet — no conflict
      }
    }

    // Acquire sync lock to prevent FS watcher from echoing
    syncLock.acquire(absPath);

    try {
      await atomicWrite(absPath, markdown);

      meta.pages[page.id] = {
        id: page.id,
        filePath: resolved.filePath,
        contentHash: md5(markdown),
        lastSynced: new Date().toISOString(),
      };

      syncCount++;
    } finally {
      setTimeout(() => syncLock.release(absPath), 1000);
    }
  }

  // Write metadata
  meta.lastFullSync = new Date().toISOString();
  await atomicWrite(metaPath, JSON.stringify(meta, null, 2));

  return syncCount;
}

/**
 * Sync a single page from DB → filesystem (live sync).
 */
export async function syncPageToFilesystem(
  tenantId: string,
  pageId: string
): Promise<void> {
  const page = await prisma.page.findFirst({
    where: { id: pageId, tenantId },
    include: {
      blocks: { orderBy: { position: "asc" } },
    },
  });

  if (!page) return;

  // Need all pages to determine folder structure
  const allPages = await prisma.page.findMany({
    where: { tenantId },
    select: {
      id: true,
      title: true,
      icon: true,
      parentId: true,
      position: true,
      spaceType: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const syncPage: SyncPageData = {
    id: page.id,
    title: page.title,
    icon: page.icon,
    parentId: page.parentId,
    position: page.position,
    spaceType: page.spaceType,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
    blocks: page.blocks.map((b) => ({
      id: b.id,
      content: b.content,
      position: b.position,
    })),
  };

  // Build paths using all pages (needed for parent/child structure)
  const allSyncPages: SyncPageData[] = allPages.map((p) => ({
    ...p,
    blocks: p.id === page.id ? syncPage.blocks : [],
  }));

  const pathMap = buildPagePaths(allSyncPages);
  const resolved = pathMap.get(pageId);
  if (!resolved) return;

  const markdown = pageToMarkdownWithSync(syncPage);
  const absPath = absolutePath(MIRROR_ROOT, tenantId, resolved.filePath);

  syncLock.acquire(absPath);

  try {
    await atomicWrite(absPath, markdown);

    // Update metadata
    const metaPath = path.join(MIRROR_ROOT, tenantId, META_FILENAME);
    let meta: SyncMetadata;
    try {
      const existing = await fs.readFile(metaPath, "utf-8");
      meta = JSON.parse(existing) as SyncMetadata;
    } catch {
      meta = {
        version: 1,
        tenantId,
        lastFullSync: new Date().toISOString(),
        pages: {},
      };
    }

    meta.pages[pageId] = {
      id: pageId,
      filePath: resolved.filePath,
      contentHash: md5(markdown),
      lastSynced: new Date().toISOString(),
    };

    await atomicWrite(metaPath, JSON.stringify(meta, null, 2));
  } finally {
    setTimeout(() => syncLock.release(absPath), 1000);
  }
}

/**
 * Delete a page's .md file from the filesystem.
 */
export async function deletePageFile(
  tenantId: string,
  pageId: string
): Promise<void> {
  const metaPath = path.join(MIRROR_ROOT, tenantId, META_FILENAME);
  let meta: SyncMetadata;
  try {
    const existing = await fs.readFile(metaPath, "utf-8");
    meta = JSON.parse(existing) as SyncMetadata;
  } catch {
    return;
  }

  const entry = meta.pages[pageId];
  if (!entry) return;

  const absPath = absolutePath(MIRROR_ROOT, tenantId, entry.filePath);

  syncLock.acquire(absPath);
  try {
    await fs.unlink(absPath).catch(() => {});
    delete meta.pages[pageId];
    await atomicWrite(metaPath, JSON.stringify(meta, null, 2));
  } finally {
    setTimeout(() => syncLock.release(absPath), 1000);
  }
}

/**
 * Read sync metadata for a tenant.
 */
export async function readSyncMetadata(
  tenantId: string
): Promise<SyncMetadata | null> {
  const metaPath = path.join(MIRROR_ROOT, tenantId, META_FILENAME);
  try {
    const content = await fs.readFile(metaPath, "utf-8");
    return JSON.parse(content) as SyncMetadata;
  } catch {
    return null;
  }
}
