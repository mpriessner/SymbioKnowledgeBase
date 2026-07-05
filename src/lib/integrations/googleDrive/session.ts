import { loadGoogleDriveConfig } from "./config";
import { getConnection } from "./tokenStore";
import { refreshAccessToken, DriveAuthError } from "./client";

/**
 * Resolve a short-lived access token for a connected user. Wraps the
 * "not configured" / "no connection" / "decrypt failed" / "refresh failed"
 * cases into a single discriminated result so route handlers can render a
 * consistent "reconnect needed" response instead of throwing.
 */
export type DriveSessionResult =
  | { ok: true; accessToken: string }
  | { ok: false; reason: "not_configured" | "not_connected" | "reconnect_needed" };

export async function getDriveAccessToken(
  tenantId: string,
  userId: string
): Promise<DriveSessionResult> {
  const config = loadGoogleDriveConfig();
  if (!config) {
    return { ok: false, reason: "not_configured" };
  }

  const connection = await getConnection(tenantId, userId);
  if (connection.status === "none") {
    return { ok: false, reason: "not_connected" };
  }
  if (connection.status === "invalid") {
    return { ok: false, reason: "reconnect_needed" };
  }

  try {
    const { accessToken } = await refreshAccessToken(config, connection.refreshToken);
    return { ok: true, accessToken };
  } catch (error) {
    if (error instanceof DriveAuthError) {
      return { ok: false, reason: "reconnect_needed" };
    }
    throw error;
  }
}
