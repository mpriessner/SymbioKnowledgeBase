import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withAgentAuth } from "@/lib/agent/auth";
import type { AgentContext } from "@/lib/agent/auth";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { tiptapToMarkdown } from "@/lib/agent/markdown";
import { z } from "zod";

type RouteContext = { params: Promise<Record<string, string>> };

/**
 * GET /api/agent/pages/:id/context — Comprehensive page context in one call
 *
 * Returns page content, parent, children, outgoing links, backlinks,
 * and local graph neighborhood.
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

      // Run all queries in parallel
      const [block, parent, children, outgoingLinks, backlinks] =
        await Promise.all([
          // Page content (DOCUMENT block)
          prisma.block.findFirst({
            where: {
              pageId: id,
              tenantId: ctx.tenantId,
              type: "DOCUMENT",
              deletedAt: null,
            },
          }),
          // Parent page
          page.parentId
            ? prisma.page.findFirst({
                where: { id: page.parentId, tenantId: ctx.tenantId },
                select: { id: true, title: true, icon: true },
              })
            : null,
          // Child pages
          prisma.page.findMany({
            where: { parentId: id, tenantId: ctx.tenantId },
            select: { id: true, title: true, icon: true },
            orderBy: { position: "asc" },
          }),
          // Outgoing links
          prisma.pageLink.findMany({
            where: { sourcePageId: id, tenantId: ctx.tenantId },
            include: {
              targetPage: {
                select: { id: true, title: true, icon: true },
              },
            },
          }),
          // Backlinks
          prisma.pageLink.findMany({
            where: { targetPageId: id, tenantId: ctx.tenantId },
            include: {
              sourcePage: {
                select: { id: true, title: true, icon: true },
              },
            },
          }),
        ]);

      const markdown = block ? tiptapToMarkdown(block.content) : "";

      return successResponse({
        page: {
          id: page.id,
          title: page.title,
          icon: page.icon,
          parent_id: page.parentId,
          created_at: page.createdAt.toISOString(),
          updated_at: page.updatedAt.toISOString(),
        },
        markdown,
        parent: parent
          ? { id: parent.id, title: parent.title, icon: parent.icon }
          : null,
        children: children.map((c) => ({
          id: c.id,
          title: c.title,
          icon: c.icon,
        })),
        outgoing_links: outgoingLinks.map((l) => ({
          id: l.targetPage.id,
          title: l.targetPage.title,
          icon: l.targetPage.icon,
        })),
        backlinks: backlinks.map((l) => ({
          id: l.sourcePage.id,
          title: l.sourcePage.title,
          icon: l.sourcePage.icon,
        })),
      });
    } catch (error) {
      console.error("GET /api/agent/pages/:id/context error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);
