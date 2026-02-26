import { NextRequest } from "next/server";
import { withAgentAuth } from "@/lib/agent/auth";
import type { AgentContext } from "@/lib/agent/auth";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import {
  listMirrorFiles,
  getMirrorTree,
  searchMirrorFiles,
} from "@/lib/sync/mirrorOps";
import { z } from "zod";

const listQuerySchema = z.object({
  path: z.string().default(""),
  tree: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  search: z.string().optional(),
  max_results: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * GET /api/agent/mirror — Browse the filesystem mirror.
 *
 * Query params:
 *   path: subdirectory to list (default: root)
 *   tree: if "true", return recursive tree structure
 *   search: search query to find across all .md files
 *   max_results: max search results (default 20)
 */
export const GET = withAgentAuth(
  async (req: NextRequest, ctx: AgentContext) => {
    const { searchParams } = new URL(req.url);
    const parsed = listQuerySchema.safeParse(
      Object.fromEntries(searchParams.entries())
    );

    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid query parameters",
        undefined,
        400
      );
    }

    const { path: subPath, tree, search, max_results } = parsed.data;

    // Search mode
    if (search) {
      const results = await searchMirrorFiles(
        ctx.tenantId,
        search,
        max_results
      );
      return successResponse(results, {
        query: search,
        total: results.length,
      });
    }

    // Tree mode
    if (tree) {
      const treeData = await getMirrorTree(ctx.tenantId);
      return successResponse(treeData);
    }

    // List mode (default)
    const files = await listMirrorFiles(ctx.tenantId, subPath);
    return successResponse(files, { path: subPath || "/" });
  }
);
