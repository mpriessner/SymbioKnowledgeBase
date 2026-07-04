import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { listResponse, errorResponse } from "@/lib/apiResponse";
import type { TenantContext } from "@/types/auth";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Resolve the chemistry Archive folder id for a tenant, READ-ONLY.
 *
 * We must not call `setupChemistryKbHierarchy` here — it creates the whole
 * hierarchy as a side effect, which is wrong for a list endpoint. Archive is
 * the "Archive" page directly under the root "Chemistry KB" page; if the
 * hierarchy doesn't exist we simply skip the exclusion.
 */
async function findArchiveFolderId(tenantId: string): Promise<string | null> {
  const root = await prisma.page.findFirst({
    where: { tenantId, title: "Chemistry KB", parentId: null },
    select: { id: true },
  });
  if (!root) return null;

  const archive = await prisma.page.findFirst({
    where: { tenantId, title: "Archive", parentId: root.id },
    select: { id: true },
  });
  return archive?.id ?? null;
}

/**
 * GET /api/pages/trash
 * Lists the tenant's soft-deleted (trashed) pages, newest-deleted first,
 * paginated. Excludes chemistry Archive-folder pages (a separate mechanism).
 */
export const GET = withTenant(
  async (req: NextRequest, context: TenantContext) => {
    try {
      const { searchParams } = new URL(req.url);

      const rawLimit = Number(searchParams.get("limit"));
      const rawOffset = Number(searchParams.get("offset"));
      const limit =
        Number.isFinite(rawLimit) && rawLimit > 0
          ? Math.min(Math.floor(rawLimit), MAX_LIMIT)
          : DEFAULT_LIMIT;
      const offset =
        Number.isFinite(rawOffset) && rawOffset > 0
          ? Math.floor(rawOffset)
          : 0;

      const archiveFolderId = await findArchiveFolderId(context.tenantId);

      const where = {
        tenantId: context.tenantId,
        deletedAt: { not: null },
        ...(archiveFolderId
          ? { parentId: { not: archiveFolderId } }
          : {}),
      };

      const [pages, total] = await Promise.all([
        prisma.page.findMany({
          where,
          orderBy: { deletedAt: "desc" },
          skip: offset,
          take: limit,
          select: {
            id: true,
            title: true,
            icon: true,
            deletedAt: true,
            parentId: true,
            parent: { select: { id: true, title: true } },
          },
        }),
        prisma.page.count({ where }),
      ]);

      const data = pages.map((p) => ({
        id: p.id,
        title: p.title,
        icon: p.icon,
        deletedAt: p.deletedAt?.toISOString() ?? null,
        parentId: p.parentId,
        parentTitle: p.parent?.title ?? null,
      }));

      return listResponse(data, total, limit, offset);
    } catch (error) {
      console.error("GET /api/pages/trash error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);
