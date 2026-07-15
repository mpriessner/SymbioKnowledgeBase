import { NextRequest } from "next/server";
import { z } from "zod";
import { withAgentAuth } from "@/lib/agent/auth";
import type { AgentContext } from "@/lib/agent/auth";
import { logAgentAction } from "@/lib/agent/audit";
import { aokOk, aokError } from "@/lib/aok/response";
import { AokServiceError, GENERIC_WRITE_ERROR } from "@/lib/aok/errors";
import { opaqueIdSchema } from "@/lib/aok/ids";
import { readJsonBody } from "@/lib/aok/requestBody";
import { addKnowledge } from "@/lib/aok/knowledge";

type RouteContext = { params: Promise<Record<string, string>> };

const addKnowledgeSchema = z
  .object({
    text: z.string().min(1).max(4000),
    kind: z
      .enum(["how_it_works", "gotcha", "safety_note", "location_note", "contact"])
      .optional(),
  })
  .strict();

/** POST /api/agent/aok/assets/:id/knowledge — rejected against a non-active asset. */
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

    const parsed = addKnowledgeSchema.safeParse(bodyResult.data);
    if (!parsed.success) {
      return aokError("I didn't catch what to save. Please include the note text.", 400);
    }

    try {
      const knowledge = await addKnowledge(ctx.tenantId, id, parsed.data);
      // Audit ids only — never the note text itself.
      void logAgentAction(ctx, "aok.knowledge.create", "aok_knowledge", knowledge.id).catch(
        () => {}
      );
      return aokOk({ knowledge }, 201);
    } catch (error) {
      if (error instanceof AokServiceError) {
        return aokError(error.message, error.status);
      }
      console.error("[aok] POST /assets/:id/knowledge error:", error);
      return aokError(GENERIC_WRITE_ERROR, 500);
    }
  }
);
