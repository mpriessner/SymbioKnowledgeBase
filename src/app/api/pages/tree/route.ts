import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { getPageTree } from "@/lib/pages/getPageTree";
import type { PageTreeNode } from "@/types/page";
import type { TenantContext } from "@/types/auth";

/**
 * Remove soft-deleted pages (and their entire subtrees) from a page tree.
 *
 * Page DELETE now soft-deletes (stamps `deletedAt`) instead of hard-deleting,
 * and `getPageTree` returns ALL rows — so without this prune a deleted page
 * would still appear in the sidebar tree. We drop any node whose id is in the
 * deleted set; because the tree is already nested, dropping a node also drops
 * its descendants (so a deleted parent can't leak its children back as roots).
 */
function pruneDeleted(
  nodes: PageTreeNode[],
  deletedIds: Set<string>
): PageTreeNode[] {
  const result: PageTreeNode[] = [];
  for (const node of nodes) {
    if (deletedIds.has(node.id)) continue;
    result.push({
      ...node,
      children: pruneDeleted(node.children, deletedIds),
    });
  }
  return result;
}

export const GET = withTenant(
  async (_req: NextRequest, context: TenantContext) => {
    try {
      const tree = await getPageTree(context.tenantId);

      // Resolve the soft-deleted set as a best-effort step: if it fails, show
      // the full tree rather than 500ing the sidebar.
      let deletedIds = new Set<string>();
      try {
        const deletedPages = await prisma.page.findMany({
          where: { tenantId: context.tenantId, deletedAt: { not: null } },
          select: { id: true },
        });
        deletedIds = new Set(deletedPages.map((p) => p.id));
      } catch (filterError) {
        console.error("Soft-delete filter on page tree failed:", filterError);
      }

      const visibleTree =
        deletedIds.size > 0 ? pruneDeleted(tree, deletedIds) : tree;

      return successResponse(visibleTree);
    } catch (error) {
      console.error("GET /api/pages/tree error:", error);
      return errorResponse("INTERNAL_ERROR", "Internal server error", undefined, 500);
    }
  }
);
