import type { AgentContext } from "./auth";

/**
 * Log an agent API action for audit purposes.
 * Only logs mutations (create, update, delete).
 *
 * TODO: Add AuditLog model to Prisma schema and persist to DB.
 * For now, logs to console.
 */
export async function logAgentAction(
  ctx: AgentContext,
  action: string,
  resource: string,
  resourceId?: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    const sanitized = details ? sanitizeDetails(details) : undefined;
    console.log(
      `[AUDIT] tenant=${ctx.tenantId} user=${ctx.userId} action=${action} resource=${resource} resourceId=${resourceId ?? "N/A"}`,
      sanitized ? JSON.stringify(sanitized) : ""
    );
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
