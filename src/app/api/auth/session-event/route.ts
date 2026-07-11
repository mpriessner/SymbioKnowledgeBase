import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { logAuthEvent, clientIpFromHeaders } from "@/lib/agent/audit";

/**
 * Thin audit endpoint for session-lifecycle events (login/logout).
 *
 * Login and logout are performed entirely client-side against Supabase
 * (`@/lib/supabase/client`), so there is no server round-trip to hang a
 * `logAuthEvent` call off. The client calls this route immediately after a
 * successful sign-in, and immediately BEFORE sign-out (while the session
 * cookie is still valid), so the server can independently resolve the caller
 * from the session cookie rather than trusting a client-supplied identity.
 *
 * Fire-and-forget on the client side is fine here — a failure to record a
 * login/logout event must never block the user's session flow.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const event = body?.event;

  if (event !== "login" && event !== "logout") {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "event must be 'login' or 'logout'" } },
      { status: 400 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey && !supabaseUrl.includes("xxxxx") && supabaseUrl.startsWith("http")) {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          // No-op: this endpoint only reads the existing session.
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await logAuthEvent(
        event === "login" ? "auth.login" : "auth.logout",
        "auth/session",
        { userId: user.id },
        { ip: clientIpFromHeaders(request.headers) }
      );
    }
  }

  return NextResponse.json({ data: { ok: true } });
}
