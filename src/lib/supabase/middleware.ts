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
    }
  );

  // Refresh session if expired — required for Server Components
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { user, response: supabaseResponse };
}
