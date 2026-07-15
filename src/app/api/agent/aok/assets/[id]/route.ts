import { NextRequest } from "next/server";
import { z } from "zod";
import { withAgentAuth } from "@/lib/agent/auth";
import type { AgentContext } from "@/lib/agent/auth";
import { logAgentAction } from "@/lib/agent/audit";
import { aokOk, aokError, NO_STORE_HEADERS } from "@/lib/aok/response";
import { AokServiceError, GENERIC_READ_ERROR, GENERIC_WRITE_ERROR } from "@/lib/aok/errors";
import { opaqueIdSchema } from "@/lib/aok/ids";
import { readJsonBody } from "@/lib/aok/requestBody";
import { getAssetCard, patchAsset } from "@/lib/aok/assets";

type RouteContext = { params: Promise<Record<string, string>> };

const patchAssetSchema = z
  .object({
    status: z.enum(["active", "retired", "replaced", "deleted"]).optional(),
    name: z.string().min(1).max(200).optional(),
    category: z.string().min(1).max(200).optional(),
    attributes: z.record(z.string(), z.unknown()).optional(),
    space_name: z.string().min(1).max(200).optional(),
  })
  .strict();

/** GET /api/agent/aok/assets/:id — asset card. Cache-Control: no-store (sensitive-response treatment). */
export const GET = withAgentAuth(
  async (_req: NextRequest, ctx: AgentContext, routeContext: RouteContext) => {
    const { id } = await routeContext.params;
    if (!opaqueIdSchema.safeParse(id).success) {
      return aokError("That object could not be found.", 404, NO_STORE_HEADERS);
    }

    try {
      const card = await getAssetCard(ctx.tenantId, id);
      return aokOk(card, 200, NO_STORE_HEADERS);
    } catch (error) {
      if (error instanceof AokServiceError) {
        return aokError(error.message, error.status, NO_STORE_HEADERS);
      }
      console.error("[aok] GET /assets/:id error:", error);
      return aokError(GENERIC_READ_ERROR, 500, NO_STORE_HEADERS);
    }
  }
);

/** PATCH /api/agent/aok/assets/:id — `attributes` is a shallow merge, not a replace. */
export const PATCH = withAgentAuth(
  async (req: NextRequest, ctx: AgentContext, routeContext: RouteContext) => {
    const { id } = await routeContext.params;
    if (!opaqueIdSchema.safeParse(id).success) {
      return aokError("That object could not be found.", 404);
    }

    const bodyResult = await readJsonBody(req);
    if (!bodyResult.ok) {
      return aokError("I couldn't read that request. Please try again.", 400);
    }

    const parsed = patchAssetSchema.safeParse(bodyResult.data);
    if (!parsed.success) {
      return aokError(
        "I didn't understand part of that request. Please check the fields you're changing.",
        400
      );
    }

    try {
      const asset = await patchAsset(ctx.tenantId, id, parsed.data);
      void logAgentAction(ctx, "aok.asset.update", "aok_asset", id).catch(() => {});
      return aokOk({ asset });
    } catch (error) {
      if (error instanceof AokServiceError) {
        return aokError(error.message, error.status);
      }
      console.error("[aok] PATCH /assets/:id error:", error);
      return aokError(GENERIC_WRITE_ERROR, 500);
    }
  }
);
