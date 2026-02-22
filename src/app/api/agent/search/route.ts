import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withAgentAuth } from "@/lib/agent/auth";
import type { AgentContext } from "@/lib/agent/auth";
import { listResponse, errorResponse } from "@/lib/apiResponse";
import { z } from "zod";

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

      const formatted = results.map((r) => ({
        page_id: r.page_id,
        title: r.title,
        icon: r.icon,
        snippet: extractMarkdownSnippet(r.plain_text || "", q),
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
