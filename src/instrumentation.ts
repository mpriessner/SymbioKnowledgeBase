/**
 * Next.js instrumentation hook — runs once at SERVER BOOT (not during `next build`).
 *
 * This is the runtime-only entrypoint for environment validation. `register()`
 * executes when the Node.js server process starts, NOT during the build's static
 * generation pass — so importing `@/lib/env` (which requires DATABASE_URL) here
 * does not crash `next build` in Docker, where DATABASE_URL is absent at build
 * time (audit-01 Codex MUST-FIX 3).
 */
export async function register() {
  // Only run in the Node.js server runtime (skip edge + the build pass).
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Importing this module runs DATABASE_URL validation at import time.
  await import("@/lib/env");

  // In production, hard-fail if Supabase is unconfigured rather than silently
  // granting the dev/ADMIN fallback (audit S2). No-op in dev/test and during build.
  const { assertSupabaseConfiguredInProd } = await import("@/lib/supabase/config");
  assertSupabaseConfiguredInProd();
}
