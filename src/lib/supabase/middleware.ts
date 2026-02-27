import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Check if Supabase is configured.
 * Returns false when env vars are missing or placeholder values.
 */
function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return !!(
    url &&
    key &&
    !url.includes("xxxxx") &&
    url.startsWith("http")
  );
}

/**
 * Build a custom fetch that rewrites localhost URLs to the Docker-internal URL.
 * This is needed because the Supabase client is initialized with the browser-facing
 * URL (for cookie name matching) but server-side calls need to go through
 * host.docker.internal.
 */
function getGlobalFetchConfig() {
  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const internalUrl = process.env.SUPABASE_INTERNAL_URL;
  if (internalUrl && publicUrl && internalUrl !== publicUrl) {
    return {
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) => {
          const url = input.toString().replace(publicUrl, internalUrl);
          return fetch(url, init);
        },
      },
    };
  }
  return {};
}

export async function updateSession(request: NextRequest) {
  // Gracefully degrade when Supabase is not configured (local dev without Supabase)
  if (!isSupabaseConfigured()) {
    return {
      user: { id: "dev-user", email: "admin@symbio.local" },
      response: NextResponse.next({ request }),
    };
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
      ...getGlobalFetchConfig(),
    }
  );

  // Refresh session if expired — required for Server Components
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { user, response: supabaseResponse };
}
