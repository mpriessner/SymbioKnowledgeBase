import { NextRequest } from "next/server";
import { withAgentAuth } from "@/lib/agent/auth";
import type { AgentContext } from "@/lib/agent/auth";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { z } from "zod";
import { immediateRefresh } from "@/lib/chemistryKb/aggregationRefresh";
import type { RefreshTrigger } from "@/lib/chemistryKb/aggregationRefresh";

const refreshSchema = z.object({
  pageIds: z.array(z.string().uuid()).min(1),
  trigger: z.enum(["manual", "promotion", "capture", "sync"]).default("manual"),
});

/**
 * POST /api/agent/pages/refresh-aggregation
 *
 * Manually trigger an aggregation refresh for specified pages.
 * Finds affected aggregation pages and updates their computed content.
 */
export const POST = withAgentAuth(
  async (req: NextRequest, ctx: AgentContext) => {
    try {
      const body = await req.json();
      const parsed = refreshSchema.safeParse(body);

      if (!parsed.success) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Invalid request body",
          undefined,
          400
        );
      }

      const result = await immediateRefresh(
        ctx.tenantId,
        parsed.data.pageIds,
        parsed.data.trigger as RefreshTrigger
      );

      return successResponse(result);
    } catch (error) {
      console.error(
        "POST /api/agent/pages/refresh-aggregation error:",
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
