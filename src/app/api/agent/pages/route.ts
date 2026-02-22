import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withAgentAuth } from "@/lib/agent/auth";
import type { AgentContext } from "@/lib/agent/auth";
import {
  successResponse,
  listResponse,
  errorResponse,
} from "@/lib/apiResponse";
import { markdownToTiptap } from "@/lib/agent/markdown";
import { z } from "zod";

const listPagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  parent_id: z.string().uuid().optional(),
  search: z.string().optional(),
});

const createPageSchema = z.object({
  title: z.string().min(1).max(255),
  markdown: z.string().optional(),
  parent_id: z.string().uuid().optional(),
  icon: z.string().optional(),
});

/**
 * GET /api/agent/pages — List pages with pagination
 */
export const GET = withAgentAuth(
  async (req: NextRequest, ctx: AgentContext) => {
    try {
      const { searchParams } = new URL(req.url);
      const queryParams = Object.fromEntries(searchParams.entries());

      const parsed = listPagesQuerySchema.safeParse(queryParams);
      if (!parsed.success) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Invalid query parameters",
          undefined,
          400
        );
      }

      const { limit, offset, parent_id, search } = parsed.data;

      const where: {
        tenantId: string;
        parentId?: string;
        title?: { contains: string; mode: "insensitive" };
      } = { tenantId: ctx.tenantId };
      if (parent_id) where.parentId = parent_id;
      if (search) where.title = { contains: search, mode: "insensitive" };

      const [pages, total] = await Promise.all([
        prisma.page.findMany({
          where,
          select: {
            id: true,
            title: true,
            icon: true,
            parentId: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: "desc" },
          skip: offset,
          take: limit,
        }),
        prisma.page.count({ where }),
      ]);

      return listResponse(
        pages.map((p) => ({
          id: p.id,
          title: p.title,
          icon: p.icon,
          parent_id: p.parentId,
          created_at: p.createdAt.toISOString(),
          updated_at: p.updatedAt.toISOString(),
        })),
        total,
        limit,
        offset
      );
    } catch (error) {
      console.error("GET /api/agent/pages error:", error);
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
 * POST /api/agent/pages — Create page from markdown
 */
export const POST = withAgentAuth(
  async (req: NextRequest, ctx: AgentContext) => {
    try {
      const body = await req.json();
      const parsed = createPageSchema.safeParse(body);

      if (!parsed.success) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Invalid request body",
          undefined,
          400
        );
      }

      const { title, markdown, parent_id, icon } = parsed.data;

      // Verify parent exists if provided
      if (parent_id) {
        const parent = await prisma.page.findFirst({
          where: { id: parent_id, tenantId: ctx.tenantId },
        });
        if (!parent) {
          return errorResponse(
            "NOT_FOUND",
            "Parent page not found",
            undefined,
            404
          );
        }
      }

      // Calculate position
      const maxPosition = await prisma.page.aggregate({
        where: {
          tenantId: ctx.tenantId,
          parentId: parent_id ?? null,
        },
        _max: { position: true },
      });
      const nextPosition = (maxPosition._max.position ?? -1) + 1;

      // Create page
      const page = await prisma.page.create({
        data: {
          tenantId: ctx.tenantId,
          title,
          icon: icon ?? null,
          parentId: parent_id ?? null,
          position: nextPosition,
        },
      });

      // Create DOCUMENT block if markdown provided
      if (markdown) {
        const tiptap = markdownToTiptap(markdown);
        await prisma.block.create({
          data: {
            tenantId: ctx.tenantId,
            pageId: page.id,
            type: "DOCUMENT",
            content: tiptap ?? {},
            position: 0,
          },
        });
      }

      return successResponse(
        {
          id: page.id,
          title: page.title,
          created_at: page.createdAt.toISOString(),
        },
        undefined,
        201
      );
    } catch (error) {
      console.error("POST /api/agent/pages error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);
