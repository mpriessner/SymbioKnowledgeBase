import { NextRequest } from "next/server";
import { errorResponse } from "@/lib/apiResponse";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "./ratelimit";
import bcrypt from "bcryptjs";

export interface AgentContext {
  tenantId: string;
  userId: string;
  apiKeyId?: string;
  scopes: string[];
}

type RouteContext = { params: Promise<Record<string, string>> };
type AgentHandler = (
  req: NextRequest,
  ctx: AgentContext,
  routeContext: RouteContext
) => Promise<Response>;

/**
 * Auth middleware for Agent API endpoints.
 * Supports API key (skb_live_*) and fallback mock auth.
 * JWT validation deferred to EPIC-19 (Supabase Auth Migration).
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

    let ctx: AgentContext;

    try {
      if (token.startsWith("skb_")) {
        // API Key authentication
        ctx = await authenticateApiKey(token);
      } else {
        // TODO (EPIC-19): Supabase JWT authentication
        // For now, use default tenant from environment
        ctx = {
          tenantId: process.env.DEFAULT_TENANT_ID || "mock-tenant-id",
          userId: "mock-user-id",
          scopes: ["read", "write"],
        };
      }
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

/**
 * Authenticate using an API key (skb_live_* format).
 * Compares bcrypt hash against stored keys.
 */
async function authenticateApiKey(token: string): Promise<AgentContext> {
  // Extract prefix for lookup
  const keyPrefix = token.substring(0, 15);

  // Find candidate keys by prefix (narrows search before bcrypt comparison)
  const candidates = await prisma.apiKey.findMany({
    where: {
      keyPrefix,
      revokedAt: null,
    },
  });

  // Compare hash for each candidate
  for (const apiKey of candidates) {
    const matches = await bcrypt.compare(token, apiKey.keyHash);
    if (matches) {
      // Update last_used_at (non-blocking)
      prisma.apiKey
        .update({
          where: { id: apiKey.id },
          data: { lastUsedAt: new Date() },
        })
        .catch(() => {
          /* ignore update errors */
        });

      return {
        tenantId: apiKey.tenantId,
        userId: apiKey.userId,
        apiKeyId: apiKey.id,
        scopes: apiKey.scopes,
      };
    }
  }

  throw new Error("Invalid API key");
}
