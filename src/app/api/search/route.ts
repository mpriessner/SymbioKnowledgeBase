import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
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

      // Drop hits on soft-deleted pages. The FTS/keyword queries in the search
      // helper don't filter `deletedAt`, so a deleted page's content can still
      // match. We exclude any result whose page is soft-deleted and reduce the
      // reported total by the number removed from this page of results.
      // Best-effort: a failure to resolve the deleted set must not turn a
      // successful search into a 500 — fall back to the unfiltered results.
      const pageIds = Array.from(
        new Set(searchResults.results.map((r) => r.pageId))
      );
      let visibleResults = searchResults.results;
      let total = searchResults.total;

      if (pageIds.length > 0) {
        try {
          const deletedPages = await prisma.page.findMany({
            where: {
              id: { in: pageIds },
              tenantId: ctx.tenantId,
              deletedAt: { not: null },
            },
            select: { id: true },
          });
          if (deletedPages.length > 0) {
            const deletedIds = new Set(deletedPages.map((p) => p.id));
            const before = visibleResults.length;
            visibleResults = visibleResults.filter(
              (r) => !deletedIds.has(r.pageId)
            );
            total = Math.max(0, total - (before - visibleResults.length));
          }
        } catch (filterError) {
          console.error(
            "Soft-delete filter on search results failed:",
            filterError
          );
        }
      }

      // Map to API response format
      const data = visibleResults.map((result) => ({
        pageId: result.pageId,
        pageTitle: result.pageTitle,
        pageIcon: result.pageIcon,
        snippet: result.snippet,
        score: Math.round(result.score * 100) / 100,
        updatedAt: result.updatedAt,
        matchedBlockIds: result.matchedBlockIds,
      }));

      return listResponse(data, total, limit, offset);
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
