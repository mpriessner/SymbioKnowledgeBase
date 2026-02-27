import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withAgentAuth } from "@/lib/agent/auth";
import type { AgentContext } from "@/lib/agent/auth";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { z } from "zod";

type RouteContext = { params: Promise<Record<string, string>> };

/**
 * GET /api/agent/pages/:id/links — Outgoing links from this page
 */
export const GET = withAgentAuth(
  async (_req: NextRequest, ctx: AgentContext, routeContext: RouteContext) => {
    try {
      const { id } = await routeContext.params;

      if (!z.string().uuid().safeParse(id).success) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Invalid page ID",
          undefined,
          400
        );
      }

      // Verify page exists
      const page = await prisma.page.findFirst({
        where: { id, tenantId: ctx.tenantId },
      });

      if (!page) {
        return errorResponse("NOT_FOUND", "Page not found", undefined, 404);
      }

      // Get outgoing links (pages this page links TO)
      const links = await prisma.pageLink.findMany({
        where: { sourcePageId: id, tenantId: ctx.tenantId },
        include: {
          targetPage: {
            select: { id: true, title: true, icon: true, oneLiner: true },
          },
        },
      });

      const outgoing = links.map((link) => ({
        id: link.targetPage.id,
        title: link.targetPage.title,
        icon: link.targetPage.icon,
        oneLiner: link.targetPage.oneLiner,
      }));

      // Sort alphabetically
      outgoing.sort((a, b) => a.title.localeCompare(b.title));

      return successResponse(outgoing, { total: outgoing.length });
    } catch (error) {
      console.error("GET /api/agent/pages/:id/links error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);
