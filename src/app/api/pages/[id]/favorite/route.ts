import { NextRequest } from "next/server";
import { withTenant } from "@/lib/auth/withTenant";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import type { TenantContext } from "@/types/auth";

/** POST /api/pages/[id]/favorite — Toggle favorite status */
export const POST = withTenant(
  async (
    req: NextRequest,
    ctx: TenantContext,
    { params }: { params: Promise<Record<string, string>> }
  ) => {
    const { id: pageId } = await params;
    const body = await req.json();
    const isFavorite = Boolean(body.isFavorite);

    // Verify page exists in tenant
    const page = await prisma.page.findFirst({
      where: { id: pageId, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!page) {
      return errorResponse("NOT_FOUND", "Page not found", undefined, 404);
    }

    if (isFavorite) {
      await prisma.pageFavorite.upsert({
        where: {
          userId_pageId: { userId: ctx.userId, pageId },
        },
        create: {
          userId: ctx.userId,
          pageId,
          tenantId: ctx.tenantId,
        },
        update: {},
      });
    } else {
      await prisma.pageFavorite.deleteMany({
        where: { userId: ctx.userId, pageId },
      });
    }

    return successResponse({ page_id: pageId, is_favorite: isFavorite });
  }
);
