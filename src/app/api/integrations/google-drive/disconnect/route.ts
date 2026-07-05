import { NextRequest } from "next/server";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import type { TenantContext } from "@/types/auth";
import { getConnection, deleteConnection } from "@/lib/integrations/googleDrive/tokenStore";
import { revokeToken } from "@/lib/integrations/googleDrive/client";
import { logDriveAction } from "@/lib/integrations/googleDrive/audit";
import { logger } from "@/lib/logger";

/**
 * POST /api/integrations/google-drive/disconnect — revoke and delete the
 * caller's stored Drive connection (a71-12 Phase 1 AC4).
 *
 * Revocation with Google is best-effort: even if Google's revoke endpoint
 * fails or is unreachable, the encrypted token row is still deleted
 * server-side, so SKB stops being able to use it either way. Previously
 * imported documents are untouched — this only removes the credential.
 */
export const POST = withTenant(async (_req: NextRequest, ctx: TenantContext) => {
  const connection = await getConnection(ctx.tenantId, ctx.userId);

  if (connection.status === "none") {
    return errorResponse("NOT_FOUND", "No Google Drive connection to disconnect", undefined, 404);
  }

  if (connection.status === "connected") {
    try {
      await revokeToken(connection.refreshToken);
    } catch (error) {
      logger.warn("google_drive.revoke_failed", {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Non-fatal — proceed to delete the stored row regardless.
    }
  }

  await deleteConnection(ctx.tenantId, ctx.userId);
  await logDriveAction(ctx, "google_drive.disconnect");

  return successResponse({ disconnected: true });
});
