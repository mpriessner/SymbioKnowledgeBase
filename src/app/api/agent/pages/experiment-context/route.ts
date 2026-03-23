import { NextRequest } from "next/server";
import { withAgentAuth } from "@/lib/agent/auth";
import type { AgentContext } from "@/lib/agent/auth";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import {
  assembleExperimentContext,
  type SearchDepth,
} from "@/lib/chemistryKb/experimentContext";

const VALID_DEPTHS = new Set(["default", "medium", "deep"]);

/**
 * GET /api/agent/pages/experiment-context?experimentId=EXP-2026-0042&depth=medium
 *
 * Returns pre-assembled Chemistry KB context for a specific experiment,
 * suitable for injection into a voice agent's system prompt.
 */
export const GET = withAgentAuth(
  async (req: NextRequest, ctx: AgentContext) => {
    try {
      const { searchParams } = new URL(req.url);
      const experimentId = searchParams.get("experimentId");
      const depth = (searchParams.get("depth") ?? "default") as SearchDepth;

      if (!experimentId) {
        return errorResponse(
          "VALIDATION_ERROR",
          "experimentId query parameter is required",
          undefined,
          400
        );
      }

      if (!VALID_DEPTHS.has(depth)) {
        return errorResponse(
          "VALIDATION_ERROR",
          `Invalid depth "${depth}". Must be one of: default, medium, deep`,
          undefined,
          400
        );
      }

      const context = await assembleExperimentContext(
        ctx.tenantId,
        experimentId,
        depth
      );

      if (!context) {
        return errorResponse(
          "NOT_FOUND",
          `Experiment "${experimentId}" not found in Chemistry KB`,
          undefined,
          404
        );
      }

      return successResponse(context);
    } catch (error) {
      console.error(
        "GET /api/agent/pages/experiment-context error:",
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
