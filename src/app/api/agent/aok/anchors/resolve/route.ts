import { NextRequest } from "next/server";
import { withAgentAuth } from "@/lib/agent/auth";
import type { AgentContext } from "@/lib/agent/auth";
import { aokOk, aokError, NO_STORE_HEADERS } from "@/lib/aok/response";
import { GENERIC_READ_ERROR } from "@/lib/aok/errors";
import { resolveAnchor } from "@/lib/aok/anchors";

/**
 * GET /api/agent/aok/anchors/resolve?payload=... — the one route with an
 * intentionally asymmetric status contract: unknown payload is a real 404,
 * but a retired target is 200 with `ok:false` (the anchor resolved fine;
 * the asset it points to is unavailable). Cache-Control: no-store.
 */
export const GET = withAgentAuth(async (req: NextRequest, ctx: AgentContext) => {
  const url = new URL(req.url);
  const payload = url.searchParams.get("payload");
  if (!payload || payload.trim().length === 0 || payload.length > 500) {
    return aokError("I need a code to look up.", 400, NO_STORE_HEADERS);
  }

  try {
    const result = await resolveAnchor(ctx.tenantId, payload);

    if (!result.ok) {
      return aokError(result.error, result.status, NO_STORE_HEADERS);
    }
    if (!result.bound) {
      return aokOk({ bound: false, anchor_id: result.anchor_id }, 200, NO_STORE_HEADERS);
    }

    const { ok: _ok, bound: _bound, anchor_id, ...card } = result;
    return aokOk({ bound: true, anchor_id, ...card }, 200, NO_STORE_HEADERS);
  } catch (error) {
    console.error("[aok] GET /anchors/resolve error:", error);
    return aokError(GENERIC_READ_ERROR, 500, NO_STORE_HEADERS);
  }
});
