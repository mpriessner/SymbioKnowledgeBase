import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import {
  extractKnowledgeForExperiment,
  extractKnowledgeBulk,
  type ExtractionSource,
} from "@/lib/chemistryKb/knowledgeExtractor";
import { z } from "zod";

const singleExtractionSchema = z.object({
  pageId: z.string().min(1),
  sources: z
    .array(
      z.object({
        type: z.enum(["chemeln_procedure", "exptube_transcription", "conversation"]),
        data: z.record(z.string(), z.unknown()),
      })
    )
    .min(1),
  dryRun: z.boolean().optional(),
});

const bulkExtractionSchema = z.object({
  bulk: z.literal(true),
  elnIds: z.array(z.string()).optional(),
  limit: z.number().min(1).max(50).optional(),
  dryRun: z.boolean().optional(),
});

/**
 * POST /api/agent/pages/extract-knowledge
 *
 * Two modes:
 * 1. Single experiment: { pageId, sources, dryRun? }
 * 2. Bulk extraction:   { bulk: true, elnIds?, limit?, dryRun? }
 */
export const POST = withTenant(async (req, ctx) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("BAD_REQUEST", "Invalid JSON body");
  }

  // Check which mode
  if (typeof body === "object" && body !== null && "bulk" in body && (body as Record<string, unknown>).bulk === true) {
    const parsed = bulkExtractionSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        `Validation error: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`
      );
    }

    try {
      const result = await extractKnowledgeBulk(ctx.tenantId, {
        dryRun: parsed.data.dryRun,
        limit: parsed.data.limit,
        elnIds: parsed.data.elnIds,
      });

      return successResponse(result);
    } catch (error) {
      console.error("[extract-knowledge] Bulk extraction error:", error);
      return errorResponse("INTERNAL_ERROR", "Extraction failed", undefined, 500);
    }
  }

  // Single mode
  const parsed = singleExtractionSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      "VALIDATION_ERROR",
      `Validation error: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`
    );
  }

  try {
    const result = await extractKnowledgeForExperiment(
      ctx.tenantId,
      parsed.data.pageId,
      parsed.data.sources as ExtractionSource[],
      { dryRun: parsed.data.dryRun }
    );

    return successResponse(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[extract-knowledge] Extraction error:", msg);

    if (msg.includes("not found")) {
      return errorResponse("NOT_FOUND", msg, undefined, 404);
    }
    if (msg.includes("not configured")) {
      return errorResponse("SERVICE_UNAVAILABLE", msg, undefined, 503);
    }

    return errorResponse("INTERNAL_ERROR", "Extraction failed", undefined, 500);
  }
});
