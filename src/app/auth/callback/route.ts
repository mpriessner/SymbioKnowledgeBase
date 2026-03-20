import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
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
  // Fallback: use request origin but fix 0.0.0.0 -> localhost
  const { origin } = new URL(request.url);
  return origin.replace("0.0.0.0", "localhost");
}

/**
 * Find or create a local Supabase user matching a cloud-authenticated user.
 * Uses the service role key (server-side only).
 */
async function mapCloudUserToLocal(cloudUser: {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}) {
  const localAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const email = cloudUser.email;
  if (!email) {
    throw new Error("Cloud user has no email address");
  }

  // Find existing local user by email
  const { data: userList } = await localAdmin.auth.admin.listUsers();
  const existing = userList?.users?.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (existing) {
    console.log("[CloudAuth] Found existing local user:", email);
    return { user: existing, localAdmin };
  }

  // Create new local user
  const { data: created, error: createErr } =
    await localAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        full_name:
          cloudUser.user_metadata?.full_name ||
          cloudUser.user_metadata?.name ||
          null,
        avatar_url: cloudUser.user_metadata?.avatar_url || null,
        cloud_user_id: cloudUser.id,
        provider: "google",
      },
    });

  if (createErr) {
    // Handle race condition: user created between check and create
    if (createErr.message?.includes("already been registered")) {
      const { data: retryUsers } = await localAdmin.auth.admin.listUsers();
      const retryUser = retryUsers?.users?.find(
        (u) => u.email?.toLowerCase() === email.toLowerCase()
      );
      if (retryUser) return { user: retryUser, localAdmin };
    }
    throw new Error(`Failed to create local user: ${createErr.message}`);
  }

  console.log("[CloudAuth] Created new local user:", email);
  return { user: created.user, localAdmin };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/home";
  const origin = getExternalOrigin(request);

  if (code) {
    const cookieStore = await cookies();

    const cloudUrl = process.env.NEXT_PUBLIC_SUPABASE_CLOUD_URL;
    const cloudKey = process.env.NEXT_PUBLIC_SUPABASE_CLOUD_ANON_KEY;
    const isCloudAuth = !!(cloudUrl && cloudKey);

    if (isCloudAuth) {
      // === CLOUD AUTH FLOW ===
      // Step 1: Exchange code with CLOUD Supabase
      console.log("[Callback] Using cloud auth flow");

      const cloudSupabase = createServerClient(cloudUrl!, cloudKey!, {
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
      });

      const { data: cloudData, error: cloudError } =
        await cloudSupabase.auth.exchangeCodeForSession(code);

      if (cloudError || !cloudData.user) {
        console.error("Cloud OAuth exchange failed:", cloudError?.message);
        return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
      }

      const cloudUser = cloudData.user;
      console.log("[Callback] Cloud user:", cloudUser.email);

      // Step 2: Map cloud user to local user
      try {
        const { user: localUser, localAdmin } =
          await mapCloudUserToLocal(cloudUser);

        // Step 3: Generate magic link to establish local session
        const { data: linkData, error: linkError } =
          await localAdmin.auth.admin.generateLink({
            type: "magiclink",
            email: localUser.email!,
            options: { redirectTo: `${origin}${next}` },
          });

        if (linkError || !linkData) {
          console.error("Failed to generate local session:", linkError?.message);
          return NextResponse.redirect(`${origin}/login?error=session_failed`);
        }

        // Step 4: Verify OTP to set local session cookies
        const localPublicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const localAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const internalUrl = process.env.SUPABASE_INTERNAL_URL;

        const localSupabase = createServerClient(localPublicUrl, localAnonKey, {
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
          ...(internalUrl && internalUrl !== localPublicUrl
            ? {
                global: {
                  fetch: (input: RequestInfo | URL, init?: RequestInit) => {
                    const url = input
                      .toString()
                      .replace(localPublicUrl, internalUrl);
                    return fetch(url, init);
                  },
                },
              }
            : {}),
        });

        const tokenHash = linkData.properties?.hashed_token;
        if (tokenHash) {
          const { error: verifyErr } = await localSupabase.auth.verifyOtp({
            type: "email",
            token_hash: tokenHash,
          });
          if (verifyErr) {
            console.error("Local OTP verify failed:", verifyErr.message);
            return NextResponse.redirect(
              `${origin}/login?error=session_failed`
            );
          }
        }

        // Step 5: Ensure Prisma records exist
        await ensureUserExists(localUser);

        console.log("[Callback] Cloud auth complete, redirecting to:", next);
        return NextResponse.redirect(`${origin}${next}`);
      } catch (err) {
        console.error("[Callback] Cloud-to-local mapping failed:", err);
        return NextResponse.redirect(
          `${origin}/login?error=user_creation_failed`
        );
      }
    }

    // === LOCAL AUTH FLOW (fallback when cloud not configured) ===
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
