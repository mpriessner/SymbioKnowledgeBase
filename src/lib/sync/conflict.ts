import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { MIRROR_ROOT, META_FILENAME } from "./config";
import { migrateMetadata } from "./types";
import type { SyncMetadata } from "./types";

/**
 * Conflict resolution strategy: last-write-wins with .conflict backup.
 *
 * When both the DB and filesystem change the same page simultaneously:
 * 1. Detect the conflict by comparing content hashes
 * 2. Save the losing version as a .conflict file
 * 3. Apply the winning (most recent) version
 * 4. Log the conflict for diagnostics
 */

export interface ConflictInfo {
  pageId: string;
  filePath: string;
  conflictFilePath: string;
  timestamp: string;
  source: "db" | "fs";
}

/** In-memory log of recent conflicts for the health endpoint */
const recentConflicts: ConflictInfo[] = [];
const MAX_CONFLICT_LOG = 100;

/** True only for a "file does not exist" error (ENOENT). */
function isFileNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "ENOENT"
  );
}

/**
 * Check if a file has been modified since the last sync
 * by comparing its current hash to the stored hash in metadata.
 */
export async function hasFileChanged(
  tenantId: string,
  pageId: string
): Promise<boolean> {
  const metaPath = path.join(MIRROR_ROOT, tenantId, META_FILENAME);
  let meta: SyncMetadata;
  try {
    const raw = await fs.readFile(metaPath, "utf-8");
    meta = JSON.parse(raw) as SyncMetadata;
  } catch (err) {
    // No metadata file yet → nothing to compare against (genuinely "unchanged").
    // Any OTHER error (corrupt JSON, permissions) must NOT be swallowed as
    // "unchanged" or we'd overwrite without a backup — assume changed.
    if (isFileNotFound(err)) return false;
    console.error(
      `[Sync Conflict] Failed to read sync metadata for tenant ${tenantId}; assuming changed:`,
      err
    );
    return true;
  }

  const entry = meta.pages[pageId];
  if (!entry) return false;

  const filePath = path.join(MIRROR_ROOT, tenantId, entry.filePath);
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const currentHash = crypto
      .createHash("md5")
      .update(content, "utf-8")
      .digest("hex");
    return currentHash !== entry.contentHash;
  } catch (err) {
    // File legitimately absent → no on-disk edit to preserve.
    if (isFileNotFound(err)) return false;
    // A real read error: treat as changed so the caller backs the file up
    // instead of clobbering it blind.
    console.error(
      `[Sync Conflict] Failed to read mirror file for page ${pageId}; assuming changed:`,
      err
    );
    return true;
  }
}

/**
 * Check if a database file has been modified since the last sync
 * by comparing its current hash to the stored hash in metadata.
 */
export async function hasDatabaseFileChanged(
  tenantId: string,
  databaseId: string
): Promise<boolean> {
  const metaPath = path.join(MIRROR_ROOT, tenantId, META_FILENAME);
  let meta: SyncMetadata;
  try {
    const raw = await fs.readFile(metaPath, "utf-8");
    meta = migrateMetadata(JSON.parse(raw) as SyncMetadata);
  } catch (err) {
    if (isFileNotFound(err)) return false;
    console.error(
      `[Sync Conflict] Failed to read sync metadata for tenant ${tenantId}; assuming changed:`,
      err
    );
    return true;
  }

  const entry = meta.databases?.[databaseId];
  if (!entry) return false;

  const filePath = path.join(MIRROR_ROOT, tenantId, entry.filePath);
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const currentHash = crypto
      .createHash("md5")
      .update(content, "utf-8")
      .digest("hex");
    return currentHash !== entry.contentHash;
  } catch (err) {
    if (isFileNotFound(err)) return false;
    console.error(
      `[Sync Conflict] Failed to read mirror file for database ${databaseId}; assuming changed:`,
      err
    );
    return true;
  }
}

/**
 * Create a .conflict backup file for the losing version.
 *
 * The conflict file is named: originalName.conflict.timestamp.md
 */
export async function createConflictBackup(
  tenantId: string,
  pageId: string,
  filePath: string,
  losingContent: string,
  source: "db" | "fs"
): Promise<ConflictInfo> {
  const absPath = path.join(MIRROR_ROOT, tenantId, filePath);
  const dir = path.dirname(absPath);
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const conflictName = `${base}.conflict.${timestamp}${ext}`;
  const conflictPath = path.join(dir, conflictName);

  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(conflictPath, losingContent, "utf-8");

  const relativeConflictPath = path.relative(
    path.join(MIRROR_ROOT, tenantId),
    conflictPath
  );

  const info: ConflictInfo = {
    pageId,
    filePath,
    conflictFilePath: relativeConflictPath,
    timestamp: new Date().toISOString(),
    source,
  };

  // Log the conflict
  recentConflicts.push(info);
  if (recentConflicts.length > MAX_CONFLICT_LOG) {
    recentConflicts.shift();
  }

  console.warn(
    `[Sync Conflict] Page ${pageId}: ${source} version saved as ${conflictName}`
  );

  return info;
}

/**
 * Get recent conflicts for the health endpoint.
 */
export function getRecentConflicts(): ConflictInfo[] {
  return [...recentConflicts];
}

/**
 * Clear conflict log (for testing).
 */
export function clearConflictLog(): void {
  recentConflicts.length = 0;
}

/**
 * List all .conflict files for a tenant.
 */
export async function listConflictFiles(
  tenantId: string
): Promise<
  Array<{
    path: string;
    size: number;
    created: string;
  }>
> {
  const tenantRoot = path.join(MIRROR_ROOT, tenantId);
  const conflicts: Array<{
    path: string;
    size: number;
    created: string;
  }> = [];

  async function walkDir(dir: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walkDir(fullPath);
      } else if (entry.name.includes(".conflict.")) {
        const stat = await fs.stat(fullPath);
        conflicts.push({
          path: path.relative(tenantRoot, fullPath),
          size: stat.size,
          created: stat.birthtime.toISOString(),
        });
      }
    }
  }

  await walkDir(tenantRoot);
  return conflicts;
}
