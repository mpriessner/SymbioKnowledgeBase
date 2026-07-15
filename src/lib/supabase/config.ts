/**
 * Shared Supabase configuration guards.
 *
 * Centralizes the "is Supabase usable" check that was previously duplicated in
 * `src/lib/supabase/middleware.ts` and inlined in `src/lib/tenantContext.ts`.
 */

const PLACEHOLDER_URL_MARKER = "xxxxx";

/**
 * Whether the Supabase env is present and non-placeholder.
 *
 * Checks BOTH the URL and the anon key content — a valid URL paired with a
 * placeholder anon key (e.g. "eyJ...") would otherwise be treated as
 * "configured" and then fail per-request instead of taking the explicit
 * dev/prod branch (audit S2 / Codex nice-to-have #9).
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return (
    !!url &&
    !!key &&
    !url.includes(PLACEHOLDER_URL_MARKER) &&
    url.startsWith("http") &&
    !key.includes(PLACEHOLDER_URL_MARKER)
  );
}

/**
 * Whether the gated dev/local auth fallback is allowed to activate.
 *
 * Only true when NOT in production AND the operator has explicitly opted in via
 * `ALLOW_DEV_AUTH=1`. This is what lets local dev / tests run without a real
 * Supabase stack — but it can never fire in production (audit S2).
 */
export function isDevAuthAllowed(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.ALLOW_DEV_AUTH === "1"
  );
}

/**
 * In production, fail fast if Supabase is unconfigured — rather than silently
 * granting ADMIN/dev-user access (audit S2).
 *
 * Guarded so it does NOT throw during the Next.js production *build* (static
 * generation runs with NODE_ENV=production but without runtime Supabase env);
 * it only throws at actual server runtime. See `instrumentation.ts`.
 */
export function assertSupabaseConfiguredInProd(): void {
  if (process.env.NODE_ENV !== "production") return;
  // Skip during `next build` static analysis (no runtime env yet).
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured in production. Set non-placeholder " +
        "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Refusing to start with the insecure dev/ADMIN fallback enabled."
    );
  }
}
