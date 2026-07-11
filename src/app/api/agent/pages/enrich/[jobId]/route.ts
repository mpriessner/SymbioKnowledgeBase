import { NextRequest } from "next/server";
import { withAgentAuth } from "@/lib/agent/auth";
import type { AgentContext } from "@/lib/agent/auth";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { z } from "zod";
import { getEnrichJob } from "@/lib/agent/enrichment/enrichJob";

type RouteContext = { params: Promise<Record<string, string>> };

/**
 * GET /api/agent/pages/enrich/:jobId
 *
 * Reads a durable EnrichJob row (tenant-scoped) so a completed enrichment+
 * citation run never polls as 404 after a cold start. Returns the job status
 * and, when DONE/FAILED, its result/error payload.
 */
export const GET = withAgentAuth(
  async (_req: NextRequest, ctx: AgentContext, routeContext: RouteContext) => {
    try {
      const { jobId } = await routeContext.params;
      if (!z.string().uuid().safeParse(jobId).success) {
        return errorResponse("VALIDATION_ERROR", "Invalid job ID", undefined, 400);
      }

      const job = await getEnrichJob(ctx.tenantId, jobId);
      if (!job) {
        return errorResponse("NOT_FOUND", "Enrich job not found", undefined, 404);
      }

      return successResponse({
        jobId: job.id,
        status: job.status,
        result: job.result ?? null,
        error: job.error ?? null,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("[enrich/:jobId] error:", msg);
      return errorResponse("INTERNAL_ERROR", "Failed to read enrich job", undefined, 500);
    }
  }
);
