import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { ensureUserExists } from "@/lib/auth/ensureUserExists";
import { logAuthEvent } from "@/lib/agent/audit";
import {
  resolveSupabaseInternalUrl,
  resolveSupabasePublicUrl,
} from "@/lib/supabase/config";

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
  // Fallback: use request origin but fix 0.0.0.0 -> localhost
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
    const publicUrl = resolveSupabasePublicUrl();
    const internalUrl = resolveSupabaseInternalUrl();

    if (!publicUrl) {
      return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
    }

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
      // Structured, queryable audit row for the OAuth-exchange failure (no
      // AgentContext here, so an anonymous principal — audit S15).
      await logAuthEvent("oauth.exchange_failed", "auth/callback", {}, {
        reason: error.message,
      });
    }

    if (!error && data.user) {
      const dbUser = await ensureUserExists(data.user);
      // Structured, queryable audit row for the OAuth success (fire-and-forget,
      // mirroring the auth.success pattern in withAgentAuth — never adds
      // latency to the redirect).
      void logAuthEvent("oauth.success", "auth/callback", {
        userId: dbUser.id,
        tenantId: dbUser.tenantId,
      });
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
}
