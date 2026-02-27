/**
 * Production environment variable validation.
 *
 * This module validates that all required environment variables are set
 * when the application starts. It runs once at import time (module
 * initialization) and throws an error if any required variable is missing.
 *
 * Import this module in the root layout or a server-side entrypoint to
 * ensure validation happens at startup.
 */

interface EnvConfig {
  DATABASE_URL: string;
  NODE_ENV: "development" | "production" | "test";
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set it in your .env file or Docker Compose environment.`
    );
  }
  return value;
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
