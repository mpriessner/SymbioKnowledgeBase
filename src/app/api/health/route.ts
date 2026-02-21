import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface DatabaseCheck {
  status: "ok" | "error";
  latency_ms: number;
  error?: string;
}

interface HealthResponse {
  status: "ok" | "degraded" | "error";
  version: string;
  uptime: number;
  checks: {
    database: DatabaseCheck;
  };
  timestamp: string;
}

const APP_VERSION = process.env.npm_package_version || "1.0.0";
const startTime = Date.now();

/**
 * Check database connectivity by executing a simple query.
 * Returns the check result with latency measurement.
 */
async function checkDatabase(): Promise<DatabaseCheck> {
  const start = performance.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    const latency = Math.round(performance.now() - start);

    return {
      status: "ok",
      latency_ms: latency,
    };
  } catch (err) {
    const latency = Math.round(performance.now() - start);
    const message =
      err instanceof Error ? err.message : "Unknown database error";

    return {
      status: "error",
      latency_ms: latency,
      error: message,
    };
  }
}

/**
 * GET /api/health
 *
 * Health check endpoint for monitoring and container orchestration.
 * No authentication required (security: [] in OpenAPI spec).
 *
 * Returns:
 * - 200: Service is healthy (all checks pass)
 * - 503: Service is unhealthy (critical checks fail)
 */
export async function GET(): Promise<NextResponse<HealthResponse>> {
  const dbCheck = await checkDatabase();

  const uptimeSeconds = (Date.now() - startTime) / 1000;

  let overallStatus: "ok" | "degraded" | "error";
  let httpStatus: number;

  if (dbCheck.status === "ok") {
    overallStatus = "ok";
    httpStatus = 200;
  } else {
    overallStatus = "error";
    httpStatus = 503;
  }

  const response: HealthResponse = {
    status: overallStatus,
    version: APP_VERSION,
    uptime: Math.round(uptimeSeconds * 100) / 100,
    checks: {
      database: dbCheck,
    },
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(response, {
    status: httpStatus,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
