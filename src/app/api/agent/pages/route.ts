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
import { processAgentWikilinks } from "@/lib/agent/wikilinks";
import {
  buildAgentPageTree,
  buildFlatList,
  computeTreeMeta,
} from "@/lib/agent/pageTree";
import type { PageWithCounts } from "@/lib/agent/types";
import { z } from "zod";

const listPagesQuerySchema = z.object({
  format: z.enum(["tree", "flat", "list"]).default("list"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  parent_id: z.string().uuid().optional(),
  search: z.string().optional(),
  spaceType: z.string().optional(),
  staleOnly: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  noSummary: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

const createPageSchema = z.object({
  title: z.string().min(1).max(255),
  markdown: z.string().optional(),
  parent_id: z.string().uuid().optional(),
  icon: z.string().optional(),
});

/**
 * GET /api/agent/pages — List pages with pagination, tree, or flat format
 *
 * Query params:
 *   format=list (default) — paginated list (legacy behavior)
 *   format=tree — nested tree structure with summaries
 *   format=flat — flat list in tree order with depth/path
 *   spaceType=PRIVATE|TEAMSPACE — filter by space type
 *   staleOnly=true — only pages with stale summaries
 *   noSummary=true — only pages with null oneLiner
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

      const { format, limit, offset, parent_id, search, spaceType, staleOnly, noSummary } =
        parsed.data;

      // Tree and flat formats: return enriched data with summaries
      if (format === "tree" || format === "flat") {
        return handleTreeOrFlat(ctx, format, { spaceType, staleOnly, noSummary, limit, offset });
      }

      // Legacy list format
      const where: Record<string, unknown> = { tenantId: ctx.tenantId };
      if (parent_id) where.parentId = parent_id;
      if (search) where.title = { contains: search, mode: "insensitive" };
      if (spaceType) where.spaceType = spaceType;

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
 * Handle format=tree or format=flat requests.
 */
async function handleTreeOrFlat(
  ctx: AgentContext,
  format: "tree" | "flat",
  filters: {
    spaceType?: string;
    staleOnly?: boolean;
    noSummary?: boolean;
    limit: number;
    offset: number;
  }
) {
  const where: Record<string, unknown> = { tenantId: ctx.tenantId };
  if (filters.spaceType) where.spaceType = filters.spaceType;
  if (filters.noSummary) where.oneLiner = null;

  const pages = await prisma.page.findMany({
    where,
    select: {
      id: true,
      title: true,
      icon: true,
      oneLiner: true,
      parentId: true,
      position: true,
      spaceType: true,
      updatedAt: true,
      summaryUpdatedAt: true,
      _count: {
        select: {
          sourceLinks: true,
          targetLinks: true,
        },
      },
    },
    orderBy: { position: "asc" },
  });

  let filtered: PageWithCounts[] = pages;

  // Post-query filter for staleOnly (requires comparing dates)
  if (filters.staleOnly) {
    filtered = filtered.filter((p) => {
      if (!p.summaryUpdatedAt) return true;
      return p.updatedAt > p.summaryUpdatedAt;
    });
  }

  const meta = computeTreeMeta(filtered);

  if (format === "tree") {
    const tree = buildAgentPageTree(filtered);
    return successResponse({ pages: tree }, { ...meta });
  }

  // Flat format with pagination
  const allFlat = buildFlatList(filtered);
  const paginated = allFlat.slice(filters.offset, filters.offset + filters.limit);

  return successResponse(
    { pages: paginated },
    {
      ...meta,
      total: allFlat.length,
      limit: filters.limit,
      offset: filters.offset,
      hasMore: filters.offset + filters.limit < allFlat.length,
    }
  );
}

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

        // Process wikilinks — create PageLink records for [[references]]
        await processAgentWikilinks(page.id, ctx.tenantId, tiptap);
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
