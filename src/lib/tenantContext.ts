import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { resolveApiKey } from "@/lib/apiAuth";
import { ensureUserExists } from "@/lib/auth/ensureUserExists";
import { logAuthEvent, clientIpFromHeaders } from "@/lib/agent/audit";
import {
  isDevAuthAllowed,
  isSupabaseConfigured,
  resolveSupabaseInternalUrl,
  resolveSupabasePublicUrl,
} from "@/lib/supabase/config";
import type { TenantContext } from "@/types/auth";

/**
 * Error class for authentication failures in tenant context resolution.
 */
export class AuthenticationError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;

  constructor(
    message: string,
    statusCode = 401,
    errorCode = "UNAUTHORIZED"
  ) {
    super(message);
    this.name = "AuthenticationError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

/**
 * Extract tenant context from the request.
 *
 * Resolution priority:
 * 1. API key (Authorization: Bearer <key>) — takes precedence for AI agent requests
 * 2. Supabase Auth session (from cookie)
 * 3. Neither — throws AuthenticationError (401)
 */
export async function getTenantContext(
  request: NextRequest
): Promise<TenantContext> {
  // 1. Try API key first (takes precedence)
  const authHeader = request.headers.get("authorization");
  const hasBearerAuthHeader = Boolean(authHeader?.match(/^Bearer\s+/i));

  if (hasBearerAuthHeader && authHeader) {
    const apiKeyContext = await resolveApiKey(authHeader);
    if (apiKeyContext) {
      return apiKeyContext;
    }

    // If Authorization header is present but invalid, reject immediately
    await logAuthEvent("auth.reject", "tenantContext", {}, {
      reason: "Invalid or revoked API key",
      ip: clientIpFromHeaders(request.headers),
    });
    throw new AuthenticationError(
      "Invalid or revoked API key",
      401,
      "UNAUTHORIZED"
    );
  }

  // 2. Try Supabase session from cookies
  const supabaseUrl = resolveSupabasePublicUrl();
  const supabaseInternalUrl = resolveSupabaseInternalUrl();
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (isSupabaseConfigured() && supabaseUrl && supabaseKey) {
    const supabase = createServerClient(
      supabaseUrl,
      supabaseKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {
            // API routes don't need to set cookies (middleware handles refresh)
          },
        },
        // Route API calls through Docker-internal URL when available
        ...(supabaseInternalUrl && supabaseInternalUrl !== supabaseUrl
          ? {
              global: {
                fetch: (input: RequestInfo | URL, init?: RequestInit) => {
                  const url = input.toString().replace(supabaseUrl, supabaseInternalUrl);
                  return fetch(url, init);
                },
              },
            }
          : {}),
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      // Look up or auto-create the Prisma user record (handles cross-app SSO)
      const dbUser = await ensureUserExists(user);

      // Check for active workspace cookie override
      const activeCookie = request.cookies.get("skb_active_workspace")?.value;
      let tenantId = dbUser.tenantId;

      if (activeCookie && activeCookie !== dbUser.tenantId) {
        // Verify user has access to the requested workspace
        const { prisma: db } = await import("@/lib/db");
        const membership = await db.tenantMember.findUnique({
          where: {
            userId_tenantId: { userId: dbUser.id, tenantId: activeCookie },
          },
        });
        if (membership) {
          tenantId = activeCookie;
        }
      }

      return {
        tenantId,
        userId: dbUser.id,
        role: dbUser.role,
      };
    }
  } else {
    // Supabase is not configured (env unset or placeholder).
    //
    // FAIL CLOSED: never synthesize an ADMIN identity from a missing config.
    // In production this is always an authentication failure. The convenient
    // "default dev tenant as ADMIN" fallback is allowed only in non-production
    // AND only when explicitly opted into via ALLOW_DEV_AUTH=true.
    if (isDevAuthAllowed()) {
      const defaultTenantId =
        process.env.DEFAULT_TENANT_ID ||
        "00000000-0000-4000-a000-000000000001";
      return {
        tenantId: defaultTenantId,
        userId: "dev-user",
        role: "ADMIN",
      };
    }

    await logAuthEvent("auth.reject", "tenantContext", {}, {
      reason: "Supabase is not configured",
      ip: clientIpFromHeaders(request.headers),
    });
    throw new AuthenticationError(
      "Authentication is not configured. Supabase environment variables are missing.",
      401,
      "UNAUTHORIZED"
    );
  }

  // 3. No valid authentication found
  await logAuthEvent("auth.reject", "tenantContext", {}, {
    reason: "No session cookie or API key provided",
    ip: clientIpFromHeaders(request.headers),
  });
  throw new AuthenticationError(
    "Authentication required. Provide a valid session cookie or API key.",
    401,
    "UNAUTHORIZED"
  );
}

/**
 * Create a standardized auth error response.
 */
export function createAuthErrorResponse(
  error: AuthenticationError
): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: error.errorCode,
        message: error.message,
      },
      meta: { timestamp: new Date().toISOString() },
    },
    { status: error.statusCode }
  );
}
