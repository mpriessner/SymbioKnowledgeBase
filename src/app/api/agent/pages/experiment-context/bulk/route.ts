import { NextRequest } from "next/server";
import { withAgentAuth } from "@/lib/agent/auth";
import type { AgentContext } from "@/lib/agent/auth";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { z } from "zod";
import { assembleBulkContext } from "@/lib/chemistryKb/bulkExperimentContext";

const bulkSchema = z.object({
  experiments: z
    .array(
      z.object({
        experimentId: z.string().min(1),
        depth: z.enum(["default", "medium", "deep"]).default("default"),
      })
    )
    .min(1)
    .max(5),
  maxTotalSize: z.number().int().min(1000).max(100000).default(45000),
});

/**
 * POST /api/agent/pages/experiment-context/bulk
 *
 * Fetches context for multiple experiments in a single request.
 * Primary experiment (first in array) gets 60% of token budget.
 */
export const POST = withAgentAuth(
  async (req: NextRequest, ctx: AgentContext) => {
    try {
      const body = await req.json();
      const parsed = bulkSchema.safeParse(body);

      if (!parsed.success) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Invalid request body. experiments array must have 1-5 items, maxTotalSize must be 1000-100000.",
          undefined,
          400
        );
      }

      const result = await assembleBulkContext(
        ctx.tenantId,
        parsed.data.experiments,
        parsed.data.maxTotalSize
      );

      return successResponse(result);
    } catch (error) {
      console.error(
        "POST /api/agent/pages/experiment-context/bulk error:",
        error
      );
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);
