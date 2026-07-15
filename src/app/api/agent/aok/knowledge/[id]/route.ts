import { NextRequest } from "next/server";
import { withAgentAuth } from "@/lib/agent/auth";
import type { AgentContext } from "@/lib/agent/auth";
import { logAgentAction } from "@/lib/agent/audit";
import { aokOk, aokError } from "@/lib/aok/response";
import { AokServiceError, GENERIC_WRITE_ERROR } from "@/lib/aok/errors";
import { opaqueIdSchema } from "@/lib/aok/ids";
import { deleteKnowledge } from "@/lib/aok/knowledge";

type RouteContext = { params: Promise<Record<string, string>> };

/** DELETE /api/agent/aok/knowledge/:id — undo support; hard delete OK. */
export const DELETE = withAgentAuth(
  async (_req: NextRequest, ctx: AgentContext, routeContext: RouteContext) => {
    const { id } = await routeContext.params;
    if (!opaqueIdSchema.safeParse(id).success) {
      return aokError("That note could not be found.", 404);
    }

    try {
      await deleteKnowledge(ctx.tenantId, id);
      void logAgentAction(ctx, "aok.knowledge.delete", "aok_knowledge", id).catch(() => {});
      return aokOk({});
    } catch (error) {
      if (error instanceof AokServiceError) {
        return aokError(error.message, error.status);
      }
      console.error("[aok] DELETE /knowledge/:id error:", error);
      return aokError(GENERIC_WRITE_ERROR, 500);
    }
  }
);
