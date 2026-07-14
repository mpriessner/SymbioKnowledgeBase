import { NextRequest } from "next/server";
import { z } from "zod";
import { withAgentAuth } from "@/lib/agent/auth";
import type { AgentContext } from "@/lib/agent/auth";
import { aokOk, aokError } from "@/lib/aok/response";
import { GENERIC_READ_ERROR } from "@/lib/aok/errors";
import { opaqueIdSchema } from "@/lib/aok/ids";
import { searchAssets } from "@/lib/aok/search";

const searchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  site_id: opaqueIdSchema.optional(),
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

/**
 * GET /api/agent/aok/assets/search?q=...&site_id=?&limit=5 — kept fully
 * separate from `/api/agent/search` (different tables, different ranking,
 * different response shape). Empty results are `{ok:true, results:[]}`.
 */
export const GET = withAgentAuth(async (req: NextRequest, ctx: AgentContext) => {
  const url = new URL(req.url);
  const parsed = searchQuerySchema.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    site_id: url.searchParams.get("site_id") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return aokError("I need something to search for.", 400);
  }

  try {
    const results = await searchAssets(ctx.tenantId, parsed.data.q, {
      siteId: parsed.data.site_id,
      limit: parsed.data.limit,
    });
    return aokOk({ results });
  } catch (error) {
    console.error("[aok] GET /assets/search error:", error);
    return aokError(GENERIC_READ_ERROR, 500);
  }
});
