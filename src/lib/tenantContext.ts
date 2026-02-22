import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { resolveApiKey } from "@/lib/apiAuth";
import { prisma } from "@/lib/db";
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
  if (authHeader) {
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
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          // API routes don't need to set cookies (middleware handles refresh)
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Look up the Prisma user record to get tenantId and role
    const dbUser = await prisma.user.findFirst({
      where: { id: user.id },
      select: { id: true, tenantId: true, role: true },
    });

    if (dbUser) {
      return {
        tenantId: dbUser.tenantId,
        userId: dbUser.id,
        role: dbUser.role,
      };
    }

    // User exists in Supabase but not in Prisma — cross-app SSO case
    // The ensureUserExists middleware will handle this
    throw new AuthenticationError(
      "User not provisioned in this application. Please register first.",
      403,
      "FORBIDDEN"
    );
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
