import { NextRequest } from "next/server";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { getSummaryService } from "@/lib/summary/SummaryService";
import { isSummaryGenerationEnabled } from "@/lib/summary/config";
import { prisma } from "@/lib/db";
import type { TenantContext } from "@/types/auth";

/**
 * POST /api/pages/[id]/summary/generate
 *
 * Manually trigger summary regeneration for a specific page.
 * Returns the updated summary after generation completes.
 */
export const POST = withTenant(
  async (
    req: NextRequest,
    ctx: TenantContext,
    routeContext: { params: Promise<Record<string, string>> }
  ) => {
    const { id: pageId } = await routeContext.params;

    if (!isSummaryGenerationEnabled()) {
      return errorResponse(
        "LLM_NOT_CONFIGURED",
        "Summary generation is not configured. Set SUMMARY_LLM_API_KEY environment variable.",
        undefined,
        503
      );
    }

    try {
      // Verify page exists
      const page = await prisma.page.findFirst({
        where: { id: pageId, tenantId: ctx.tenantId },
        select: { id: true },
      });

      if (!page) {
        return errorResponse("NOT_FOUND", "Page not found", undefined, 404);
      }

      // Generate summary (synchronous for manual trigger)
      await getSummaryService().generateForPage(pageId, ctx.tenantId);

      // Fetch updated summary
      const updated = await prisma.page.findFirst({
        where: { id: pageId, tenantId: ctx.tenantId },
        select: {
          oneLiner: true,
          summary: true,
          summaryUpdatedAt: true,
        },
      });

      return successResponse({
        oneLiner: updated?.oneLiner ?? null,
        summary: updated?.summary ?? null,
        summaryUpdatedAt:
          updated?.summaryUpdatedAt?.toISOString() ?? null,
      });
    } catch (error) {
      console.error("Failed to generate summary:", error);
      return errorResponse(
        "GENERATION_FAILED",
        "Failed to generate summary",
        undefined,
        500
      );
    }
  }
);
