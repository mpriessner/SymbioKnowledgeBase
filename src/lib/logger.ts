/**
 * Tiny structured logger.
 *
 * Level-aware via the `LOG_LEVEL` env var (one of: debug, info, warn, error;
 * default "info"). Emits a single JSON object per line so logs are
 * machine-parseable in production (and grep-able in dev). No external
 * dependency — this is a thin wrapper over `console`.
 *
 * @example
 * ```typescript
 * import { logger } from "@/lib/logger";
 * logger.info("page.created", { pageId, tenantId });
 * logger.error("audit.persist_failed", { error: String(err) });
 * ```
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function resolveThreshold(): number {
  const raw = (process.env.LOG_LEVEL || "info").trim().toLowerCase();
  if (raw in LEVEL_PRIORITY) {
    return LEVEL_PRIORITY[raw as LogLevel];
  }
  return LEVEL_PRIORITY.info;
}

// Resolved once at module load. LOG_LEVEL is read at startup like other config.
const threshold = resolveThreshold();

function emit(
  level: LogLevel,
  message: string,
  fields?: Record<string, unknown>
): void {
  if (LEVEL_PRIORITY[level] < threshold) return;

  const entry = {
    level,
    timestamp: new Date().toISOString(),
    message,
    ...fields,
  };

  const line = JSON.stringify(entry);

  // Route to the matching console method so stderr/stdout semantics are kept.
  switch (level) {
    case "error":
      console.error(line);
      break;
    case "warn":
      console.warn(line);
      break;
    case "debug":
      console.debug(line);
      break;
    default:
      console.log(line);
  }
}

export const logger = {
  debug: (message: string, fields?: Record<string, unknown>) =>
    emit("debug", message, fields),
  info: (message: string, fields?: Record<string, unknown>) =>
    emit("info", message, fields),
  warn: (message: string, fields?: Record<string, unknown>) =>
    emit("warn", message, fields),
  error: (message: string, fields?: Record<string, unknown>) =>
    emit("error", message, fields),
};

export type Logger = typeof logger;
