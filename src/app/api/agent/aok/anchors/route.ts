import { NextRequest } from "next/server";
import { z } from "zod";
import { withAgentAuth } from "@/lib/agent/auth";
import type { AgentContext } from "@/lib/agent/auth";
import { logAgentAction } from "@/lib/agent/audit";
import { aokOk, aokError } from "@/lib/aok/response";
import { AokServiceError, GENERIC_WRITE_ERROR } from "@/lib/aok/errors";
import { opaqueIdSchema } from "@/lib/aok/ids";
import { readJsonBody } from "@/lib/aok/requestBody";
import { mintAnchor } from "@/lib/aok/anchors";
import { renderQrPngBase64 } from "@/lib/aok/qr";

// qrcode needs Buffer — never set this to "edge".
export const runtime = "nodejs";

const mintAnchorSchema = z
  .object({
    asset_id: opaqueIdSchema.optional(),
    type: z.string().min(1).max(20).optional(),
  })
  .strict();

/**
 * POST /api/agent/aok/anchors — mint an anchor. Omitted `asset_id` mints an
 * unbound blank sticker (for pre-printed rolls); race-free single-insert
 * minting, see src/lib/aok/anchors.ts.
 */
export const POST = withAgentAuth(async (req: NextRequest, ctx: AgentContext) => {
  const bodyResult = await readJsonBody(req);
  if (!bodyResult.ok) {
    return aokError("I couldn't read that request. Please try again.", 400);
  }

  const parsed = mintAnchorSchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return aokError("I didn't understand part of that request.", 400);
  }

  try {
    const anchor = await mintAnchor(ctx.tenantId, parsed.data);
    const qrPngBase64 = await renderQrPngBase64(anchor.payload);
    void logAgentAction(ctx, "aok.anchor.mint", "aok_anchor", anchor.id).catch(() => {});
    return aokOk({ anchor, qr_png_base64: qrPngBase64 }, 201);
  } catch (error) {
    if (error instanceof AokServiceError) {
      return aokError(error.message, error.status);
    }
    console.error("[aok] POST /anchors error:", error);
    return aokError(GENERIC_WRITE_ERROR, 500);
  }
});
