import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import type { TenantContext } from "@/types/auth";

/**
 * Hash an API key using SHA-256.
 * The raw key is never stored — only this hash is persisted in the database.
 */
export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

/**
 * Resolve an API key from the Authorization header to a TenantContext.
 *
 * Extracts the Bearer token, hashes it with SHA-256, and looks up
 * the hash in the api_keys table. Returns the associated tenant context
 * or null if the key is invalid, revoked, or not found.
 */
export async function resolveApiKey(
  authHeader: string | null
): Promise<TenantContext | null> {
  if (!authHeader) {
    return null;
  }

  // Extract Bearer token
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return null;
  }

  const rawKey = match[1];
  const keyHash = hashApiKey(rawKey);

  // Look up the hashed key in the database
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      keyHash,
      revokedAt: null, // Only accept non-revoked keys
    },
    include: {
      user: {
        select: {
          id: true,
          tenantId: true,
          role: true,
        },
      },
    },
  });

  if (!apiKey || !apiKey.user) {
    return null;
  }

  return {
    tenantId: apiKey.user.tenantId,
    userId: apiKey.user.id,
    role: apiKey.user.role,
  };
}
