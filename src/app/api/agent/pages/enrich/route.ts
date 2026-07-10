import { NextRequest } from "next/server";
import { withAgentAuth } from "@/lib/agent/auth";
import type { AgentContext } from "@/lib/agent/auth";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { z } from "zod";
import { enrich, EnrichmentError, MAX_RAW_TEXT_CHARS } from "@/lib/agent/enrichment/enrich";

const enrichSchema = z.object({
  rawText: z.string().min(1).max(MAX_RAW_TEXT_CHARS),
  sourceName: z.string().min(1).max(500),
  targetCategoryId: z.string().uuid().optional(),
  dryRun: z.boolean().optional(),
});

/**
 * POST /api/agent/pages/enrich
 *
 * Raw-text → concept pages via the OKF enrichment engine (a71-13). An LLM
 * decides create-vs-update per concept; writes are confined to the Concepts
 * subtree, tenant-scoped, audited, and versioned. Supports `dryRun` preview.
 *
 * Body: { rawText, sourceName, targetCategoryId?, dryRun? }
 * Returns: { plan, applied, warnings, dryRun, alreadyIngested? }
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
      const result = await enrich(ctx, {
        rawText: parsed.data.rawText,
        sourceName: parsed.data.sourceName,
        targetCategoryId: parsed.data.targetCategoryId,
        dryRun: parsed.data.dryRun,
      });
      return successResponse(result);
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
