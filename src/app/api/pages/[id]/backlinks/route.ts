import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import type { TenantContext } from "@/types/auth";

/**
 * GET /api/pages/[id]/backlinks
 *
 * Returns all pages that link TO the specified page (incoming links / backlinks).
 * Queries the page_links table where targetPageId matches the given page ID,
 * then joins the pages table to get source page metadata.
 */
export const GET = withTenant(
  async (
    req: NextRequest,
    ctx: TenantContext,
    routeContext: { params: Promise<Record<string, string>> }
  ) => {
    const { id: pageId } = await routeContext.params;

    try {
      // Verify the target page exists and belongs to this tenant
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

      // Query backlinks: pages that link TO this page
      const backlinks = await prisma.pageLink.findMany({
        where: {
          targetPageId: pageId,
          tenantId: ctx.tenantId,
        },
        include: {
          sourcePage: {
            select: {
              id: true,
              title: true,
              icon: true,
              oneLiner: true,
              summary: true,
              summaryUpdatedAt: true,
            },
          },
        },
        orderBy: {
          sourcePage: {
            title: "asc",
          },
        },
      });

      // Deduplicate by source page (in case of multiple links from same page)
      const seenPageIds = new Set<string>();
      const uniqueBacklinks: Array<{
        pageId: string;
        pageTitle: string;
        pageIcon: string | null;
        oneLiner: string | null;
        summary: string | null;
        summaryUpdatedAt: string | null;
      }> = [];

      for (const link of backlinks) {
        if (!seenPageIds.has(link.sourcePage.id)) {
          seenPageIds.add(link.sourcePage.id);
          uniqueBacklinks.push({
            pageId: link.sourcePage.id,
            pageTitle: link.sourcePage.title,
            pageIcon: link.sourcePage.icon,
            oneLiner: link.sourcePage.oneLiner,
            summary: link.sourcePage.summary,
            summaryUpdatedAt: link.sourcePage.summaryUpdatedAt?.toISOString() ?? null,
          });
        }
      }

      return successResponse(uniqueBacklinks, {
        total: uniqueBacklinks.length,
      });
    } catch (error) {
      console.error("Failed to fetch backlinks:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Failed to fetch backlinks",
        undefined,
        500
      );
    }
  }
);
