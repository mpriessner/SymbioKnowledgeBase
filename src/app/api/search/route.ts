import { NextRequest } from "next/server";
import { withTenant } from "@/lib/auth/withTenant";
import { enhancedSearchBlocks } from "@/lib/search/query";
import { listResponse, errorResponse } from "@/lib/apiResponse";
import { SearchQuerySchema } from "@/types/search";
import type { TenantContext } from "@/types/auth";

/**
 * GET /api/search?q=term&limit=20&offset=0&dateFrom=...&dateTo=...&contentType=code,images
 *
 * Enhanced full-text search with filters.
 *
 * Query parameters:
 * - q (required): Search query string, 1-500 characters
 * - limit (optional): Max results, 1-100, default 20
 * - offset (optional): Pagination offset, >= 0, default 0
 * - dateFrom (optional): ISO date (YYYY-MM-DD), filter by updatedAt >= dateFrom
 * - dateTo (optional): ISO date (YYYY-MM-DD), filter by updatedAt <= dateTo
 * - contentType (optional): Comma-separated list (code,images,links)
 *
 * Returns:
 * - 200: Search results with snippets, scores, and filters applied
 * - 400: Invalid query parameters
 * - 401: Not authenticated
 */
export const GET = withTenant(
  async (req: NextRequest, ctx: TenantContext) => {
    const { searchParams } = new URL(req.url);

    // Parse and validate query parameters
    const parseResult = SearchQuerySchema.safeParse({
      q: searchParams.get("q"),
      limit: searchParams.get("limit") ?? undefined,
      offset: searchParams.get("offset") ?? undefined,
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
      contentType: searchParams.get("contentType") ?? undefined,
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

    const { q, limit, offset, dateFrom, dateTo, contentType } = parseResult.data;

    // Build filters object
    const filters = {
      dateFrom,
      dateTo,
      contentType,
    };

    try {
      // Execute the enhanced search
      const searchResults = await enhancedSearchBlocks(
        q,
        ctx.tenantId,
        filters,
        limit,
        offset
      );

      // Map to API response format
      const data = searchResults.results.map((result) => ({
        pageId: result.pageId,
        pageTitle: result.pageTitle,
        pageIcon: result.pageIcon,
        snippet: result.snippet,
        score: Math.round(result.score * 100) / 100,
        updatedAt: result.updatedAt,
        matchedBlockIds: result.matchedBlockIds,
      }));

      return listResponse(data, searchResults.total, limit, offset);
    } catch (error) {
      console.error("Enhanced search failed:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Search failed",
        undefined,
        500
      );
    }
  }
);
