import { NextRequest } from "next/server";
import { withAgentAuth } from "@/lib/agent/auth";
import type { AgentContext } from "@/lib/agent/auth";
import { listResponse, successResponse, errorResponse } from "@/lib/apiResponse";
import { prisma } from "@/lib/db";
import { claimEscalatedFindings } from "@/lib/triage/lease";

const VALID_STATUS = new Set([
  "OPEN",
  "ESCALATED",
  "DEFERRED",
  "DISMISSED",
  "RESOLVED",
]);
const VALID_KIND = new Set([
  "STALE",
  "SOURCE_TAGGED",
  "POSSIBLE_DUPLICATE",
  "CONTRADICTION_CANDIDATE",
]);

/**
 * GET /api/agent/triage/findings
 *
 * The read side of the W81-C1 flag-queue, consumed by C2 (frontier re-synthesis)
 * and C3 (human approval). Tenant-scoped (the worker never tags across tenants, so
 * this never surfaces another tenant's finding). Filters: `status`, `kind`.
 * Newest first. Metadata + participant ids only — never a page body.
 */
export const GET = withAgentAuth(
  async (req: NextRequest, ctx: AgentContext) => {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? undefined;
    const kind = url.searchParams.get("kind") ?? undefined;
    if (status && !VALID_STATUS.has(status)) {
      return errorResponse("VALIDATION_ERROR", `invalid status '${status}'`, undefined, 400);
    }
    if (kind && !VALID_KIND.has(kind)) {
      return errorResponse("VALIDATION_ERROR", `invalid kind '${kind}'`, undefined, 400);
    }
    const limit = Math.min(
      Math.max(Number(url.searchParams.get("limit") ?? 50), 1),
      200
    );
    const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);

    const where = {
      tenantId: ctx.tenantId,
      ...(status ? { status: status as never } : {}),
      ...(kind ? { kind: kind as never } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.triageFinding.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          kind: true,
          status: true,
          severity: true,
          confidence: true,
          pageId: true,
          relatedPageId: true,
          claimId: true,
          relatedClaimId: true,
          sourceId: true,
          evidence: true,
          modelDigest: true,
          escalatedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.triageFinding.count({ where }),
    ]);

    return listResponse(rows, total, limit, offset);
  }
);

/**
 * POST /api/agent/triage/findings/claim (via ?action=claim)
 *
 * At-most-once escalation lease: a C2 consumer atomically claims ESCALATED,
 * unleased findings. One finding → one frontier job. Requires `write` scope.
 * Body: { owner: string, limit?: number }.
 */
export const POST = withAgentAuth(
  async (req: NextRequest, ctx: AgentContext) => {
    const url = new URL(req.url);
    if (url.searchParams.get("action") !== "claim") {
      return errorResponse("BAD_REQUEST", "unsupported action", undefined, 400);
    }
    let body: { owner?: string; limit?: number };
    try {
      body = (await req.json()) as { owner?: string; limit?: number };
    } catch {
      return errorResponse("BAD_REQUEST", "Invalid JSON body", undefined, 400);
    }
    const owner = body.owner?.trim();
    if (!owner) {
      return errorResponse("VALIDATION_ERROR", "owner is required", undefined, 400);
    }
    const limit = Math.min(Math.max(Number(body.limit ?? 1), 1), 50);
    const claimed = await claimEscalatedFindings(ctx.tenantId, owner, limit);
    return successResponse({ claimed });
  }
);
