import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import type { TenantContext } from "@/types/auth";
import { logAuthEvent } from "@/lib/agent/audit";

const API_KEY_PREFIX = "skb_live_";

// Length of the stored, non-secret key prefix used to scope bcrypt lookups.
// Matches the prefix length persisted when keys are minted (e.g. "skb_live_xxxxxx").
const KEY_PREFIX_LENGTH = 15;

/**
 * Tenant context for an API-key-authenticated request.
 *
 * Extends {@link TenantContext} with the resolved API key id and the key's
 * scopes so callers can enforce least-privilege. Structurally assignable to
 * TenantContext, so existing consumers that only read tenantId/userId/role are
 * unaffected.
 */
export interface ApiKeyContext extends TenantContext {
  apiKeyId: string;
  scopes: string[];
}

/**
 * Normalize the scopes stored on an API key.
 *
 * Backward-compat: keys created before the scopes column was populated may have
 * an empty array. An empty array is treated as full access (["read", "write"])
 * so legacy keys keep working; new keys carry their explicit scopes.
 */
function normalizeScopes(scopes: string[] | null | undefined): string[] {
  if (!scopes || scopes.length === 0) {
    return ["read", "write"];
  }
  return scopes;
}

/**
 * Hash an API key using SHA-256.
 * The raw key is never stored — only this hash is persisted in the database.
 */
export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

/**
 * Generate a new cryptographically random API key.
 *
 * Format: skb_live_<64 hex characters>
 * The raw key is returned for one-time display to the user.
 * Only the SHA-256 hash should be stored in the database.
 *
 * @returns { rawKey, keyHash } — rawKey for user display, keyHash for storage
 */
export function generateApiKey(): { rawKey: string; keyHash: string } {
  const randomPart = randomBytes(32).toString("hex"); // 64 hex chars
  const rawKey = `${API_KEY_PREFIX}${randomPart}`;
  const keyHash = hashApiKey(rawKey);

  return { rawKey, keyHash };
}

/**
 * Resolve an API key from the Authorization header to an {@link ApiKeyContext}.
 *
 * This is the single canonical API-key verifier for the app (used by both
 * getTenantContext and the agent auth wrapper). It accepts both key hashing
 * schemes that exist in the wild:
 *   1. SHA-256 — fast O(1) exact-hash lookup (keys minted via /api/keys).
 *   2. bcrypt — prefix-scoped scan + bcrypt.compare (keys minted via
 *      /api/settings/api-keys), because bcrypt hashes are not reproducible.
 *
 * Returns the resolved context (including the key id and its real scopes) or
 * null if the key is missing, malformed, revoked, or not found.
 */
export async function resolveApiKey(
  authHeader: string | null
): Promise<ApiKeyContext | null> {
  const rawKey = extractBearerToken(authHeader);
  if (!rawKey) {
    return null;
  }

  // 1. SHA-256 exact-hash lookup (fast path).
  const keyHash = hashApiKey(rawKey);
  const sha256Match = await prisma.apiKey.findFirst({
    where: {
      keyHash,
      revokedAt: null, // Only accept non-revoked keys
    },
    include: {
      user: {
        select: { id: true, tenantId: true, role: true },
      },
    },
  });

  if (sha256Match?.user) {
    touchLastUsed(sha256Match.id, {
      tenantId: sha256Match.user.tenantId,
      userId: sha256Match.user.id,
    });
    return {
      tenantId: sha256Match.user.tenantId,
      userId: sha256Match.user.id,
      role: sha256Match.user.role,
      apiKeyId: sha256Match.id,
      scopes: normalizeScopes(sha256Match.scopes),
    };
  }

  // 2. bcrypt fallback — scope candidates by the stored (non-secret) prefix,
  //    then verify with bcrypt.compare.
  const keyPrefix = rawKey.substring(0, KEY_PREFIX_LENGTH);
  const candidates = await prisma.apiKey.findMany({
    where: { keyPrefix, revokedAt: null },
    include: {
      user: {
        select: { id: true, tenantId: true, role: true },
      },
    },
  });

  for (const candidate of candidates) {
    if (!candidate.user) {
      continue;
    }
    const matches = await bcrypt.compare(rawKey, candidate.keyHash);
    if (matches) {
      touchLastUsed(candidate.id, {
        tenantId: candidate.user.tenantId,
        userId: candidate.user.id,
      });
      return {
        tenantId: candidate.user.tenantId,
        userId: candidate.user.id,
        role: candidate.user.role,
        apiKeyId: candidate.id,
        scopes: normalizeScopes(candidate.scopes),
      };
    }
  }

  return null;
}

/**
 * Extract the raw Bearer token from an Authorization header, or null if the
 * header is missing or not a well-formed Bearer header.
 */
function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

/**
 * Update an API key's last-used timestamp (fire-and-forget). A failure here
 * must never fail the request that's authenticating, but it must not be
 * silently swallowed either — route it through the structured audit logger
 * (audit S15) so key-usage failures on this hot path are queryable.
 */
function touchLastUsed(
  apiKeyId: string,
  principal: { tenantId: string; userId: string }
): void {
  prisma.apiKey
    .update({
      where: { id: apiKeyId },
      data: { lastUsedAt: new Date() },
    })
    .catch((err: unknown) => {
      logAuthEvent(
        "key.last_used_update_failed",
        "apiKey.lastUsedAt",
        { apiKeyId, tenantId: principal.tenantId, userId: principal.userId },
        { reason: err instanceof Error ? err.message : String(err) }
      );
    });
}
