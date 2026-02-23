import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key || url.includes("xxxxx")) {
    // Return null when Supabase is not configured (local dev without Supabase)
    return null;
  }

  // NEXT_PUBLIC_COOKIE_DOMAIN enables cross-subdomain SSO (e.g. ".symbio.com")
  const cookieDomain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN;

  return createBrowserClient(
    url,
    key,
    cookieDomain
      ? {
          cookieOptions: {
            domain: cookieDomain,
          },
        }
      : undefined
  );
}
