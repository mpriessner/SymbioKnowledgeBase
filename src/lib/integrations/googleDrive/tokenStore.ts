import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { loadGoogleDriveConfig } from "./config";
import { encryptToken, decryptToken, TokenDecryptError } from "./tokenCrypto";

/**
 * Encrypted persistence for `GoogleDriveConnection` rows. Every query is
 * scoped by BOTH `tenantId` and `userId` (per-query tenant isolation — SKB
 * has no global DB policy, per the repo's CLAUDE.md).
 */

export type ConnectionStatus =
  | { status: "connected"; refreshToken: string; scopes: string[]; connectedAt: Date }
  | { status: "none" }
  | { status: "invalid" }; // decrypt failure — surface as "reconnect needed"

/**
 * Upsert the encrypted refresh token for a (tenantId, userId) pair. The
 * unique constraint on (tenantId, userId) means a second concurrent connect
 * cleanly replaces the prior row rather than racing.
 */
export async function saveConnection(
  tenantId: string,
  userId: string,
  refreshToken: string,
  scopes: string[]
): Promise<void> {
  const config = loadGoogleDriveConfig();
  if (!config) {
    throw new Error("Google Drive connector is not configured");
  }

  const encryptedRefreshToken = encryptToken(refreshToken, config.tokenEncKey);

  await prisma.googleDriveConnection.upsert({
    where: { tenantId_userId: { tenantId, userId } },
    create: {
      tenantId,
      userId,
      encryptedRefreshToken,
      scopes,
    },
    update: {
      encryptedRefreshToken,
      scopes,
      revokedAt: null,
      connectedAt: new Date(),
    },
  });

  logger.info("google_drive.connection.saved", { tenantId, userId });
}

/**
 * Load and decrypt the stored connection for a user. Never throws on decrypt
 * failure — returns `{status: "invalid"}` so callers can surface the same
 * "reconnect needed" UX as an expired/revoked token rather than an unhandled
 * error reaching the document-intake UI.
 */
export async function getConnection(
  tenantId: string,
  userId: string
): Promise<ConnectionStatus> {
  const config = loadGoogleDriveConfig();
  if (!config) {
    return { status: "none" };
  }

  const row = await prisma.googleDriveConnection.findFirst({
    where: { tenantId, userId, revokedAt: null },
  });
  if (!row) {
    return { status: "none" };
  }

  try {
    const refreshToken = decryptToken(row.encryptedRefreshToken, config.tokenEncKey);
    return {
      status: "connected",
      refreshToken,
      scopes: row.scopes,
      connectedAt: row.connectedAt,
    };
  } catch (error) {
    if (error instanceof TokenDecryptError) {
      logger.warn("google_drive.connection.decrypt_failed", { tenantId, userId });
      return { status: "invalid" };
    }
    throw error;
  }
}

/**
 * Mark a connection revoked and delete the stored token server-side.
 * Previously imported documents are untouched — this only removes the
 * connector's credential, never any `Page`/`FileAttachment` row.
 */
export async function deleteConnection(
  tenantId: string,
  userId: string
): Promise<boolean> {
  const result = await prisma.googleDriveConnection.deleteMany({
    where: { tenantId, userId },
  });
  logger.info("google_drive.connection.deleted", { tenantId, userId, count: result.count });
  return result.count > 0;
}
