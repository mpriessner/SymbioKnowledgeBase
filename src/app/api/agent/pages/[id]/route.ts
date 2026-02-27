import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withAgentAuth } from "@/lib/agent/auth";
import type { AgentContext } from "@/lib/agent/auth";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { tiptapToMarkdown, markdownToTiptap } from "@/lib/agent/markdown";
import { processAgentWikilinks } from "@/lib/agent/wikilinks";
import { generatePagePath } from "@/lib/agent/pageTree";
import { z } from "zod";

const updatePageSchema = z.object({
  markdown: z.string(),
});

type RouteContext = { params: Promise<Record<string, string>> };

/**
 * DELETE /api/agent/pages/:id — Delete a page
 */
export const DELETE = withAgentAuth(
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

      // Check page exists and belongs to tenant
      const page = await prisma.page.findFirst({
        where: { id, tenantId: ctx.tenantId },
      });

      if (!page) {
        return errorResponse("NOT_FOUND", "Page not found", undefined, 404);
      }

      // Transaction: delete links, blocks, orphan children, then page
      await prisma.$transaction([
        prisma.pageLink.deleteMany({
          where: {
            OR: [{ sourcePageId: id }, { targetPageId: id }],
            tenantId: ctx.tenantId,
          },
        }),
        prisma.block.deleteMany({
          where: { pageId: id, tenantId: ctx.tenantId },
        }),
        prisma.page.updateMany({
          where: { parentId: id, tenantId: ctx.tenantId },
          data: { parentId: null },
        }),
        prisma.page.delete({ where: { id } }),
      ]);

      return successResponse({
        id,
        deleted_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error("DELETE /api/agent/pages/:id error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);

/**
 * GET /api/agent/pages/:id — Read page with detail
 *
 * Returns page markdown content plus enriched metadata:
 * - summary fields (oneLiner, summary, summaryUpdatedAt)
 * - breadcrumb path (/Parent/Child/Page)
 * - outgoing and incoming links with one-liners
 * - child count
 */
export const GET = withAgentAuth(
  async (req: NextRequest, ctx: AgentContext, routeContext: RouteContext) => {
    try {
      const { id } = await routeContext.params;

      const page = await prisma.page.findFirst({
        where: { id, tenantId: ctx.tenantId },
        include: {
          _count: {
            select: { children: true },
          },
        },
      });

      if (!page) {
        return errorResponse("NOT_FOUND", "Page not found", undefined, 404);
      }

      // Fetch markdown, links, and path data in parallel
      const [block, outgoingLinks, incomingLinks, allPages] = await Promise.all([
        prisma.block.findFirst({
          where: {
            pageId: id,
            tenantId: ctx.tenantId,
            type: "DOCUMENT",
            deletedAt: null,
          },
        }),
        prisma.pageLink.findMany({
          where: { sourcePageId: id, tenantId: ctx.tenantId },
          include: {
            targetPage: {
              select: { id: true, title: true, oneLiner: true },
            },
          },
        }),
        prisma.pageLink.findMany({
          where: { targetPageId: id, tenantId: ctx.tenantId },
          include: {
            sourcePage: {
              select: { id: true, title: true, oneLiner: true },
            },
          },
        }),
        prisma.page.findMany({
          where: { tenantId: ctx.tenantId },
          select: { id: true, title: true, parentId: true },
        }),
      ]);

      let markdown = "";
      if (block) {
        markdown = tiptapToMarkdown(block.content);
      }

      // Build path
      const pagesById = new Map(allPages.map((p) => [p.id, p]));
      const pagePath = generatePagePath(id, pagesById);

      return successResponse({
        id: page.id,
        title: page.title,
        icon: page.icon,
        oneLiner: page.oneLiner,
        summary: page.summary,
        summaryUpdatedAt: page.summaryUpdatedAt?.toISOString() ?? null,
        path: pagePath,
        parent_id: page.parentId,
        childCount: page._count.children,
        outgoingLinks: outgoingLinks.map((l) => ({
          pageId: l.targetPage.id,
          title: l.targetPage.title,
          oneLiner: l.targetPage.oneLiner,
        })),
        incomingLinks: incomingLinks.map((l) => ({
          pageId: l.sourcePage.id,
          title: l.sourcePage.title,
          oneLiner: l.sourcePage.oneLiner,
        })),
        markdown,
        created_at: page.createdAt.toISOString(),
        updated_at: page.updatedAt.toISOString(),
      });
    } catch (error) {
      console.error("GET /api/agent/pages/:id error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);

/**
 * PUT /api/agent/pages/:id — Update page markdown
 */
export const PUT = withAgentAuth(
  async (req: NextRequest, ctx: AgentContext, routeContext: RouteContext) => {
    try {
      const { id } = await routeContext.params;
      const body = await req.json();
      const parsed = updatePageSchema.safeParse(body);

      if (!parsed.success) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Invalid request body",
          undefined,
          400
        );
      }

      const { markdown } = parsed.data;

      // Verify page exists
      const page = await prisma.page.findFirst({
        where: { id, tenantId: ctx.tenantId },
      });

      if (!page) {
        return errorResponse("NOT_FOUND", "Page not found", undefined, 404);
      }

      // Convert markdown to TipTap JSON
      const tiptap = markdownToTiptap(markdown);

      // Find existing DOCUMENT block
      const existing = await prisma.block.findFirst({
        where: {
          pageId: id,
          tenantId: ctx.tenantId,
          type: "DOCUMENT",
          deletedAt: null,
        },
      });

      if (existing) {
        await prisma.block.update({
          where: { id: existing.id },
          data: { content: tiptap ?? {} },
        });
      } else {
        await prisma.block.create({
          data: {
            tenantId: ctx.tenantId,
            pageId: id,
            type: "DOCUMENT",
            content: tiptap ?? {},
            position: 0,
          },
        });
      }

      // Process wikilinks — sync PageLink records for [[references]]
      await processAgentWikilinks(id, ctx.tenantId, tiptap);

      // Trigger updatedAt on page
      const updatedPage = await prisma.page.update({
        where: { id },
        data: { updatedAt: new Date() },
      });

      return successResponse({
        id: updatedPage.id,
        updated_at: updatedPage.updatedAt.toISOString(),
      });
    } catch (error) {
      console.error("PUT /api/agent/pages/:id error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);
