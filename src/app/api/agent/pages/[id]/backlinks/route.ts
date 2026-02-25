import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withAgentAuth } from "@/lib/agent/auth";
import type { AgentContext } from "@/lib/agent/auth";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { z } from "zod";

type RouteContext = { params: Promise<Record<string, string>> };

/**
 * GET /api/agent/pages/:id/backlinks — List pages that link TO this page
 */
export const GET = withAgentAuth(
  async (req: NextRequest, ctx: AgentContext, routeContext: RouteContext) => {
    try {
      const { id } = await routeContext.params;

      // Validate UUID
      if (!z.string().uuid().safeParse(id).success) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Invalid page ID",
          undefined,
          400
        );
      }

      // Verify page exists and belongs to tenant
      const page = await prisma.page.findFirst({
        where: { id, tenantId: ctx.tenantId },
      });

      if (!page) {
        return errorResponse("NOT_FOUND", "Page not found", undefined, 404);
      }

      // Get all pages that link TO this page
      const links = await prisma.pageLink.findMany({
        where: { targetPageId: id, tenantId: ctx.tenantId },
        include: {
          sourcePage: {
            select: { id: true, title: true, icon: true },
          },
        },
      });

      const backlinks = links.map((link) => ({
        id: link.sourcePage.id,
        title: link.sourcePage.title,
        icon: link.sourcePage.icon,
      }));

      // Sort alphabetically by title
      backlinks.sort((a, b) => a.title.localeCompare(b.title));

      return successResponse(backlinks, { total: backlinks.length });
    } catch (error) {
      console.error("GET /api/agent/pages/:id/backlinks error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);
