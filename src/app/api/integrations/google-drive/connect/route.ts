import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/withTenant";
import { errorResponse } from "@/lib/apiResponse";
import type { TenantContext } from "@/types/auth";
import { isDriveConfigured, loadGoogleDriveConfig } from "@/lib/integrations/googleDrive/config";
import { buildAuthUrl } from "@/lib/integrations/googleDrive/client";
import { createOAuthState, purgeExpiredOAuthStates } from "@/lib/integrations/googleDrive/oauthState";

/**
 * GET /api/integrations/google-drive/connect — start the OAuth consent flow
 * (a71-12 Phase 1). Session-authenticated (`withTenant`): only a logged-in
 * SKB user can initiate a connect attempt for themselves.
 *
 * Generates a one-time `state` bound to the caller's tenant/user and
 * redirects to Google's consent screen requesting exactly
 * `drive.readonly` + `drive.file` — never a broader scope.
 */
export const GET = withTenant(
  async (_req: NextRequest, ctx: TenantContext) => {
    if (!isDriveConfigured()) {
      return errorResponse(
        "NOT_CONFIGURED",
        "Google Drive integration is not configured on this server",
        undefined,
        404
      );
    }

    const config = loadGoogleDriveConfig();
    if (!config) {
      // Defensive: isDriveConfigured() and loadGoogleDriveConfig() read the
      // same env vars, so this should be unreachable, but never redirect
      // with an unconfigured client.
      return errorResponse(
        "NOT_CONFIGURED",
        "Google Drive integration is not configured on this server",
        undefined,
        404
      );
    }

    await purgeExpiredOAuthStates();
    const state = await createOAuthState({ tenantId: ctx.tenantId, userId: ctx.userId });
    const authUrl = buildAuthUrl(config, state);

    return NextResponse.redirect(authUrl);
  }
);
