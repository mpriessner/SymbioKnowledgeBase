import fs from "fs/promises";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse } from "@/lib/apiResponse";
import { readSyncMetadata } from "@/lib/sync/SyncService";
import { getRecentConflicts, listConflictFiles } from "@/lib/sync/conflict";
import { MIRROR_ROOT } from "@/lib/sync/config";

/**
 * GET /api/sync/health — Sync health check endpoint.
 *
 * Returns:
 * - Mirror directory status (exists, writable)
 * - Last sync timestamp
 * - Page count
 * - Recent conflicts
 * - Conflict file count
 */
export const GET = withTenant(async (_req, ctx) => {
  const tenantId = ctx.tenantId;

  // Check mirror directory
  let mirrorExists = false;
  let mirrorWritable = false;
  try {
    await fs.access(MIRROR_ROOT);
    mirrorExists = true;
    // Check writable by attempting to access with W_OK
    await fs.access(MIRROR_ROOT, fs.constants?.W_OK ?? 2);
    mirrorWritable = true;
  } catch {
    // Directory doesn't exist or isn't writable
  }

  // Read sync metadata
  const meta = await readSyncMetadata(tenantId);
  const pageCount = meta ? Object.keys(meta.pages).length : 0;
  const lastFullSync = meta?.lastFullSync ?? null;

  // Recent conflicts
  const conflicts = getRecentConflicts();
  const tenantConflicts = conflicts.filter(
    (c) => c.filePath.length > 0 // All conflicts are tenant-scoped
  );

  // Count .conflict files on disk
  let conflictFileCount = 0;
  try {
    const conflictFiles = await listConflictFiles(tenantId);
    conflictFileCount = conflictFiles.length;
  } catch {
    // Mirror may not exist yet
  }

  // Determine overall status
  let status: "healthy" | "degraded" | "not_initialized";
  if (!meta) {
    status = "not_initialized";
  } else if (tenantConflicts.length > 0 || !mirrorWritable) {
    status = "degraded";
  } else {
    status = "healthy";
  }

  return successResponse({
    status,
    mirror: {
      root: MIRROR_ROOT,
      exists: mirrorExists,
      writable: mirrorWritable,
    },
    sync: {
      lastFullSync,
      pageCount,
    },
    conflicts: {
      recent: tenantConflicts.length,
      filesOnDisk: conflictFileCount,
      details: tenantConflicts.slice(0, 10),
    },
  });
});
