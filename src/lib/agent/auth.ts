import { NextRequest } from "next/server";
import { errorResponse } from "@/lib/apiResponse";
import { resolveApiKey } from "@/lib/apiAuth";
import { checkRateLimit } from "./ratelimit";

export interface AgentContext {
  tenantId: string;
  userId: string;
  apiKeyId?: string;
  scopes: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteContext = { params: Promise<Record<string, any>> };
type AgentHandler = (
  req: NextRequest,
  ctx: AgentContext,
  routeContext: RouteContext
) => Promise<Response>;

/**
 * Auth middleware for Agent API endpoints.
 *
 * Authentication is API-key only: the Bearer token MUST be a valid, non-revoked
 * `skb_` key, resolved by the canonical verifier in `@/lib/apiAuth`. There is no
 * mock/default-tenant fallback — any token that does not resolve to a real key
 * is rejected with 401. Scopes come from the key itself and are enforced per
 * HTTP method below.
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

    // API-key-only authentication. Any token that is not a valid, non-revoked
    // `skb_` key is rejected — there is no mock/default-tenant fallback.
    let ctx: AgentContext;

    try {
      const apiKeyContext = await resolveApiKey(authHeader);
      if (!apiKeyContext) {
        return errorResponse(
          "UNAUTHORIZED",
          "Invalid or revoked API key",
          undefined,
          401
        );
      }
      ctx = {
        tenantId: apiKeyContext.tenantId,
        userId: apiKeyContext.userId,
        apiKeyId: apiKeyContext.apiKeyId,
        scopes: apiKeyContext.scopes,
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Authentication failed";
      return errorResponse("UNAUTHORIZED", message, undefined, 401);
    }

    // Check rate limit
    const rateLimitKey = ctx.apiKeyId || ctx.userId;
    const { allowed, remaining, resetAt } =
      await checkRateLimit(rateLimitKey);

    if (!allowed) {
      const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
      const response = errorResponse(
        "RATE_LIMIT_EXCEEDED",
        "Too many requests",
        undefined,
        429
      );
      response.headers.set("X-RateLimit-Limit", "100");
      response.headers.set("X-RateLimit-Remaining", "0");
      response.headers.set(
        "X-RateLimit-Reset",
        Math.floor(resetAt / 1000).toString()
      );
      response.headers.set("Retry-After", retryAfter.toString());
      return response;
    }

    // Check scope for method
    const method = req.method;
    if (method === "GET" && !ctx.scopes.includes("read")) {
      return errorResponse(
        "FORBIDDEN",
        "Insufficient permissions (read scope required)",
        undefined,
        403
      );
    }
    if (
      ["POST", "PUT", "PATCH", "DELETE"].includes(method) &&
      !ctx.scopes.includes("write")
    ) {
      return errorResponse(
        "FORBIDDEN",
        "Insufficient permissions (write scope required)",
        undefined,
        403
      );
    }

    const rc = routeContext ?? { params: Promise.resolve({}) };

    // Execute handler
    const response = await handler(req, ctx, rc);

    // Add rate limit headers
    if (response instanceof Response) {
      response.headers.set("X-RateLimit-Limit", "100");
      response.headers.set(
        "X-RateLimit-Remaining",
        remaining.toString()
      );
      response.headers.set(
        "X-RateLimit-Reset",
        Math.floor(resetAt / 1000).toString()
      );
    }

    return response;
  };
}
