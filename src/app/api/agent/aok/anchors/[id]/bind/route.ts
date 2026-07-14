import { NextRequest } from "next/server";
import { z } from "zod";
import { withAgentAuth } from "@/lib/agent/auth";
import type { AgentContext } from "@/lib/agent/auth";
import { logAgentAction } from "@/lib/agent/audit";
import { aokOk, aokError } from "@/lib/aok/response";
import { AokServiceError, GENERIC_WRITE_ERROR } from "@/lib/aok/errors";
import { opaqueIdSchema } from "@/lib/aok/ids";
import { readJsonBody } from "@/lib/aok/requestBody";
import { bindAnchor } from "@/lib/aok/anchors";

type RouteContext = { params: Promise<Record<string, string>> };

const bindSchema = z.object({ asset_id: opaqueIdSchema }).strict();

/**
 * POST /api/agent/aok/anchors/:id/bind — rebinding an already-bound anchor
 * is allowed (rebind = spec-pack lifecycle). Binding to a non-active asset
 * is a 409 speakable rejection.
 */
export const POST = withAgentAuth(
  async (req: NextRequest, ctx: AgentContext, routeContext: RouteContext) => {
    const { id } = await routeContext.params;
    if (!opaqueIdSchema.safeParse(id).success) {
      return aokError("That code could not be found.", 404);
    }

    const bodyResult = await readJsonBody(req);
    if (!bodyResult.ok) {
      return aokError("I couldn't read that request. Please try again.", 400);
    }

    const parsed = bindSchema.safeParse(bodyResult.data);
    if (!parsed.success) {
      return aokError("I need to know which object to bind that code to.", 400);
    }

    try {
      const anchor = await bindAnchor(ctx.tenantId, id, parsed.data.asset_id);
      void logAgentAction(ctx, "aok.anchor.bind", "aok_anchor", anchor.id).catch(() => {});
      return aokOk({ anchor });
    } catch (error) {
      if (error instanceof AokServiceError) {
        return aokError(error.message, error.status);
      }
      console.error("[aok] POST /anchors/:id/bind error:", error);
      return aokError(GENERIC_WRITE_ERROR, 500);
    }
  }
);
