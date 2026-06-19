import { NextResponse } from "next/server";

interface HealthResponse {
  status: "ok";
  version: string;
  uptime: number;
  timestamp: string;
}

const APP_VERSION = process.env.npm_package_version || "1.0.0";
const startTime = Date.now();

/**
 * GET /api/health
 *
 * LIVENESS probe. Answers a single question: is this process up and able to
 * serve HTTP? It deliberately does NOT touch the database or any external
 * dependency — a transient DB blip must not make the orchestrator kill and
 * restart an otherwise-healthy container. Use /api/ready for dependency checks.
 *
 * No authentication required (public; security: [] in the OpenAPI spec).
 *
 * Returns:
 * - 200: process is alive
 */
export function GET(): NextResponse<HealthResponse> {
  const uptimeSeconds = (Date.now() - startTime) / 1000;

  const response: HealthResponse = {
    status: "ok",
    version: APP_VERSION,
    uptime: Math.round(uptimeSeconds * 100) / 100,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(response, {
    status: 200,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
