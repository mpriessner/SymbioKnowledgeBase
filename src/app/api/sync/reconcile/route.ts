import { NextRequest, NextResponse } from "next/server";
import {
  runReconciliation,
  isReconciliationRunning,
  getLastReconciliationResult,
  getActiveSyncId,
} from "@/lib/chemistryKb/reconciliationSync";
import { corsHeaders } from "@/lib/security/cors";

const CORS_METHODS = "GET, POST, OPTIONS";
const CORS_HEADERS = "Content-Type, Authorization, X-Tenant-ID";

const SYNC_SERVICE_KEY = process.env.SYNC_SERVICE_KEY;

function authenticateSync(req: NextRequest): boolean {
  if (!SYNC_SERVICE_KEY) {
    console.warn("[sync/reconcile] SYNC_SERVICE_KEY not configured");
    return false;
  }
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  return authHeader.substring(7) === SYNC_SERVICE_KEY;
}

function resolveTenantId(req: NextRequest): string | null {
  return (
    req.headers.get("X-Tenant-ID") ||
    process.env.DEFAULT_TENANT_ID ||
    null
  );
}

/**
 * OPTIONS /api/sync/reconcile — CORS preflight
 */
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req, { methods: CORS_METHODS, headers: CORS_HEADERS }),
  });
}

/**
 * GET /api/sync/reconcile — Get current/last reconciliation status
 */
export async function GET(req: NextRequest) {
  if (!authenticateSync(req)) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid or missing SYNC_SERVICE_KEY" } },
      { status: 401 }
    );
  }

  const running = isReconciliationRunning();
  const lastResult = getLastReconciliationResult();
  const activeSyncId = getActiveSyncId();

  return NextResponse.json({
    running,
    activeSyncId,
    lastRun: lastResult
      ? {
          syncId: lastResult.syncId,
          status: lastResult.status,
          startedAt: lastResult.startedAt,
          completedAt: lastResult.completedAt,
          duration: lastResult.duration,
          changeSet: lastResult.changeSet,
          errorCount: lastResult.errors.length,
        }
      : null,
  });
}

/**
 * POST /api/sync/reconcile — Trigger a reconciliation sync
 *
 * Query params:
 *   ?full=true   — Re-sync everything (default: false)
 *   ?dry-run=true — Preview changes without writing (default: false)
 */
export async function POST(req: NextRequest) {
  if (!authenticateSync(req)) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid or missing SYNC_SERVICE_KEY" } },
      { status: 401 }
    );
  }

  const tenantId = resolveTenantId(req);
  if (!tenantId) {
    return NextResponse.json(
      { error: { code: "UNPROCESSABLE_ENTITY", message: "Cannot resolve tenantId" } },
      { status: 422 }
    );
  }

  // Concurrency guard
  if (isReconciliationRunning()) {
    return NextResponse.json(
      {
        error: {
          code: "CONFLICT",
          message: "A reconciliation sync is already running",
          activeSyncId: getActiveSyncId(),
        },
      },
      { status: 409 }
    );
  }

  const url = new URL(req.url);
  const full = url.searchParams.get("full") === "true";
  const dryRun = url.searchParams.get("dry-run") === "true";

  // Run synchronously for now (async background execution can be added later)
  // For large datasets, this could be made async with a 202 response
  try {
    const result = await runReconciliation(tenantId, { full, dryRun });

    return NextResponse.json(
      {
        status: result.status,
        syncId: result.syncId,
        duration: result.duration,
        dryRun,
        changeSet: result.changeSet,
        changes: result.changes,
        errors: result.errors.length > 0 ? result.errors : undefined,
      },
      {
        status: result.status === "failed" ? 500 : 200,
        headers: corsHeaders(req, { methods: CORS_METHODS }),
      }
    );
  } catch (error) {
    console.error("[sync/reconcile] Unhandled error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
