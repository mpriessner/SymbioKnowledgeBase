import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { resolveApiKey } from "@/lib/apiAuth";
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
 * 2. NextAuth.js JWT session (from HTTP-only cookie)
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

  // 2. Try NextAuth.js JWT session
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (token && token.userId && token.tenantId && token.role) {
    return {
      tenantId: token.tenantId as string,
      userId: token.userId as string,
      role: token.role as string,
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
