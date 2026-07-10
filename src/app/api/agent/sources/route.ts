import { NextRequest } from "next/server";
import { withAgentAuth } from "@/lib/agent/auth";
import type { AgentContext } from "@/lib/agent/auth";
import { successResponse, listResponse, errorResponse } from "@/lib/apiResponse";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ingestSource, IngestError } from "@/lib/sources/ingestService";

const MAX_RAW_TEXT_CHARS = 500_000;

const createSchema = z.object({
  kind: z.enum(["DOCUMENT", "TRANSCRIPT", "NOTE", "EXPERIMENT_SYNC", "URL"]),
  title: z.string().min(1).max(500),
  rawText: z.string().min(1).max(MAX_RAW_TEXT_CHARS),
  originRef: z.string().max(2000).optional(),
  correlationId: z.string().max(200).optional(),
  dryRun: z.boolean().optional(),
});

/**
 * POST /api/agent/sources
 *
 * Ingest a raw artifact into the immutable Source store: hashes verbatim
 * rawText, chunks deterministically, and (non-dryRun) persists Source + all
 * chunks + a provenance occurrence atomically. Re-ingesting byte-identical text
 * is a dedup no-op returning the existing Source id. `dryRun` previews chunks
 * with zero writes.
 *
 * Body: { kind, title, rawText, originRef?, correlationId?, dryRun? }
 */
export const POST = withAgentAuth(
  async (req: NextRequest, ctx: AgentContext) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errorResponse("BAD_REQUEST", "Invalid JSON body", undefined, 400);
    }

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        `Validation error: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`,
        undefined,
        400
      );
    }

    try {
      const result = await ingestSource(ctx, {
        kind: parsed.data.kind,
        title: parsed.data.title,
        rawText: parsed.data.rawText,
        originRef: parsed.data.originRef,
        correlationId: parsed.data.correlationId,
        dryRun: parsed.data.dryRun,
      });
      return successResponse(result, undefined, result.deduped ? 200 : 201);
    } catch (error) {
      if (error instanceof IngestError) {
        return errorResponse("INGEST_ERROR", error.message, undefined, error.status);
      }
      const msg = error instanceof Error ? error.message : String(error);
      console.error("[sources] ingest error:", msg);
      return errorResponse("INTERNAL_ERROR", "Source ingest failed", undefined, 500);
    }
  }
);

/**
 * GET /api/agent/sources
 *
 * List this tenant's Sources (metadata only — never rawText/chunk bodies here),
 * newest first. Tenant-scoped: a cross-tenant contentSha256 collision never
 * surfaces another tenant's Source.
 */
export const GET = withAgentAuth(
  async (req: NextRequest, ctx: AgentContext) => {
    const url = new URL(req.url);
    const limit = Math.min(
      Math.max(Number(url.searchParams.get("limit") ?? 50), 1),
      200
    );
    const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);

    const [rows, total] = await Promise.all([
      prisma.source.findMany({
        where: { tenantId: ctx.tenantId },
        orderBy: { ingestedAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          kind: true,
          title: true,
          contentSha256: true,
          chunkerVersion: true,
          ingestedAt: true,
          _count: { select: { chunks: true, origins: true } },
        },
      }),
      prisma.source.count({ where: { tenantId: ctx.tenantId } }),
    ]);

    return listResponse(rows, total, limit, offset);
  }
);
