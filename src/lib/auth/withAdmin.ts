import { NextRequest } from "next/server";
import type { TenantContext } from "@/types/auth";
import { errorResponse } from "@/lib/apiResponse";
import {
  getTenantContext,
  AuthenticationError,
} from "@/lib/tenantContext";

/**
 * Handler function signature for admin-only API routes.
 * Unlike withTenant, params are pre-resolved for convenience.
 */
type AdminHandler = (
  req: NextRequest,
  context: TenantContext,
  params: Record<string, string>
) => Promise<Response>;

/**
 * Wraps an API route handler with admin role enforcement.
 *
 * Builds on getTenantContext() to first resolve authentication,
 * then checks that the user's role is ADMIN. Non-admin users
 * receive a 403 FORBIDDEN response.
 *
 * Route params are awaited and passed as a plain object for convenience.
 *
 * Usage:
 *   export const GET = withAdmin(async (req, ctx) => { ... });
 *   export const PUT = withAdmin(async (req, ctx, params) => {
 *     const { id } = params;
 *     ...
 *   });
 */
export function withAdmin(handler: AdminHandler) {
  return async (
    req: NextRequest,
    routeContext?: { params: Promise<Record<string, string>> }
  ): Promise<Response> => {
    try {
      const context = await getTenantContext(req);

      if (context.role !== "ADMIN") {
        return errorResponse(
          "FORBIDDEN",
          "Admin access required. Your role does not permit this action.",
          undefined,
          403
        );
      }

      const params = routeContext?.params
        ? await routeContext.params
        : {};

      return await handler(req, context, params);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return errorResponse(
          error.errorCode,
          error.message,
          undefined,
          error.statusCode
        );
      }
      console.error("withAdmin error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  };
}
