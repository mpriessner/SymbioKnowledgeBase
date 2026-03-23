import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withAgentAuth } from "@/lib/agent/auth";
import type { AgentContext } from "@/lib/agent/auth";
import { listResponse, successResponse, errorResponse } from "@/lib/apiResponse";
import { generatePagePath } from "@/lib/agent/pageTree";
import { z } from "zod";
import {
  depthSearch,
  type SearchDepth,
  type SearchScope,
} from "@/lib/search/depthSearch";

const VALID_DEPTHS = new Set(["default", "medium", "deep"]);
const VALID_SCOPES = new Set(["private", "team", "all"]);
const VALID_CATEGORIES = new Set([
  "experiments",
  "chemicals",
  "reactionTypes",
  "researchers",
  "substrateClasses",
]);

const searchQuerySchema = z.object({
  q: z.string().min(1).max(500),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * Extract a markdown snippet with search term context.
 */
function extractMarkdownSnippet(plainText: string, query: string): string {
  const lowerText = plainText.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) return plainText.substring(0, 150) + "...";

  const start = Math.max(0, index - 50);
  const end = Math.min(plainText.length, index + query.length + 100);

  let snippet = plainText.substring(start, end);
  if (start > 0) snippet = "..." + snippet;
  if (end < plainText.length) snippet = snippet + "...";

  return snippet;
}

interface SearchRow {
  page_id: string;
  title: string;
  icon: string | null;
  one_liner: string | null;
  plain_text: string;
  score: number;
}

interface CountRow {
  count: number;
}

/**
 * GET /api/agent/search — Full-text search with markdown snippets
 */
export const GET = withAgentAuth(
  async (req: NextRequest, ctx: AgentContext) => {
    try {
      const { searchParams } = new URL(req.url);

      // If depth param is present, use the new depth-aware search
      const depth = searchParams.get("depth");
      if (depth) {
        const q = searchParams.get("q");
        const scope = (searchParams.get("scope") ?? "all") as SearchScope;
        const category = searchParams.get("category") ?? undefined;
        const limitParam = searchParams.get("limit");
        const limit = limitParam ? parseInt(limitParam, 10) : undefined;

        if (!q || q.trim().length === 0) {
          return errorResponse(
            "VALIDATION_ERROR",
            "q query parameter is required",
            undefined,
            400
          );
        }
        if (!VALID_DEPTHS.has(depth)) {
          return errorResponse(
            "VALIDATION_ERROR",
            `Invalid depth "${depth}". Must be one of: default, medium, deep`,
            undefined,
            400
          );
        }
        if (!VALID_SCOPES.has(scope)) {
          return errorResponse(
            "VALIDATION_ERROR",
            `Invalid scope "${scope}". Must be one of: private, team, all`,
            undefined,
            400
          );
        }
        if (category && !VALID_CATEGORIES.has(category)) {
          return errorResponse(
            "VALIDATION_ERROR",
            `Invalid category "${category}". Must be one of: experiments, chemicals, reactionTypes, researchers, substrateClasses`,
            undefined,
            400
          );
        }
        if (limit !== undefined && (isNaN(limit) || limit < 1 || limit > 100)) {
          return errorResponse(
            "VALIDATION_ERROR",
            "limit must be between 1 and 100",
            undefined,
            400
          );
        }

        const result = await depthSearch({
          tenantId: ctx.tenantId,
          query: q.trim(),
          depth: depth as SearchDepth,
          scope,
          category,
          limit,
        });

        return successResponse(result);
      }

      // Legacy search (no depth param) — existing behavior
      const queryParams = Object.fromEntries(searchParams.entries());

      const parsed = searchQuerySchema.safeParse(queryParams);
      if (!parsed.success) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Invalid query parameters",
          undefined,
          400
        );
      }

      const { q, limit, offset } = parsed.data;

      // Full-text search using PostgreSQL tsvector
      const results = await prisma.$queryRaw<SearchRow[]>`
        SELECT
          b.page_id,
          p.title,
          p.icon,
          p.one_liner,
          b.plain_text,
          ts_rank(b.search_vector, websearch_to_tsquery('english', ${q})) as score
        FROM blocks b
        JOIN pages p ON p.id = b.page_id
        WHERE b.tenant_id = ${ctx.tenantId}
          AND b.deleted_at IS NULL
          AND b.search_vector @@ websearch_to_tsquery('english', ${q})
        ORDER BY score DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      const totalResult = await prisma.$queryRaw<CountRow[]>`
        SELECT COUNT(DISTINCT b.page_id)::int as count
        FROM blocks b
        WHERE b.tenant_id = ${ctx.tenantId}
          AND b.deleted_at IS NULL
          AND b.search_vector @@ websearch_to_tsquery('english', ${q})
      `;

      // Build page path map for breadcrumb generation
      const pageIds = [...new Set(results.map((r) => r.page_id))];
      let pagesById = new Map<string, { title: string; parentId: string | null }>();

      if (pageIds.length > 0) {
        const allPages = await prisma.page.findMany({
          where: { tenantId: ctx.tenantId },
          select: { id: true, title: true, parentId: true },
        });
        pagesById = new Map(allPages.map((p) => [p.id, p]));
      }

      const formatted = results.map((r) => ({
        page_id: r.page_id,
        title: r.title,
        icon: r.icon,
        oneLiner: r.one_liner,
        path: generatePagePath(r.page_id, pagesById),
        matchContext: extractMarkdownSnippet(r.plain_text || "", q),
        score: parseFloat(String(r.score)),
      }));

      return listResponse(
        formatted,
        totalResult[0]?.count ?? 0,
        limit,
        offset
      );
    } catch (error) {
      console.error("GET /api/agent/search error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);
