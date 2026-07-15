import type { NextRequest } from "next/server";

/**
 * Tolerant JSON body reader: an empty body parses as `{}` (some routes, e.g.
 * anchor mint, have an all-optional body) instead of throwing; malformed JSON
 * still reports failure so the caller can return a speakable 400 rather than
 * letting the exception escape as a bare 500.
 */
export async function readJsonBody(
  req: NextRequest
): Promise<{ ok: true; data: unknown } | { ok: false }> {
  try {
    const text = await req.text();
    if (!text || text.trim().length === 0) return { ok: true, data: {} };
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}
