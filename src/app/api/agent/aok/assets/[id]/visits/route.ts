import { NextRequest } from "next/server";
import { z } from "zod";
import { withAgentAuth } from "@/lib/agent/auth";
import type { AgentContext } from "@/lib/agent/auth";
import { logAgentAction } from "@/lib/agent/audit";
import { aokOk, aokError } from "@/lib/aok/response";
import { AokServiceError, GENERIC_WRITE_ERROR } from "@/lib/aok/errors";
import { opaqueIdSchema } from "@/lib/aok/ids";
import { readJsonBody } from "@/lib/aok/requestBody";
import { addVisit } from "@/lib/aok/visits";

type RouteContext = { params: Promise<Record<string, string>> };

const addVisitSchema = z
  .object({
    reason: z.string().min(1).max(500),
    outcome: z.string().min(1).max(500),
    notes: z.string().max(2000).optional(),
  })
  .strict();

/** POST /api/agent/aok/assets/:id/visits — rejected against a non-active asset. */
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

    const parsed = addVisitSchema.safeParse(bodyResult.data);
    if (!parsed.success) {
      return aokError("I need a reason and an outcome to log that visit.", 400);
    }

    try {
      const visit = await addVisit(ctx.tenantId, id, parsed.data);
      void logAgentAction(ctx, "aok.visit.create", "aok_visit", visit.id).catch(() => {});
      return aokOk({ visit }, 201);
    } catch (error) {
      if (error instanceof AokServiceError) {
        return aokError(error.message, error.status);
      }
      console.error("[aok] POST /assets/:id/visits error:", error);
      return aokError(GENERIC_WRITE_ERROR, 500);
    }
  }
);
