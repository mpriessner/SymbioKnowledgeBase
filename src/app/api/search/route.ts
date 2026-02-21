import { NextRequest } from "next/server";
import { withTenant } from "@/lib/auth/withTenant";
import { searchBlocks } from "@/lib/search/query";
import { listResponse, errorResponse } from "@/lib/apiResponse";
import { SearchQuerySchema } from "@/types/search";
import type { TenantContext } from "@/types/auth";

/**
 * GET /api/search?q=term&limit=20&offset=0
 *
 * Full-text search across all block content within the authenticated tenant.
 *
 * Uses PostgreSQL tsvector/tsquery for relevance-ranked search with snippets.
 * Results are grouped by page — at most one result per page, using the
 * highest-ranked matching block.
 *
 * Query parameters:
 * - q (required): Search query string, 1-500 characters
 * - limit (optional): Max results, 1-100, default 20
 * - offset (optional): Pagination offset, >= 0, default 0
 *
 * Returns:
 * - 200: Search results with snippets and relevance scores
 * - 400: Invalid query parameters
 * - 401: Not authenticated
 */
export const GET = withTenant(
  async (req: NextRequest, ctx: TenantContext) => {
    const { searchParams } = new URL(req.url);

    // Parse and validate query parameters
    // Use ?? undefined so Zod .default() can apply when params are absent
    const parseResult = SearchQuerySchema.safeParse({
      q: searchParams.get("q"),
      limit: searchParams.get("limit") ?? undefined,
      offset: searchParams.get("offset") ?? undefined,
    });

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0];
      return errorResponse(
        "VALIDATION_ERROR",
        firstError?.message || "Invalid query parameters",
        undefined,
        400
      );
    }

    const { q, limit, offset } = parseResult.data;

    try {
      // Execute the search
      const searchResults = await searchBlocks(q, ctx.tenantId, limit, offset);

      // Map to API response format
      const data = searchResults.results.map((result) => ({
        pageId: result.pageId,
        pageTitle: result.pageTitle,
        pageIcon: result.pageIcon,
        snippet: result.snippet,
        score: Math.round(result.rank * 100) / 100,
      }));

      return listResponse(data, searchResults.total, limit, offset);
    } catch (error) {
      console.error("Search failed:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Search failed",
        undefined,
        500
      );
    }
  }
);
