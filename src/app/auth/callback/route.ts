import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { ensureUserExists } from "@/lib/auth/ensureUserExists";

/**
 * Resolve the browser-facing origin for redirects.
 * Inside Docker, request.url may resolve to http://0.0.0.0:3000 which is not
 * reachable from the browser. Use NEXTAUTH_URL or X-Forwarded-Host header instead.
 */
function getExternalOrigin(request: NextRequest): string {
  // Prefer explicit config
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL.replace(/\/$/, "");
  }
  // Use forwarded host header if behind a proxy
  const forwardedHost = request.headers.get("x-forwarded-host");
  const proto = request.headers.get("x-forwarded-proto") || "http";
  if (forwardedHost) {
    return `${proto}://${forwardedHost}`;
  }
  // Fallback: use request origin but fix 0.0.0.0 → localhost
  const { origin } = new URL(request.url);
  return origin.replace("0.0.0.0", "localhost");
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/home";
  const origin = getExternalOrigin(request);

  if (code) {
    const cookieStore = await cookies();
    // Use NEXT_PUBLIC_SUPABASE_URL (localhost:54321) so the PKCE code verifier
    // cookie name matches what the browser-side client stored.
    // Override fetch to route API calls through SUPABASE_INTERNAL_URL
    // (host.docker.internal:54321) which is reachable from inside Docker.
    const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const internalUrl = process.env.SUPABASE_INTERNAL_URL;

    const supabase = createServerClient(
      publicUrl,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
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

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("OAuth code exchange failed:", error.message);
    }

    if (!error && data.user) {
      await ensureUserExists(data.user);
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
}
