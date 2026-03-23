import { NextRequest } from "next/server";
import { withAgentAuth } from "@/lib/agent/auth";
import type { AgentContext } from "@/lib/agent/auth";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { z } from "zod";
import { promotePage } from "@/lib/chemistryKb/promotionService";

const promoteSchema = z.object({
  sourcePageId: z.string().uuid(),
  targetCategoryId: z.string().uuid(),
  promotionType: z.enum(["copy", "move"]),
  sections: z.array(z.string()).min(1),
  reviewRequired: z.boolean().default(false),
});

/**
 * POST /api/agent/pages/promote
 *
 * Promotes a page from Private to Team Chemistry KB.
 * Two modes: "copy" (creates new page with selected sections)
 * or "move" (moves entire page, leaves redirect stub).
 */
export const POST = withAgentAuth(
  async (req: NextRequest, ctx: AgentContext) => {
    try {
      const body = await req.json();
      const parsed = promoteSchema.safeParse(body);

      if (!parsed.success) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Invalid request body",
          undefined,
          400
        );
      }

      const result = await promotePage(ctx.tenantId, ctx.userId, parsed.data);

      return successResponse(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Internal server error";

      // Known validation errors from the service
      if (
        message === "Source page not found" ||
        message === "Target category must be a Team space page"
      ) {
        return errorResponse(
          message === "Source page not found" ? "NOT_FOUND" : "VALIDATION_ERROR",
          message,
          undefined,
          message === "Source page not found" ? 404 : 400
        );
      }

      console.error("POST /api/agent/pages/promote error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);
