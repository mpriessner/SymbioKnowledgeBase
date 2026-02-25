import { NextRequest } from "next/server";
import { withTenant } from "@/lib/auth/withTenant";
import { prisma } from "@/lib/db";
import { successResponse } from "@/lib/apiResponse";
import type { TenantContext } from "@/types/auth";

/** GET /api/favorites — List all favorite pages for the current user */
export const GET = withTenant(
  async (req: NextRequest, ctx: TenantContext) => {
    const favorites = await prisma.pageFavorite.findMany({
      where: { userId: ctx.userId, tenantId: ctx.tenantId },
      include: {
        page: { select: { id: true, title: true, icon: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return successResponse(
      favorites.map((f) => ({
        id: f.id,
        page_id: f.page.id,
        title: f.page.title,
        icon: f.page.icon,
        favorite_at: f.createdAt.toISOString(),
      }))
    );
  }
);
