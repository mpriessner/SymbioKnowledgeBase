import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

/** Minimal identity needed to audit-log a Drive action — deliberately not the
 * full `TenantContext`/`AgentContext` shape, since the OAuth callback route
 * resolves tenant/user from the consumed OAuth state rather than a session. */
export interface DriveAuditIdentity {
  tenantId: string;
  userId: string;
}

/**
 * Audit logging for Drive-connector mutations (connect/disconnect/import/
 * upload), mirroring `src/lib/agent/audit.ts`'s shape (structured log line +
 * `AuditLog` row, fire-and-forget persistence) but for session-authenticated
 * (`withTenant`) routes rather than agent-key routes. Never logs the refresh
 * token, access token, or authorization header — only ids/booleans/counts.
 */
export async function logDriveAction(
  ctx: DriveAuditIdentity,
  action: string,
  resourceId?: string,
  details?: Record<string, unknown>
): Promise<void> {
  logger.info("google_drive.audit", {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action,
    resourceId: resourceId ?? null,
    details,
  });

  try {
    await prisma.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action,
        resource: "google_drive",
        resourceId: resourceId ?? null,
        details: (details ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (error) {
    logger.error("google_drive.audit.persist_failed", {
      action,
      resourceId: resourceId ?? null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
