import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface DependencyCheck {
  status: "ok" | "error" | "skipped";
  latency_ms: number;
  error?: string;
}

interface ReadyResponse {
  status: "ready" | "not_ready";
  checks: {
    database: DependencyCheck;
    supabase: DependencyCheck;
  };
  timestamp: string;
}

/**
 * Check database connectivity by executing a trivial query.
 */
async function checkDatabase(): Promise<DependencyCheck> {
  const start = performance.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: "ok",
      latency_ms: Math.round(performance.now() - start),
    };
  } catch (err) {
    return {
      status: "error",
      latency_ms: Math.round(performance.now() - start),
      error: err instanceof Error ? err.message : "Unknown database error",
    };
  }
}

/**
 * Check Supabase reachability when it is configured. If no Supabase URL is set
 * the check is "skipped" (not a failure) — some environments use a different
 * auth path. A configured-but-unreachable Supabase IS a readiness failure
 * because auth would be broken.
 */
async function checkSupabase(): Promise<DependencyCheck> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    return { status: "skipped", latency_ms: 0 };
  }

  const start = performance.now();
  try {
    // /auth/v1/health is the canonical lightweight liveness path for GoTrue.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/health`, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return {
        status: "error",
        latency_ms: Math.round(performance.now() - start),
        error: `Supabase health returned ${res.status}`,
      };
    }
    return {
      status: "ok",
      latency_ms: Math.round(performance.now() - start),
    };
  } catch (err) {
    return {
      status: "error",
      latency_ms: Math.round(performance.now() - start),
      error: err instanceof Error ? err.message : "Supabase unreachable",
    };
  }
}

/**
 * GET /api/ready
 *
 * READINESS probe. Answers: can this instance actually serve traffic right now,
 * i.e. are its critical dependencies reachable? Checks the database (SELECT 1)
 * and, when configured, Supabase auth. Returns 503 when any required dependency
 * is down so a load balancer / orchestrator stops routing to this instance
 * until it recovers — without restarting the (still-alive) process.
 *
 * No authentication required (public; mirrors /api/health).
 *
 * Returns:
 * - 200: ready (all required dependencies ok)
 * - 503: not ready (a required dependency is down)
 */
export async function GET(): Promise<NextResponse<ReadyResponse>> {
  const [database, supabase] = await Promise.all([
    checkDatabase(),
    checkSupabase(),
  ]);

  // Database is always required. Supabase is required only when configured.
  const ready =
    database.status === "ok" && supabase.status !== "error";

  const response: ReadyResponse = {
    status: ready ? "ready" : "not_ready",
    checks: { database, supabase },
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(response, {
    status: ready ? 200 : 503,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
