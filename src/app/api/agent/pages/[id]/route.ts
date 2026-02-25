import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withAgentAuth } from "@/lib/agent/auth";
import type { AgentContext } from "@/lib/agent/auth";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { tiptapToMarkdown, markdownToTiptap } from "@/lib/agent/markdown";
import { processAgentWikilinks } from "@/lib/agent/wikilinks";
import { z } from "zod";

const updatePageSchema = z.object({
  markdown: z.string(),
});

type RouteContext = { params: Promise<Record<string, string>> };

/**
 * GET /api/agent/pages/:id — Read page as markdown
 */
export const GET = withAgentAuth(
  async (req: NextRequest, ctx: AgentContext, routeContext: RouteContext) => {
    try {
      const { id } = await routeContext.params;

      const page = await prisma.page.findFirst({
        where: { id, tenantId: ctx.tenantId },
      });

      if (!page) {
        return errorResponse("NOT_FOUND", "Page not found", undefined, 404);
      }

      // Find DOCUMENT block
      const block = await prisma.block.findFirst({
        where: {
          pageId: id,
          tenantId: ctx.tenantId,
          type: "DOCUMENT",
          deletedAt: null,
        },
      });

      let markdown = "";
      if (block) {
        markdown = tiptapToMarkdown(block.content);
      }

      return successResponse({
        id: page.id,
        title: page.title,
        icon: page.icon,
        parent_id: page.parentId,
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
