/**
 * Runtime environment variable validation (fail-fast).
 *
 * This module validates that the required runtime environment variables are
 * set when the application starts. It runs once at import time (module
 * initialization). In production a missing required variable throws an error
 * so the process refuses to boot in a misconfigured state; in development the
 * same conditions only warn so local work is not blocked.
 *
 * Import this module in the root layout (a server component) or another
 * server-side entrypoint so validation happens at boot.
 *
 * Why this matters: `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
 * gate Supabase auth. A missing or placeholder value silently degrades auth and
 * was the root cause of an "unauthenticated request resolves as ADMIN" finding.
 * Failing fast in production turns that silent misconfiguration into a loud,
 * boot-time error.
 */

interface EnvConfig {
  DATABASE_URL: string;
  NODE_ENV: "development" | "production" | "test";
}

const IS_PRODUCTION = process.env.NODE_ENV === "production";

/** Values that look set but are really unconfigured placeholders. */
const PLACEHOLDER_VALUES = new Set([
  "",
  "changeme",
  "change_me",
  "your-project-url",
  "your-anon-key",
  "todo",
  "xxx",
  "placeholder",
]);

function isMissingOrPlaceholder(value: string | undefined): boolean {
  if (value === undefined) return true;
  return PLACEHOLDER_VALUES.has(value.trim().toLowerCase());
}

/**
 * Assert a hard-required variable (required in every environment).
 * Throws if missing/placeholder.
 */
function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (isMissingOrPlaceholder(value)) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set it in your .env file or Docker Compose environment.`
    );
  }
  return value as string;
}

/**
 * Assert a variable that is required only in production. In production a
 * missing/placeholder value throws; outside production it only warns so local
 * dev (which may use a different auth path) is not blocked.
 */
function requireInProduction(name: string): void {
  if (!isMissingOrPlaceholder(process.env[name])) return;

  const message =
    `Missing or placeholder environment variable: ${name}. ` +
    `This variable gates authentication and MUST be set in production.`;

  if (IS_PRODUCTION) {
    throw new Error(message);
  }
  console.warn(`[env] WARNING: ${message} (allowed in non-production only)`);
}

function validateNodeEnv(
  value: string
): "development" | "production" | "test" {
  const valid = ["development", "production", "test"] as const;
  if (!valid.includes(value as (typeof valid)[number])) {
    throw new Error(
      `Invalid NODE_ENV: "${value}". Must be one of: ${valid.join(", ")}`
    );
  }
  return value as "development" | "production" | "test";
}

// ── Production-gated auth variables ──────────────────────────────────
// These gate Supabase auth. Enforced (throw) in production, warned in dev.
requireInProduction("NEXT_PUBLIC_SUPABASE_URL");
requireInProduction("NEXT_PUBLIC_SUPABASE_ANON_KEY");

// a71-09: canonical public base URL used to build QR-code share links
// (`${NEXT_PUBLIC_PUBLIC_BASE_URL}/shared/${token}`). Must be `NEXT_PUBLIC_`
// prefixed so it's readable from the client component that renders the QR
// (`QrPanel`) — a bare `PUBLIC_BASE_URL` is stripped at build time and reads
// as `undefined` in the browser. Missing/placeholder in production would mean
// every QR link resolves to a proxy-dependent or localhost host a phone
// camera can't reach, so it's fail-fast the same way as the Supabase vars.
requireInProduction("NEXT_PUBLIC_PUBLIC_BASE_URL");

/**
 * Validated environment configuration.
 *
 * Access environment variables through this object instead of
 * `process.env` to get type-safe, validated values.
 *
 * @example
 * ```typescript
 * import { env } from '@/lib/env';
 * console.log(env.DATABASE_URL); // string (guaranteed non-empty)
 * ```
 */
export const env: EnvConfig = {
  DATABASE_URL: getRequiredEnv("DATABASE_URL"),
  NODE_ENV: validateNodeEnv(process.env.NODE_ENV || "development"),
};
