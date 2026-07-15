import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, isDevAuthAllowed } from "@/lib/supabase/config";

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
  // Gracefully degrade ONLY in non-production with an explicit opt-in
  // (ALLOW_DEV_AUTH=1). Missing/placeholder Supabase config no longer grants a
  // synthetic dev-user by default — in production this would have silently
  // opened the whole instance (audit S2).
  if (!isSupabaseConfigured()) {
    if (isDevAuthAllowed()) {
      return {
        user: { id: "dev-user", email: "admin@symbio.local" },
        response: NextResponse.next({ request }),
      };
    }
    // Fallback OFF: treat as unauthenticated (no synthetic user).
    return { user: null, response: NextResponse.next({ request }) };
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
  // Use a timeout to prevent hanging when Supabase is unreachable
  // (e.g. SUPABASE_INTERNAL_URL points to Docker-internal address while running on host)
  try {
    const getUserWithTimeout = Promise.race([
      supabase.auth.getUser(),
      new Promise<{ data: { user: null } }>((resolve) =>
        setTimeout(() => resolve({ data: { user: null } }), 5000)
      ),
    ]);

    const {
      data: { user },
    } = await getUserWithTimeout;

    return { user, response: supabaseResponse };
  } catch {
    // Auth check failed — treat as unauthenticated
    return { user: null, response: supabaseResponse };
  }
}
