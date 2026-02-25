import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withAgentAuth } from "@/lib/agent/auth";
import type { AgentContext } from "@/lib/agent/auth";
import { successResponse, errorResponse } from "@/lib/apiResponse";

interface TreeNode {
  id: string;
  title: string;
  icon: string | null;
  children: TreeNode[];
}

/**
 * GET /api/agent/pages/tree — Full page hierarchy as a nested tree
 */
export const GET = withAgentAuth(
  async (_req: NextRequest, ctx: AgentContext) => {
    try {
      const pages = await prisma.page.findMany({
        where: { tenantId: ctx.tenantId },
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          icon: true,
          parentId: true,
          position: true,
        },
      });

      const tree = buildTree(pages);
      return successResponse(tree);
    } catch (error) {
      console.error("GET /api/agent/pages/tree error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);

function buildTree(
  pages: Array<{
    id: string;
    title: string;
    icon: string | null;
    parentId: string | null;
  }>
): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  // First pass: create nodes
  for (const p of pages) {
    map.set(p.id, { id: p.id, title: p.title, icon: p.icon, children: [] });
  }

  // Second pass: attach children to parents
  for (const p of pages) {
    const node = map.get(p.id)!;
    if (p.parentId && map.has(p.parentId)) {
      map.get(p.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
