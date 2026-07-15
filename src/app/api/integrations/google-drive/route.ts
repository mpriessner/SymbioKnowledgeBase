import { NextRequest } from "next/server";
import { withTenant } from "@/lib/auth/withTenant";
import type { TenantContext } from "@/types/auth";
import { successResponse } from "@/lib/apiResponse";
import { isDriveConfigured } from "@/lib/integrations/googleDrive/config";
import { getConnection } from "@/lib/integrations/googleDrive/tokenStore";

/** Return non-secret connector state for the signed-in user's Drive UI. */
export const GET = withTenant(async (_req: NextRequest, ctx: TenantContext) => {
  if (!isDriveConfigured()) {
    return successResponse({ configured: false, connected: false });
  }

  const connection = await getConnection(ctx.tenantId, ctx.userId);
  return successResponse({
    configured: true,
    connected: connection.status === "connected",
    reconnectNeeded: connection.status === "invalid",
    connectedAt:
      connection.status === "connected" ? connection.connectedAt.toISOString() : null,
  });
});
