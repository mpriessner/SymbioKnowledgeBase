import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { fullSync, readSyncMetadata } from "@/lib/sync/SyncService";

/**
 * GET /api/sync — Get sync status for the current tenant.
 */
export const GET = withTenant(async (_req, ctx) => {
  const meta = await readSyncMetadata(ctx.tenantId);

  if (!meta) {
    return successResponse({
      status: "not_initialized",
      message: "Mirror has not been synced yet. POST /api/sync to initialize.",
    });
  }

  return successResponse({
    status: "active",
    tenantId: meta.tenantId,
    lastFullSync: meta.lastFullSync,
    pageCount: Object.keys(meta.pages).length,
  });
});

/**
 * POST /api/sync — Trigger a full sync from DB → filesystem.
 */
export const POST = withTenant(async (_req, ctx) => {
  try {
    const count = await fullSync(ctx.tenantId);
    return successResponse({
      status: "completed",
      pagesSynced: count,
    });
  } catch (error) {
    console.error("Full sync error:", error);
    return errorResponse(
      "INTERNAL_ERROR",
      "Sync failed: " + (error instanceof Error ? error.message : "Unknown error"),
      undefined,
      500
    );
  }
});
