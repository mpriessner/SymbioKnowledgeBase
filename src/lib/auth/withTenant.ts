import { NextRequest } from "next/server";
import type { TenantContext } from "@/types/auth";
import { errorResponse } from "@/lib/apiResponse";
import {
  getTenantContext,
  AuthenticationError,
} from "@/lib/tenantContext";

/**
 * Handler function signature for tenant-scoped API routes.
 */
type RouteContext = { params: Promise<Record<string, string>> };
type TenantHandler = (
  req: NextRequest,
  context: TenantContext,
  routeContext: RouteContext
) => Promise<Response>;

/**
 * Wraps an API route handler with tenant context injection.
 *
 * Extracts tenant context from either:
 * 1. API key (Authorization: Bearer <key>) — takes precedence
 * 2. Supabase Auth session (from cookie)
 *
 * Returns 401 if neither authentication method is valid.
 *
 * Usage:
 *   export const GET = withTenant(async (req, ctx) => { ... });
 *   export const POST = withTenant(async (req, ctx, { params }) => { ... });
 */
export function withTenant(handler: TenantHandler) {
  return async (
    req: NextRequest,
    routeContext?: RouteContext
  ): Promise<Response> => {
    try {
      const context = await getTenantContext(req);
      const ctx = routeContext ?? {
        params: Promise.resolve({}),
      };

      return await handler(req, context, ctx);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return errorResponse(
          error.errorCode,
          error.message,
          undefined,
          error.statusCode
        );
      }
      console.error("withTenant error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  };
}
