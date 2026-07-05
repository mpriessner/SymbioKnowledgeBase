import dns from "dns/promises";
import net from "net";

/**
 * SSRF-guarded URL validation + best-effort text snapshot fetch, for the
 * document-intake link path (a71-08).
 *
 * Two independent gates, per the story's reviewer findings:
 *   1. Scheme allowlist (`validateUrlScheme`) — rejects `javascript:`,
 *      `file:`, `data:`, etc. at creation time, before any network access.
 *   2. Resolved-IP check (`resolveAndCheckHost`) — rejects loopback,
 *      RFC-1918, and link-local ranges (including the 169.254.169.254 cloud
 *      metadata endpoint) *after* DNS resolution, so a hostname that merely
 *      looks public but resolves privately is still blocked. Redirects are
 *      not followed automatically (`redirect: "manual"`) so this repo does
 *      not need to re-run the same check against a redirect target.
 *
 * The fetch itself is time- and size-bounded: a hard timeout via
 * `AbortSignal.timeout`, and a streamed read capped at ~1MB so neither a
 * hanging response nor an oversized body can tie up the request indefinitely
 * or exhaust memory. Any failure here is non-fatal to the caller — document
 * creation proceeds as a link-only page (AC2, AC9).
 */

const FETCH_TIMEOUT_MS = 5000;
const MAX_SNAPSHOT_BYTES = 1024 * 1024; // ~1MB stream cap
const MAX_SNAPSHOT_CHARS = 5000;

export interface UrlValidationResult {
  ok: boolean;
  reason?: string;
}

/**
 * Reject any URL whose scheme is not http/https. Catches `javascript:`,
 * `file:`, `data:`, `vbscript:`, and malformed URLs alike (AC7).
 */
export function validateUrlScheme(rawUrl: string): UrlValidationResult {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "Malformed URL" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      ok: false,
      reason: `Unsupported URL scheme "${parsed.protocol}" — only http/https are allowed`,
    };
  }
  return { ok: true };
}

/**
 * True if an IPv4/IPv6 address falls in a loopback, link-local, or RFC-1918
 * private range. Fails closed on malformed input (treats it as disallowed).
 */
export function isDisallowedIp(ip: string): boolean {
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fe80")) return true; // link-local
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local fc00::/7
    if (lower.startsWith("::ffff:")) {
      const mapped = lower.slice("::ffff:".length);
      if (net.isIPv4(mapped)) return isDisallowedIp(mapped);
    }
    return false;
  }

  if (!net.isIPv4(ip)) return true; // malformed — fail closed

  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
  const [a, b] = parts;

  if (a === 0) return true;
  if (a === 127) return true; // loopback
  if (a === 10) return true; // RFC1918
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 169 && b === 254) return true; // link-local, incl. 169.254.169.254 metadata
  return false;
}

/**
 * Resolve a hostname and reject it if any resolved address is in a
 * disallowed range. This is the fetch-time SSRF gate (as distinct from the
 * scheme-only allowlist), per the reviewers' Round 1 finding 5.
 */
export async function resolveAndCheckHost(
  hostname: string
): Promise<UrlValidationResult> {
  if (hostname.toLowerCase() === "localhost") {
    return { ok: false, reason: "Loopback hostname blocked" };
  }

  let addresses: string[];
  try {
    const looked = await dns.lookup(hostname, { all: true });
    addresses = looked.map((r) => r.address);
  } catch {
    return { ok: false, reason: "DNS resolution failed" };
  }

  if (addresses.length === 0) {
    return { ok: false, reason: "DNS resolution returned no addresses" };
  }

  for (const addr of addresses) {
    if (isDisallowedIp(addr)) {
      return {
        ok: false,
        reason: `Resolved address ${addr} is in a disallowed private/loopback/link-local range`,
      };
    }
  }

  return { ok: true };
}

function stripHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface SnapshotResult {
  fetchable: boolean;
  snapshot?: string;
  error?: string;
}

/**
 * Fetch a best-effort text snapshot of a URL. Returns `{fetchable: false}`
 * (never throws) on any scheme violation, SSRF block, timeout, oversized
 * body, or network error — the caller treats that as "link-only, no
 * snapshot", not a request failure.
 */
export async function fetchUrlSnapshot(rawUrl: string): Promise<SnapshotResult> {
  const scheme = validateUrlScheme(rawUrl);
  if (!scheme.ok) {
    return { fetchable: false, error: scheme.reason };
  }

  const parsed = new URL(rawUrl);
  const hostCheck = await resolveAndCheckHost(parsed.hostname);
  if (!hostCheck.ok) {
    return { fetchable: false, error: hostCheck.reason };
  }

  try {
    const res = await fetch(parsed.toString(), {
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (res.status >= 300 && res.status < 400) {
      return {
        fetchable: false,
        error: `Redirect responses are not followed (status ${res.status})`,
      };
    }
    if (!res.ok) {
      return { fetchable: false, error: `Fetch failed with status ${res.status}` };
    }
    if (!res.body) {
      return { fetchable: false, error: "Empty response body" };
    }

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    let truncated = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.byteLength > 0) {
        const remaining = MAX_SNAPSHOT_BYTES - total;
        if (remaining <= 0) {
          truncated = true;
          await reader.cancel();
          break;
        }
        const slice = value.byteLength > remaining ? value.slice(0, remaining) : value;
        chunks.push(slice);
        total += slice.byteLength;
        if (value.byteLength > remaining) {
          truncated = true;
          await reader.cancel();
          break;
        }
      }
    }
    void truncated;

    const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    const text = buffer.toString("utf-8");
    const snapshot = stripHtml(text).slice(0, MAX_SNAPSHOT_CHARS);

    return { fetchable: true, snapshot };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown fetch error";
    return { fetchable: false, error: message };
  }
}
