import { NextRequest } from "next/server";
import { withAgentAuth } from "@/lib/agent/auth";
import type { AgentContext } from "@/lib/agent/auth";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { z } from "zod";
import {
  detectConflicts,
  scanCategoryConflicts,
} from "@/lib/chemistryKb/conflictDetection";

/**
 * GET /api/agent/pages/conflicts?categoryId=...
 *
 * Scans a category for conflicts between existing Team KB pages.
 *
 * POST /api/agent/pages/conflicts
 *
 * Detects conflicts for a specific page against its category siblings.
 */

const postSchema = z.object({
  pageId: z.string().uuid(),
  categoryId: z.string().uuid(),
});

export const GET = withAgentAuth(
  async (req: NextRequest, ctx: AgentContext) => {
    try {
      const { searchParams } = new URL(req.url);
      const categoryId = searchParams.get("categoryId");

      if (!categoryId) {
        return errorResponse(
          "VALIDATION_ERROR",
          "categoryId query parameter is required",
          undefined,
          400
        );
      }

      const report = await scanCategoryConflicts(ctx.tenantId, categoryId);
      return successResponse(report);
    } catch (error) {
      console.error("GET /api/agent/pages/conflicts error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);

export const POST = withAgentAuth(
  async (req: NextRequest, ctx: AgentContext) => {
    try {
      const body = await req.json();
      const parsed = postSchema.safeParse(body);

      if (!parsed.success) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Invalid request body",
          undefined,
          400
        );
      }

      const report = await detectConflicts(
        ctx.tenantId,
        parsed.data.pageId,
        parsed.data.categoryId
      );

      return successResponse(report);
    } catch (error) {
      console.error("POST /api/agent/pages/conflicts error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);
