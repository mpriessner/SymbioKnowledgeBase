import { NextRequest } from "next/server";
import { withAgentAuth } from "@/lib/agent/auth";
import type { AgentContext } from "@/lib/agent/auth";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { z } from "zod";
import { enrich, EnrichmentError, MAX_RAW_TEXT_CHARS } from "@/lib/agent/enrichment/enrich";
import { createEnrichJob } from "@/lib/agent/enrichment/enrichJob";
import { runEnrichJob } from "@/lib/agent/enrichment/enrichJobRunner";

const enrichSchema = z.object({
  rawText: z.string().min(1).max(MAX_RAW_TEXT_CHARS),
  sourceName: z.string().min(1).max(500),
  targetCategoryId: z.string().uuid().optional(),
  dryRun: z.boolean().optional(),
});

/**
 * POST /api/agent/pages/enrich
 *
 * Raw-text → concept pages via the OKF enrichment engine (a71-13) + W81-A2
 * claim/evidence citations. Discriminated response (Codex R1) — a caller
 * branches on `mode` before parsing, never guesses between two shapes:
 *
 *   - `dryRun: true`  → SYNCHRONOUS `{ mode: 'sync', plan, applied: [], warnings }`
 *     (persists NOTHING — no Source, no ledger, no claims; body-plan preview only).
 *   - real run        → ASYNC `{ mode: 'async', jobId, status }`. A durable
 *     EnrichJob row is inserted QUEUED; enrichment+citation runs off the request
 *     path (adding citation extraction pushes worst-case toward ~120s, beyond a
 *     safe sync HTTP budget). Poll GET /api/agent/pages/enrich/[jobId].
 *
 * Body: { rawText, sourceName, targetCategoryId?, dryRun? }
 */
export const POST = withAgentAuth(
  async (req: NextRequest, ctx: AgentContext) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errorResponse("BAD_REQUEST", "Invalid JSON body", undefined, 400);
    }

    const parsed = enrichSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        `Validation error: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`,
        undefined,
        400
      );
    }

    try {
      // dryRun stays synchronous (persists nothing) under the `sync` discriminator.
      if (parsed.data.dryRun) {
        const result = await enrich(ctx, {
          rawText: parsed.data.rawText,
          sourceName: parsed.data.sourceName,
          targetCategoryId: parsed.data.targetCategoryId,
          dryRun: true,
        });
        return successResponse({
          mode: "sync" as const,
          plan: result.plan,
          applied: [] as never[],
          warnings: result.warnings,
        });
      }

      // Real run → durable async job. The QUEUED row is the source of truth; a
      // W81-C1 poller (or the fire-and-forget kick below) picks it up.
      const request = {
        rawText: parsed.data.rawText,
        sourceName: parsed.data.sourceName,
        targetCategoryId: parsed.data.targetCategoryId,
      };
      const job = await createEnrichJob(ctx.tenantId, request);
      void runEnrichJob(ctx, job.id, request).catch((err) => {
        console.error("[enrich] background job kick failed:", err);
      });
      return successResponse({
        mode: "async" as const,
        jobId: job.id,
        status: job.status,
      });
    } catch (error) {
      if (error instanceof EnrichmentError) {
        return errorResponse(
          "ENRICHMENT_ERROR",
          error.message,
          undefined,
          error.status
        );
      }
      const msg = error instanceof Error ? error.message : String(error);
      console.error("[enrich] error:", msg);
      if (msg.includes("not configured")) {
        return errorResponse("SERVICE_UNAVAILABLE", msg, undefined, 503);
      }
      if (msg.includes("valid EnrichmentPlan")) {
        // LLM produced unusable output after the 2-attempt self-repair cap.
        return errorResponse("ENRICHMENT_FAILED", msg, undefined, 502);
      }
      return errorResponse("INTERNAL_ERROR", "Enrichment failed", undefined, 500);
    }
  }
);
