import { prisma } from "@/lib/db";
import type { AgentContext } from "./auth";

/**
 * Log an agent API action for audit purposes.
 * Only logs mutations (create, update, delete).
 */
export async function logAgentAction(
  ctx: AgentContext,
  action: string,
  resource: string,
  resourceId?: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        apiKeyId: ctx.apiKeyId ?? null,
        action,
        resource,
        resourceId: resourceId ?? null,
        details: details ? sanitizeDetails(details) : null,
      },
    });
  } catch (error) {
    // Don't fail the request if audit logging fails
    console.error("Audit log error:", error);
  }
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
