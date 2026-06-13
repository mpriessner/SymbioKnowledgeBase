import type { AgentContext } from "./auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";

/**
 * Structured audit logging for agent actions + auth outcomes (audit S15).
 *
 * Persists to the AuditLog table (schema-ready) in addition to a console line.
 * A failed write must NOT fail the request, so every persist is wrapped in a
 * swallow. AuditLog.userId/tenantId are nullable (see the migration), so an
 * anonymous auth rejection persists with a NULL principal instead of silently
 * FK-violating.
 */

interface AuditPrincipal {
  tenantId?: string | null;
  userId?: string | null;
  apiKeyId?: string | null;
}

async function persistAuditRow(
  principal: AuditPrincipal,
  action: string,
  resource: string,
  resourceId?: string | null,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    const sanitized = details ? sanitizeDetails(details) : undefined;
    await prisma.auditLog.create({
      data: {
        tenantId: principal.tenantId ?? null,
        userId: principal.userId ?? null,
        apiKeyId: principal.apiKeyId ?? null,
        action,
        resource,
        resourceId: resourceId ?? null,
        details: sanitized
          ? (sanitized as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });
  } catch (error) {
    // Never fail the request because audit persistence failed.
    console.error("Audit log persist error:", error);
  }
}

/**
 * Log an agent API action (typically a mutation) for audit purposes.
 *
 * Persists synchronously by default (await it after a mutation succeeds). For
 * latency-sensitive read SUCCESS auditing on the hot kb-query path, call without
 * awaiting — the internal swallow means the floating promise never rejects.
 */
export async function logAgentAction(
  ctx: AgentContext,
  action: string,
  resource: string,
  resourceId?: string,
  details?: Record<string, unknown>
): Promise<void> {
  console.log(
    `[AUDIT] tenant=${ctx.tenantId} user=${ctx.userId} action=${action} resource=${resource} resourceId=${resourceId ?? "N/A"}`
  );
  await persistAuditRow(
    { tenantId: ctx.tenantId, userId: ctx.userId, apiKeyId: ctx.apiKeyId },
    action,
    resource,
    resourceId,
    details
  );
}

/**
 * Log an authentication outcome (success / 401 / 403) — including ANONYMOUS
 * rejections where no AgentContext exists yet (audit S15). The principal fields
 * are all optional; an anonymous rejection persists with NULL principal.
 */
export async function logAuthEvent(
  action: "auth.success" | "auth.reject" | string,
  resource: string,
  principal: AuditPrincipal = {},
  details?: Record<string, unknown>
): Promise<void> {
  console.log(
    `[AUDIT] action=${action} resource=${resource} tenant=${principal.tenantId ?? "anon"} user=${principal.userId ?? "anon"}`
  );
  await persistAuditRow(principal, action, resource, undefined, details);
}

/**
 * Best-effort client IP from forwarding headers (left-most XFF hop).
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
