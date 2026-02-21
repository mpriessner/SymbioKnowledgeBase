import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import {
  successResponse,
  listResponse,
  errorResponse,
} from "@/lib/apiResponse";
import {
  createPageSchema,
  listPagesQuerySchema,
} from "@/lib/validation/pages";
import { resolveUnresolvedLinksForNewPage } from "@/lib/wikilinks/resolver";
import type { TenantContext } from "@/types/auth";
import { serializePage } from "@/lib/pages/serialize";

export const GET = withTenant(
  async (req: NextRequest, context: TenantContext) => {
    try {
      const { searchParams } = new URL(req.url);
      const queryParams: Record<string, string | null> =
        Object.fromEntries(searchParams.entries());

      // Handle parentId=null as literal null filter
      const rawParentId = searchParams.get("parentId");
      if (rawParentId === "null") {
        queryParams.parentId = null;
      }

      const parsed = listPagesQuerySchema.safeParse(queryParams);
      if (!parsed.success) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Invalid query parameters",
          undefined,
          400
        );
      }

      const { limit, offset, sortBy, order, parentId } = parsed.data;

      const where: Record<string, unknown> = {
        tenantId: context.tenantId,
      };

      // Filter by parentId: if explicitly provided, filter by it
      // parentId=null means root pages only
      if (parentId !== undefined) {
        where.parentId = parentId;
      }

      const [pages, total] = await Promise.all([
        prisma.page.findMany({
          where,
          orderBy: { [sortBy]: order },
          skip: offset,
          take: limit,
        }),
        prisma.page.count({ where }),
      ]);

      const serializedPages = pages.map(serializePage);

      return listResponse(serializedPages, total, limit, offset);
    } catch (error) {
      console.error("GET /api/pages error:", error);
      return errorResponse("INTERNAL_ERROR", "Internal server error", undefined, 500);
    }
  }
);

export const POST = withTenant(
  async (req: NextRequest, context: TenantContext) => {
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

      const { title, parentId, icon, coverUrl } = parsed.data;

      // If parentId is provided, verify the parent exists and belongs to this tenant
      if (parentId) {
        const parentPage = await prisma.page.findFirst({
          where: { id: parentId, tenantId: context.tenantId },
        });
        if (!parentPage) {
          return errorResponse("NOT_FOUND", "Parent page not found", undefined, 404);
        }
      }

      // Calculate the next position among siblings
      const maxPosition = await prisma.page.aggregate({
        where: {
          tenantId: context.tenantId,
          parentId: parentId,
        },
        _max: { position: true },
      });
      const nextPosition = (maxPosition._max.position ?? -1) + 1;

      const page = await prisma.page.create({
        data: {
          tenantId: context.tenantId,
          parentId: parentId,
          title,
          icon,
          coverUrl: coverUrl,
          position: nextPosition,
        },
      });

      // Resolve any unresolved wikilinks that reference this new page
      await resolveUnresolvedLinksForNewPage(
        page.id,
        page.title,
        context.tenantId
      );

      return successResponse(serializePage(page), undefined, 201);
    } catch (error) {
      console.error("POST /api/pages error:", error);
      return errorResponse("INTERNAL_ERROR", "Internal server error", undefined, 500);
    }
  }
);
