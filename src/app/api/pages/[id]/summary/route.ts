import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import type { TenantContext } from "@/types/auth";

const ONE_LINER_MAX_LENGTH = 100;
const SUMMARY_MAX_LENGTH = 500;

/**
 * GET /api/pages/[id]/summary
 *
 * Returns the page's one-liner, summary, and summaryUpdatedAt.
 */
export const GET = withTenant(
  async (
    req: NextRequest,
    ctx: TenantContext,
    routeContext: { params: Promise<Record<string, string>> }
  ) => {
    const { id: pageId } = await routeContext.params;

    try {
      const page = await prisma.page.findFirst({
        where: {
          id: pageId,
          tenantId: ctx.tenantId,
        },
        select: {
          oneLiner: true,
          summary: true,
          summaryUpdatedAt: true,
        },
      });

      if (!page) {
        return errorResponse("NOT_FOUND", "Page not found", undefined, 404);
      }

      return successResponse({
        oneLiner: page.oneLiner,
        summary: page.summary,
        summaryUpdatedAt: page.summaryUpdatedAt?.toISOString() ?? null,
      });
    } catch (error) {
      console.error("Failed to fetch page summary:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Failed to fetch page summary",
        undefined,
        500
      );
    }
  }
);

/**
 * PUT /api/pages/[id]/summary
 *
 * Updates the page's one-liner and/or summary.
 * Validates length constraints and sets summaryUpdatedAt.
 */
export const PUT = withTenant(
  async (
    req: NextRequest,
    ctx: TenantContext,
    routeContext: { params: Promise<Record<string, string>> }
  ) => {
    const { id: pageId } = await routeContext.params;

    try {
      const body = await req.json();
      const { oneLiner, summary } = body as {
        oneLiner?: string;
        summary?: string;
      };

      // Validate lengths
      const validationErrors: Array<{ field: string; message: string }> = [];

      if (oneLiner !== undefined && oneLiner !== null && oneLiner.length > ONE_LINER_MAX_LENGTH) {
        validationErrors.push({
          field: "oneLiner",
          message: `One-liner must be at most ${ONE_LINER_MAX_LENGTH} characters`,
        });
      }

      if (summary !== undefined && summary !== null && summary.length > SUMMARY_MAX_LENGTH) {
        validationErrors.push({
          field: "summary",
          message: `Summary must be at most ${SUMMARY_MAX_LENGTH} characters`,
        });
      }

      if (validationErrors.length > 0) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Invalid input",
          validationErrors,
          400
        );
      }

      // Verify page exists and belongs to tenant
      const page = await prisma.page.findFirst({
        where: {
          id: pageId,
          tenantId: ctx.tenantId,
        },
        select: { id: true },
      });

      if (!page) {
        return errorResponse("NOT_FOUND", "Page not found", undefined, 404);
      }

      // Build update data — only include fields that were provided
      const updateData: Record<string, unknown> = {
        summaryUpdatedAt: new Date(),
      };

      if (oneLiner !== undefined) {
        updateData.oneLiner = oneLiner || null;
      }
      if (summary !== undefined) {
        updateData.summary = summary || null;
      }

      // Only set summaryUpdatedAt if at least one summary field was provided
      if (oneLiner === undefined && summary === undefined) {
        return successResponse({
          oneLiner: null,
          summary: null,
          summaryUpdatedAt: null,
        });
      }

      const updated = await prisma.page.update({
        where: { id: pageId },
        data: updateData,
        select: {
          oneLiner: true,
          summary: true,
          summaryUpdatedAt: true,
        },
      });

      return successResponse({
        oneLiner: updated.oneLiner,
        summary: updated.summary,
        summaryUpdatedAt: updated.summaryUpdatedAt?.toISOString() ?? null,
      });
    } catch (error) {
      console.error("Failed to update page summary:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Failed to update page summary",
        undefined,
        500
      );
    }
  }
);
