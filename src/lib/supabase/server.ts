import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const internalUrl = process.env.SUPABASE_INTERNAL_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!publicUrl || !key || publicUrl.includes("xxxxx")) {
    // Return null when Supabase is not configured (local dev without Supabase)
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(
    publicUrl,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method is called from a Server Component.
            // This can be ignored if middleware refreshes sessions.
          }
        },
      },
      // Route API calls through Docker-internal URL when available
      ...(internalUrl && internalUrl !== publicUrl
        ? {
            global: {
              fetch: (input: RequestInfo | URL, init?: RequestInit) => {
                const url = input.toString().replace(publicUrl, internalUrl);
                return fetch(url, init);
              },
            },
          }
        : {}),
    }
  );
}
