import { NextRequest } from "next/server";
import { z } from "zod";
import { withAgentAuth } from "@/lib/agent/auth";
import type { AgentContext } from "@/lib/agent/auth";
import { logAgentAction } from "@/lib/agent/audit";
import { aokOk, aokError } from "@/lib/aok/response";
import { AokServiceError, GENERIC_WRITE_ERROR } from "@/lib/aok/errors";
import { opaqueIdSchema } from "@/lib/aok/ids";
import { readJsonBody } from "@/lib/aok/requestBody";
import { createAsset } from "@/lib/aok/assets";

const createAssetSchema = z
  .object({
    name: z.string().min(1).max(200),
    category: z.string().min(1).max(200),
    class: z.enum(["facility_asset", "inventory_item", "parcel"]).optional(),
    criticality: z.string().min(1).max(50).optional(),
    space_name: z.string().min(1).max(200).optional(),
    site_id: opaqueIdSchema.optional(),
    attributes: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

/**
 * POST /api/agent/aok/assets — Story AOK-01.
 *
 * Response uses the AOK dual envelope (`{ok:true,...}`/`{ok:false,error}`),
 * NOT the repo-standard `{data,meta}` envelope from `@/lib/apiResponse` — see
 * docs/stories/2026-07-14-aok-01-anchored-object-backend.md.
 */
export const POST = withAgentAuth(async (req: NextRequest, ctx: AgentContext) => {
  const bodyResult = await readJsonBody(req);
  if (!bodyResult.ok) {
    return aokError("I couldn't read that request. Please try again.", 400);
  }

  const parsed = createAssetSchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return aokError(
      "I didn't understand part of that request. Please check the required fields.",
      400
    );
  }

  try {
    const asset = await createAsset(ctx.tenantId, parsed.data);
    void logAgentAction(ctx, "aok.asset.create", "aok_asset", asset.id).catch(() => {});
    return aokOk({ asset }, 201);
  } catch (error) {
    if (error instanceof AokServiceError) {
      return aokError(error.message, error.status);
    }
    console.error("[aok] POST /assets error:", error);
    return aokError(GENERIC_WRITE_ERROR, 500);
  }
});
