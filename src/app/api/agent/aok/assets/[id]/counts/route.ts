import { NextRequest } from "next/server";
import { z } from "zod";
import { withAgentAuth } from "@/lib/agent/auth";
import type { AgentContext } from "@/lib/agent/auth";
import { logAgentAction } from "@/lib/agent/audit";
import { aokOk, aokError } from "@/lib/aok/response";
import { AokServiceError, GENERIC_WRITE_ERROR } from "@/lib/aok/errors";
import { opaqueIdSchema } from "@/lib/aok/ids";
import { readJsonBody } from "@/lib/aok/requestBody";
import { addCount } from "@/lib/aok/counts";

type RouteContext = { params: Promise<Record<string, string>> };

const addCountSchema = z
  .object({
    qty: z.number().finite(),
    unit: z.string().min(1).max(50).optional(),
  })
  .strict();

/** POST /api/agent/aok/assets/:id/counts — expected_qty/delta are nulls when no expected_qty is on the asset's attributes. */
export const POST = withAgentAuth(
  async (req: NextRequest, ctx: AgentContext, routeContext: RouteContext) => {
    const { id } = await routeContext.params;
    if (!opaqueIdSchema.safeParse(id).success) {
      return aokError("That object could not be found.", 404);
    }

    const bodyResult = await readJsonBody(req);
    if (!bodyResult.ok) {
      return aokError("I couldn't read that request. Please try again.", 400);
    }

    const parsed = addCountSchema.safeParse(bodyResult.data);
    if (!parsed.success) {
      return aokError("I need a count to save. Please give me a quantity.", 400);
    }

    try {
      const countLine = await addCount(ctx.tenantId, id, parsed.data);
      void logAgentAction(ctx, "aok.count.create", "aok_count_line", countLine.id).catch(
        () => {}
      );
      return aokOk(
        { count_line: countLine, expected_qty: countLine.expected_qty, delta: countLine.delta },
        201
      );
    } catch (error) {
      if (error instanceof AokServiceError) {
        return aokError(error.message, error.status);
      }
      console.error("[aok] POST /assets/:id/counts error:", error);
      return aokError(GENERIC_WRITE_ERROR, 500);
    }
  }
);
