import { NextRequest } from "next/server";
import { withAgentAuth } from "@/lib/agent/auth";
import type { AgentContext } from "@/lib/agent/auth";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { z } from "zod";
import { captureLearning } from "@/lib/chemistryKb/promotionService";

const learningItemSchema = z.object({
  type: z.enum(["best_practice", "pitfall", "optimization", "observation"]),
  content: z.string().min(1),
  confidence: z.enum(["high", "medium", "low"]),
  promoteTo: z.enum(["team"]).nullable().optional(),
});

const captureLearningSchema = z.object({
  experimentId: z.string().min(1),
  learnings: z.array(learningItemSchema).min(1),
  debriefSummary: z.string().optional(),
});

/**
 * POST /api/agent/pages/capture-learning
 *
 * Captures learnings from a voice agent debrief session.
 * Saves to the experiment's private page and optionally
 * promotes high-confidence learnings to Team KB.
 */
export const POST = withAgentAuth(
  async (req: NextRequest, ctx: AgentContext) => {
    try {
      const body = await req.json();
      const parsed = captureLearningSchema.safeParse(body);

      if (!parsed.success) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Invalid request body",
          undefined,
          400
        );
      }

      const result = await captureLearning(
        ctx.tenantId,
        ctx.userId,
        parsed.data
      );

      return successResponse(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Internal server error";

      // Known error from service: experiment not found
      if (message.startsWith("Experiment")) {
        return errorResponse("NOT_FOUND", message, undefined, 404);
      }

      console.error("POST /api/agent/pages/capture-learning error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);
