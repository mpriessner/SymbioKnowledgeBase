import { NextRequest } from "next/server";
import type { TenantContext } from "@/types/auth";
import { errorResponse } from "@/lib/apiResponse";

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
 * Default IDs for development mode.
 * Matches the seeded data in prisma/seed.ts.
 */
const DEV_TENANT_ID = "00000000-0000-0000-0000-000000000001";
const DEV_USER_ID = "00000000-0000-0000-0000-000000000002";
const DEV_ROLE = "ADMIN";

/**
 * Wraps an API route handler with tenant context injection.
 *
 * In development mode, uses the default seeded tenant.
 * Will be enhanced with real authentication in SKB-02.x.
 *
 * Usage:
 *   export const GET = withTenant(async (req, ctx) => { ... });
 *   export const POST = withTenant(async (req, ctx, { params }) => { ... });
 */
export function withTenant(handler: TenantHandler) {
  return async (req: NextRequest, routeContext?: RouteContext): Promise<Response> => {
    try {
      // Development stub: use default tenant
      // TODO: Replace with real auth when SKB-02.x is merged
      const context: TenantContext = {
        tenantId: DEV_TENANT_ID,
        userId: DEV_USER_ID,
        role: DEV_ROLE,
      };
      const ctx = routeContext ?? {
        params: Promise.resolve({}),
      };

      return await handler(req, context, ctx);
    } catch (error) {
      console.error("withTenant error:", error);
      return errorResponse("INTERNAL_ERROR", "Internal server error", undefined, 500);
    }
  };
}
