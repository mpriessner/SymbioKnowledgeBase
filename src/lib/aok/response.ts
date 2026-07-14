import { NextResponse } from "next/server";

/**
 * AOK response envelope — deliberately NOT the repo-standard
 * `{ data, meta }` / `{ error:{code,message}, meta }` envelope from
 * `@/lib/apiResponse`. `withAgentAuth` (auth/scope/rate-limit failures) keeps
 * using that repo-standard envelope untouched; every AOK handler response
 * below it uses this dual envelope instead: `{ok:true,...}` / `{ok:false,error}`.
 * The Android client parses both. See the story's API contract table.
 */
export function aokOk<T extends object>(
  data: T,
  status = 200,
  headers?: Record<string, string>
): NextResponse {
  return NextResponse.json({ ok: true, ...data }, { status, headers });
}

export function aokError(
  message: string,
  status: number,
  headers?: Record<string, string>
): NextResponse {
  return NextResponse.json({ ok: false, error: message }, { status, headers });
}

/** `Cache-Control: no-store` for the asset-card + resolve routes (sensitive-response treatment, matches kb-query). */
export const NO_STORE_HEADERS = { "Cache-Control": "no-store" };
