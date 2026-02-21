import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import type { TenantContext } from "@/types/auth";

/**
 * GET /api/pages/[id]/links
 *
 * Returns all pages that the specified page links TO (outgoing / forward links).
 * Queries the page_links table where sourcePageId matches the given page ID.
 */
export const GET = withTenant(
  async (
    req: NextRequest,
    ctx: TenantContext,
    routeContext: { params: Promise<Record<string, string>> }
  ) => {
    const { id: pageId } = await routeContext.params;

    try {
      // Verify the source page exists and belongs to this tenant
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

      // Query forward links: pages that this page links TO
      const forwardLinks = await prisma.pageLink.findMany({
        where: {
          sourcePageId: pageId,
          tenantId: ctx.tenantId,
        },
        include: {
          targetPage: {
            select: {
              id: true,
              title: true,
              icon: true,
            },
          },
        },
        orderBy: {
          targetPage: {
            title: "asc",
          },
        },
      });

      const results = forwardLinks.map((link) => ({
        pageId: link.targetPage.id,
        pageTitle: link.targetPage.title,
        pageIcon: link.targetPage.icon,
      }));

      return successResponse(results, {
        total: results.length,
      });
    } catch (error) {
      console.error("Failed to fetch forward links:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Failed to fetch forward links",
        undefined,
        500
      );
    }
  }
);
