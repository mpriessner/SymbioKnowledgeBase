import type { NextRequest } from "next/server";

/**
 * Origin allowlisting for the data-mutating sync endpoints (audit S6).
 *
 * Previously these returned `Access-Control-Allow-Origin: *` on real responses,
 * leaking responses to any origin. Now we echo the request `Origin` ONLY if it
 * is on the `SYNC_ALLOWED_ORIGINS` allowlist (comma-separated env var); otherwise
 * we omit the ACAO header entirely (the browser then blocks the cross-origin
 * read). We never echo the literal string "null" — that is a real, exploitable
 * origin value.
 *
 * Server-to-server callers (ChemELN/ExpTube/Gateway/cron) send NO `Origin`
 * header, so they are unaffected — CORS only governs browser cross-origin reads.
 */

function allowedOrigins(): string[] {
  return (process.env.SYNC_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

/** Return the request Origin iff it is allowlisted, else null. */
export function resolveCorsOrigin(req: NextRequest): string | null {
  const origin = req.headers.get("origin");
  if (!origin) return null;
  return allowedOrigins().includes(origin) ? origin : null;
}

export interface CorsOptions {
  /** Per-route allowed methods, e.g. "GET, POST, OPTIONS" or "POST, OPTIONS". */
  methods: string;
  /** Per-route allowed request headers. */
  headers?: string;
}

/**
 * Build the CORS response headers for a given route. ROUTE/METHOD-AWARE: the
 * caller passes its own `methods`/`headers` so a shared helper never silently
 * widens or narrows a route's preflight (audit-05 Codex MUST-FIX). When the
 * origin is not allowlisted, the `Access-Control-Allow-Origin` header is omitted.
 */
export function corsHeaders(
  req: NextRequest,
  options: CorsOptions
): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": options.methods,
  };
  if (options.headers) {
    headers["Access-Control-Allow-Headers"] = options.headers;
  }
  const origin = resolveCorsOrigin(req);
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    // Vary on Origin so caches don't serve one origin's ACAO to another.
    headers["Vary"] = "Origin";
  }
  return headers;
}
