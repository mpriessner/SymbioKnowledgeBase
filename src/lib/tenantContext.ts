import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { resolveApiKey } from "@/lib/apiAuth";
import { ensureUserExists } from "@/lib/auth/ensureUserExists";
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
    throw new AuthenticationError(
      "Invalid or revoked API key",
      401,
      "UNAUTHORIZED"
    );
  }

  // 2. Try Supabase session from cookies
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseInternalUrl = process.env.SUPABASE_INTERNAL_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey && !supabaseUrl.includes("xxxxx") && supabaseUrl.startsWith("http")) {
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
    // Supabase not configured — use default dev tenant (local dev mode)
    const defaultTenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-4000-a000-000000000001";
    return {
      tenantId: defaultTenantId,
      userId: "dev-user",
      role: "ADMIN",
    };
  }

  // 3. No valid authentication found
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
