import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withAgentAuth } from "@/lib/agent/auth";
import type { AgentContext } from "@/lib/agent/auth";
import { listResponse, errorResponse } from "@/lib/apiResponse";
import { z } from "zod";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * GET /api/agent/sweep/history — List past sweep sessions
 *
 * Query: ?limit=20&offset=0
 * Returns: paginated list of SweepSession records
 */
export const GET = withAgentAuth(
  async (req: NextRequest, ctx: AgentContext) => {
    try {
      const url = new URL(req.url);
      const parsed = querySchema.safeParse({
        limit: url.searchParams.get("limit"),
        offset: url.searchParams.get("offset"),
      });

      if (!parsed.success) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Invalid query parameters",
          parsed.error.flatten().fieldErrors,
          400
        );
      }

      const { limit, offset } = parsed.data;

      const [sessions, total] = await Promise.all([
        prisma.sweepSession.findMany({
          where: { tenantId: ctx.tenantId },
          orderBy: { startedAt: "desc" },
          take: limit,
          skip: offset,
        }),
        prisma.sweepSession.count({
          where: { tenantId: ctx.tenantId },
        }),
      ]);

      return listResponse(sessions, { total, limit, offset });
    } catch (err) {
      console.error("Sweep history API error:", err);
      return errorResponse(
        "INTERNAL_ERROR",
        "Failed to fetch sweep history",
        undefined,
        500
      );
    }
  }
);
