import { createBrowserClient } from "@supabase/ssr";

/**
 * Cloud Supabase client — used ONLY for Google OAuth sign-in.
 * All data operations must use the local client from ./client.ts
 *
 * The cloud Supabase project (xysiyvrwvhngtwccouqy.supabase.co) has a public URL
 * that works from both localhost and remote devices (Tailscale), solving the
 * Google OAuth redirect problem with local Supabase.
 */
export function createCloudClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_CLOUD_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_CLOUD_ANON_KEY;

  if (!url || !key) {
    // Cloud auth not configured — fall back to local auth
    return null;
  }

  // isSingleton: false is required because createBrowserClient uses a global
  // singleton by default. Without this, it returns the cached LOCAL client
  // (created first by client.ts) instead of creating a new cloud client.
  return createBrowserClient(url, key, { isSingleton: false });
}
