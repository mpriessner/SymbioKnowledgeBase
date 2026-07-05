import type { AgentContext } from "./auth";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * Log an agent API action for audit purposes.
 * Only logs mutations (create, update, delete).
 *
 * Emits a structured log line AND persists to the `AuditLog` table. Persistence
 * is fire-and-forget: a DB failure is logged but never propagated, so auditing
 * can never break the request it is auditing. Sensitive fields in `details` are
 * redacted via `sanitizeDetails` before either sink.
 */
export async function logAgentAction(
  ctx: AgentContext,
  action: string,
  resource: string,
  resourceId?: string,
  details?: Record<string, unknown>
): Promise<void> {
  const sanitized = details ? sanitizeDetails(details) : undefined;

  logger.info("agent.audit", {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    apiKeyId: ctx.apiKeyId,
    action,
    resource,
    resourceId: resourceId ?? null,
    details: sanitized,
  });

  // Persist to the audit log. Fire-and-forget: never let an audit write failure
  // surface to the caller or reject the request.
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        apiKeyId: ctx.apiKeyId ?? null,
        action,
        resource,
        resourceId: resourceId ?? null,
        // `sanitized` is a JSON-serializable record; cast to satisfy Prisma's
        // InputJsonValue type (Record<string, unknown> is structurally wider).
        details: (sanitized ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
      },
    });
  } catch (error) {
    logger.error("agent.audit.persist_failed", {
      action,
      resource,
      resourceId: resourceId ?? null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

interface AuditPrincipal {
  tenantId?: string | null;
  userId?: string | null;
  apiKeyId?: string | null;
}

/**
 * Log an authentication outcome (success / reject) — including ANONYMOUS
 * rejections where no AgentContext exists yet (e.g. a 401 before any principal
 * is known). All principal fields are optional; an anonymous rejection
 * persists with a NULL principal instead of being dropped, since AuditLog's
 * tenantId/userId columns are nullable for exactly this case.
 */
export async function logAuthEvent(
  action: string,
  resource: string,
  principal: AuditPrincipal = {},
  details?: Record<string, unknown>
): Promise<void> {
  const sanitized = details ? sanitizeDetails(details) : undefined;

  logger.info("agent.audit.auth", {
    tenantId: principal.tenantId ?? null,
    userId: principal.userId ?? null,
    apiKeyId: principal.apiKeyId ?? null,
    action,
    resource,
    details: sanitized,
  });

  // Persist to the audit log. Fire-and-forget: never let an audit write failure
  // surface to the caller or reject the request.
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: principal.tenantId ?? null,
        userId: principal.userId ?? null,
        apiKeyId: principal.apiKeyId ?? null,
        action,
        resource,
        resourceId: null,
        details: (sanitized ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
      },
    });
  } catch (error) {
    logger.error("agent.audit.persist_failed", {
      action,
      resource,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Best-effort client IP from forwarding headers (left-most XFF hop, falling
 * back to x-real-ip). Used to enrich auth-event details; not authoritative
 * (headers are client-supplied and only trustworthy behind a controlled proxy).
 */
export function clientIpFromHeaders(headers: Headers): string | undefined {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim();
  return headers.get("x-real-ip") ?? undefined;
}

/**
 * Redact sensitive fields from audit log details.
 */
function sanitizeDetails(
  details: Record<string, unknown>
): Record<string, unknown> {
  const sanitized = { ...details };
  const sensitiveFields = [
    "password",
    "token",
    "secret",
    "key",
    "api_key",
    "authorization",
  ];

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = "[REDACTED]";
    }
  }

  return sanitized;
}
