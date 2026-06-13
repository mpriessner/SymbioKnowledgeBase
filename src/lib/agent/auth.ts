import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { errorResponse } from "@/lib/apiResponse";
import { prisma } from "@/lib/db";
import { ensureUserExists } from "@/lib/auth/ensureUserExists";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { logAuthEvent, clientIpFromHeaders } from "./audit";
import { checkRateLimit } from "./ratelimit";
import bcrypt from "bcryptjs";
import { createHash } from "crypto";

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
 * Accepts EITHER:
 *  - an `skb_` API key (verified against the api_keys table, with per-key scopes), OR
 *  - a real Supabase access token (JWT), verified server-side via
 *    `supabase.auth.getUser(token)` against the live ExpTube stack.
 *
 * Everything else fails closed with 401 (audit S1/S7 — no more mock principal).
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
        // API Key authentication (per-key scopes from the api_keys table).
        ctx = await authenticateApiKey(token);
      } else {
        // Otherwise verify as a real Supabase access token (JWT).
        ctx = await authenticateSupabaseJwt(token);
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Authentication failed";
      // Audit the (anonymous) rejection — persisted with NULL principal.
      await logAuthEvent("auth.reject", `${req.method} ${req.nextUrl.pathname}`, {}, {
        reason: message,
        ip: clientIpFromHeaders(req.headers),
      });
      return errorResponse("UNAUTHORIZED", message, undefined, 401);
    }

    // Check rate limit. Key on the real principal (apiKeyId preferred, else
    // userId). Post-mock-removal this is always a real id; guard against an
    // empty/synthetic principal silently sharing one bucket (audit S8).
    const rateLimitKey = ctx.apiKeyId || ctx.userId;
    if (!rateLimitKey) {
      return errorResponse("UNAUTHORIZED", "Unresolved principal", undefined, 401);
    }
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
    const resource = `${method} ${req.nextUrl.pathname}`;
    const principal = {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      apiKeyId: ctx.apiKeyId,
    };
    if (method === "GET" && !ctx.scopes.includes("read")) {
      await logAuthEvent("auth.reject", resource, principal, {
        reason: "missing read scope",
      });
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
      await logAuthEvent("auth.reject", resource, principal, {
        reason: "missing write scope",
      });
      return errorResponse(
        "FORBIDDEN",
        "Insufficient permissions (write scope required)",
        undefined,
        403
      );
    }

    // Audit the successful authorization. Fire-and-forget (do NOT await) so the
    // hot read path (kb-query) is not blocked by a per-request DB write; the
    // logger swallows errors internally so the floating promise never rejects.
    void logAuthEvent("auth.success", resource, principal);

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
 * Supports both SHA-256 (from /api/keys) and bcrypt (from /api/settings/api-keys) hashed keys.
 */
async function authenticateApiKey(token: string): Promise<AgentContext> {
  // Try SHA-256 lookup first (fast, O(1))
  const sha256Hash = createHash("sha256").update(token).digest("hex");
  const sha256Match = await prisma.apiKey.findFirst({
    where: { keyHash: sha256Hash, revokedAt: null },
  });

  if (sha256Match) {
    prisma.apiKey
      .update({ where: { id: sha256Match.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {});
    return {
      tenantId: sha256Match.tenantId,
      userId: sha256Match.userId,
      apiKeyId: sha256Match.id,
      scopes: resolveKeyScopes(sha256Match.scopes),
    };
  }

  // Fall back to bcrypt prefix lookup
  const keyPrefix = token.substring(0, 15);
  const candidates = await prisma.apiKey.findMany({
    where: { keyPrefix, revokedAt: null },
  });

  for (const apiKey of candidates) {
    const matches = await bcrypt.compare(token, apiKey.keyHash);
    if (matches) {
      prisma.apiKey
        .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
        .catch(() => {});
      return {
        tenantId: apiKey.tenantId,
        userId: apiKey.userId,
        apiKeyId: apiKey.id,
        scopes: resolveKeyScopes(apiKey.scopes),
      };
    }
  }

  throw new Error("Invalid API key");
}

/**
 * Resolve the effective scopes for an API key.
 *
 * Reads the persisted `scopes` column (audit S11). Legacy rows created before
 * scopes were persisted have an empty array — for those we fall back to the
 * historical `["read","write"]` so no currently-working key is locked out until
 * the backfill migration runs. New keys default to least-privilege `["read"]`
 * at creation, so they get a non-empty array and are NOT widened by this
 * fallback.
 */
function resolveKeyScopes(scopes: string[] | null | undefined): string[] {
  if (scopes && scopes.length > 0) return scopes;
  return ["read", "write"];
}

/**
 * Build a custom fetch that rewrites the browser-facing Supabase URL to the
 * Docker-internal URL, mirroring the cookie path (tenantContext.ts). Without
 * this the verify `GET /user` call fails inside Docker (localhost:5434x is
 * unreachable from the container; only host.docker.internal works).
 */
function getSupabaseFetchConfig() {
  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const internalUrl = process.env.SUPABASE_INTERNAL_URL;
  if (internalUrl && publicUrl && internalUrl !== publicUrl) {
    return {
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) => {
          const url = input.toString().replace(publicUrl, internalUrl);
          return fetch(url, init);
        },
      },
    };
  }
  return {};
}

/**
 * Verify a Supabase access token (JWT) and resolve it to an AgentContext.
 *
 * `supabase.auth.getUser(token)` issues `GET /user` carrying the token; the
 * auth server rejects malformed/expired/forged tokens, returning
 * `{ data: { user: null }, error }` — it does NOT throw. So we check BOTH a
 * falsy user AND `error`, and treat either as a 401 (audit-01 Kimi note).
 * A 5s timeout mirrors the cookie path so an unreachable Supabase yields 401,
 * not a hang.
 */
async function authenticateSupabaseJwt(token: string): Promise<AgentContext> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured; cannot verify access token");
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: { getAll: () => [], setAll: () => {} },
      ...getSupabaseFetchConfig(),
    }
  );

  const getUserWithTimeout = Promise.race([
    supabase.auth.getUser(token),
    new Promise<{ data: { user: null }; error: Error }>((resolve) =>
      setTimeout(
        () => resolve({ data: { user: null }, error: new Error("Supabase auth timeout") }),
        5000
      )
    ),
  ]);

  const {
    data: { user },
    error,
  } = await getUserWithTimeout;

  if (error || !user) {
    throw new Error("Invalid or expired access token");
  }

  // Map the verified Supabase user to the Prisma user/tenant (cross-app SSO).
  const dbUser = await ensureUserExists(user);
  return {
    tenantId: dbUser.tenantId,
    userId: dbUser.id,
    // JWT principals are full users; per-JWT scope-narrowing is out of scope.
    scopes: ["read", "write"],
  };
}
