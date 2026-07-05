import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { isDriveConfigured, loadGoogleDriveConfig } from "@/lib/integrations/googleDrive/config";
import { exchangeCodeForTokens, DRIVE_SCOPES } from "@/lib/integrations/googleDrive/client";
import { consumeOAuthState } from "@/lib/integrations/googleDrive/oauthState";
import { saveConnection } from "@/lib/integrations/googleDrive/tokenStore";
import { logDriveAction } from "@/lib/integrations/googleDrive/audit";

/**
 * GET /api/integrations/google-drive/callback — OAuth redirect target
 * (a71-12 Phase 1).
 *
 * Deliberately NOT wrapped in `withTenant`: Google's redirect is the only
 * caller of this route, and the CSRF-safe design binds tenant/user identity
 * to the one-time `state` value created by the `connect` route, not to the
 * request's own session. A callback with a missing/unknown/expired/already-
 * consumed `state` is rejected outright — this is the load-bearing check,
 * not a defense-in-depth extra.
 *
 * `redirect_uri` is never taken from the request — it is always the
 * server-configured, allowlisted value (`GOOGLE_DRIVE_REDIRECT_URI`), so a
 * caller cannot redirect the exchange anywhere else.
 */
export async function GET(req: NextRequest): Promise<Response> {
  if (!isDriveConfigured()) {
    return errorResponse("NOT_CONFIGURED", "Google Drive integration is not configured", undefined, 404);
  }
  const config = loadGoogleDriveConfig();
  if (!config) {
    return errorResponse("NOT_CONFIGURED", "Google Drive integration is not configured", undefined, 404);
  }

  const { searchParams } = new URL(req.url);
  const state = searchParams.get("state");
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");

  if (oauthError) {
    logger.warn("google_drive.oauth.denied", { error: oauthError });
    return errorResponse("OAUTH_DENIED", "Google Drive authorization was denied", undefined, 400);
  }

  if (!state || !code) {
    return errorResponse("VALIDATION_ERROR", "Missing 'state' or 'code'", undefined, 400);
  }

  const binding = await consumeOAuthState(state);
  if (!binding) {
    logger.warn("google_drive.oauth.state_invalid", {});
    return errorResponse(
      "UNAUTHORIZED",
      "OAuth state is missing, expired, or already used",
      undefined,
      400
    );
  }

  try {
    const tokens = await exchangeCodeForTokens(config, code);
    if (!tokens.refresh_token) {
      logger.warn("google_drive.oauth.no_refresh_token", {
        tenantId: binding.tenantId,
        userId: binding.userId,
      });
      return errorResponse(
        "OAUTH_ERROR",
        "Google did not grant a refresh token — please try connecting again",
        undefined,
        502
      );
    }

    const grantedScopes = tokens.scope ? tokens.scope.split(" ") : [...DRIVE_SCOPES];
    await saveConnection(binding.tenantId, binding.userId, tokens.refresh_token, grantedScopes);

    await logDriveAction(
      { tenantId: binding.tenantId, userId: binding.userId },
      "google_drive.connect",
      undefined,
      { scopes: grantedScopes }
    );

    return NextResponse.redirect(
      new URL("/settings/integrations/google-drive?connected=1", req.url)
    );
  } catch (error) {
    logger.error("google_drive.oauth.callback_failed", {
      tenantId: binding.tenantId,
      userId: binding.userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return errorResponse("OAUTH_ERROR", "Failed to complete Google Drive connection", undefined, 502);
  }
}
