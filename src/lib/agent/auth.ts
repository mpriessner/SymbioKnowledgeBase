import { NextRequest } from "next/server";
import { errorResponse } from "@/lib/apiResponse";

export interface AgentContext {
  tenantId: string;
  userId: string;
  apiKeyId?: string;
}

type RouteContext = { params: Promise<Record<string, string>> };
type AgentHandler = (
  req: NextRequest,
  ctx: AgentContext,
  routeContext: RouteContext
) => Promise<Response>;

/**
 * Placeholder auth middleware for Agent API endpoints.
 * Validates Bearer token format and injects mock tenant context.
 * Real implementation in SKB-15.3.
 */
export function withAgentAuth(handler: AgentHandler) {
  return async (
    req: NextRequest,
    routeContext?: RouteContext
  ): Promise<Response> => {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return errorResponse(
        "UNAUTHORIZED",
        "Missing or invalid Authorization header",
        undefined,
        401
      );
    }

    const token = authHeader.substring(7);

    if (!token || token.length < 1) {
      return errorResponse(
        "UNAUTHORIZED",
        "Empty bearer token",
        undefined,
        401
      );
    }

    // TODO (SKB-15.3): Validate Supabase JWT or API key
    // For now, use default tenant from environment or mock
    const ctx: AgentContext = {
      tenantId: process.env.DEFAULT_TENANT_ID || "mock-tenant-id",
      userId: "mock-user-id",
    };

    const rc = routeContext ?? { params: Promise.resolve({}) };

    return handler(req, ctx, rc);
  };
}
