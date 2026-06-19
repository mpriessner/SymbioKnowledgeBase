import { NextRequest } from "next/server";
import { z } from "zod";
import dns from "dns/promises";
import net from "net";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { withTenant } from "@/lib/auth/withTenant";

// Requires Node built-ins (dns/promises, net) for SSRF address validation.
export const runtime = "nodejs";

const ogMetadataSchema = z.object({
  url: z.string().url("Invalid URL"),
});

/** Max bytes of HTML we will read before giving up (DoS guard). */
const MAX_BODY_BYTES = 512 * 1024; // 512 KB
/** Max redirect hops we will follow, re-validating each one. */
const MAX_REDIRECTS = 5;
/** Overall fetch timeout. */
const FETCH_TIMEOUT_MS = 5000;

/**
 * POST /api/og-metadata -- Fetch Open Graph metadata for a URL.
 *
 * SSRF-hardened: only http/https, the destination host must resolve to a
 * public IP, redirects are followed manually and each hop is re-validated, and
 * the response body is size-capped. Wrapped in withTenant because it is a
 * user-triggered, server-side outbound fetch (bookmark link unfurl).
 */
export const POST = withTenant(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const parsed = ogMetadataSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid input",
        parsed.error.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
        400
      );
    }

    const { url } = parsed.data;

    // SSRF-safe fetch: validates scheme + resolved IP for the URL and every
    // redirect hop. Returns null if the URL is blocked.
    const result = await safeFetchHtml(url);
    if (!result) {
      // Generic message — do not reveal why a host was blocked.
      return errorResponse("FETCH_FAILED", "Failed to fetch URL", undefined, 502);
    }

    const { html, finalUrl } = result;

    // Parse OG meta tags from HTML
    const title =
      extractMetaContent(html, "og:title") || extractTitle(html) || "";
    const description =
      extractMetaContent(html, "og:description") ||
      extractMetaContent(html, "description") ||
      "";
    const image = extractMetaContent(html, "og:image") || "";
    const favicon = extractFavicon(html, finalUrl);

    return successResponse({
      title,
      description,
      favicon,
      image: resolveUrl(image, finalUrl),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return errorResponse("TIMEOUT", "Request timeout", undefined, 504);
    }
    console.error("OG metadata fetch error:", error);
    return errorResponse(
      "INTERNAL_ERROR",
      "Failed to fetch metadata",
      undefined,
      500
    );
  }
});

/**
 * Fetch HTML for a URL with full SSRF protection. Returns the body (capped)
 * and the final URL after redirects, or null if any hop is disallowed.
 */
async function safeFetchHtml(
  initialUrl: string
): Promise<{ html: string; finalUrl: string } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    let currentUrl = initialUrl;

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      // Validate scheme + resolve host → reject private/reserved IPs.
      if (!(await isPublicHttpUrl(currentUrl))) {
        return null;
      }

      const response = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: "manual", // never let fetch auto-follow to an internal host
        headers: {
          "User-Agent": "SymbioKnowledgeBase/1.0 (Bookmark Preview)",
          Accept: "text/html",
        },
      });

      // Manual redirect handling: re-validate the next hop.
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) return null;
        // Resolve relative redirects against the current URL.
        try {
          currentUrl = new URL(location, currentUrl).toString();
        } catch {
          return null;
        }
        continue;
      }

      if (!response.ok) {
        return null;
      }

      const html = await readCappedText(response, MAX_BODY_BYTES);
      return { html, finalUrl: currentUrl };
    }

    // Too many redirects.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Read a response body as text, aborting once MAX bytes have been read so a
 * malicious/huge page cannot exhaust memory.
 */
async function readCappedText(
  response: Response,
  maxBytes: number
): Promise<string> {
  // Fast reject if the server advertises an oversized body.
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    return "";
  }

  const reader = response.body?.getReader();
  if (!reader) {
    // No stream available — fall back, but still bound it.
    const text = await response.text();
    return text.slice(0, maxBytes);
  }

  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      received += value.length;
      chunks.push(value);
      if (received >= maxBytes) {
        await reader.cancel();
        break;
      }
    }
  }

  const merged = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk.subarray(0, Math.min(chunk.length, merged.length - offset)), offset);
    offset += chunk.length;
    if (offset >= merged.length) break;
  }
  return new TextDecoder("utf-8").decode(merged.subarray(0, maxBytes));
}

/**
 * Validate that a URL uses http(s) and resolves only to public IP addresses.
 * Blocks loopback, private, link-local, and reserved ranges (IPv4 + IPv6),
 * the IMDS endpoint 169.254.169.254, and the literal host "localhost".
 */
async function isPublicHttpUrl(rawUrl: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }

  // Strip IPv6 brackets if present.
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();

  // Block obvious internal names outright.
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    return false;
  }

  // Collect the set of IPs this request could actually hit.
  let addresses: string[];
  if (net.isIP(hostname) !== 0) {
    addresses = [hostname];
  } else {
    try {
      const records = await dns.lookup(hostname, { all: true });
      addresses = records.map((r) => r.address);
    } catch {
      return false;
    }
  }

  if (addresses.length === 0) return false;

  // Every resolved address must be public — reject if ANY is internal, to
  // defend against DNS rebinding returning a mix.
  return addresses.every((addr) => isPublicAddress(addr));
}

/**
 * Returns true only if the IP address is a routable, public address.
 */
function isPublicAddress(address: string): boolean {
  const version = net.isIP(address);
  if (version === 4) return isPublicIPv4(address);
  if (version === 6) return isPublicIPv6(address);
  return false;
}

function isPublicIPv4(address: string): boolean {
  const parts = address.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    return false;
  }
  const [a, b] = parts;

  // 0.0.0.0/8 — "this" network / unspecified
  if (a === 0) return false;
  // 10.0.0.0/8 — private
  if (a === 10) return false;
  // 127.0.0.0/8 — loopback
  if (a === 127) return false;
  // 169.254.0.0/16 — link-local (incl. 169.254.169.254 cloud metadata)
  if (a === 169 && b === 254) return false;
  // 172.16.0.0/12 — private
  if (a === 172 && b >= 16 && b <= 31) return false;
  // 192.168.0.0/16 — private
  if (a === 192 && b === 168) return false;
  // 100.64.0.0/10 — carrier-grade NAT
  if (a === 100 && b >= 64 && b <= 127) return false;
  // 192.0.0.0/24 — IETF protocol assignments
  if (a === 192 && b === 0 && parts[2] === 0) return false;
  // 198.18.0.0/15 — benchmarking
  if (a === 198 && (b === 18 || b === 19)) return false;
  // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved/broadcast
  if (a >= 224) return false;

  return true;
}

function isPublicIPv6(address: string): boolean {
  const addr = address.toLowerCase();

  // ::1 loopback, :: unspecified
  if (addr === "::1" || addr === "::") return false;

  // Normalize IPv4-mapped/compat forms (::ffff:127.0.0.1, ::127.0.0.1) and
  // validate the embedded IPv4 against the v4 rules.
  const mapped = /^::(ffff:)?(\d+\.\d+\.\d+\.\d+)$/.exec(addr);
  if (mapped) {
    return isPublicIPv4(mapped[2]);
  }

  // fc00::/7 — unique local addresses (fc.. / fd..)
  if (/^f[cd]/.test(addr)) return false;
  // fe80::/10 — link-local
  if (/^fe[89ab]/.test(addr)) return false;
  // ff00::/8 — multicast
  if (addr.startsWith("ff")) return false;

  return true;
}

/**
 * Extract content from a meta tag by property or name attribute.
 */
function extractMetaContent(html: string, property: string): string {
  // Try property attribute first (OG tags)
  const propertyRegex = new RegExp(
    `<meta[^>]*property=["']${escapeRegex(property)}["'][^>]*content=["']([^"']*)["']`,
    "i"
  );
  const propertyMatch = html.match(propertyRegex);
  if (propertyMatch?.[1]) return propertyMatch[1];

  // Try reversed attribute order
  const reversedRegex = new RegExp(
    `<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${escapeRegex(property)}["']`,
    "i"
  );
  const reversedMatch = html.match(reversedRegex);
  if (reversedMatch?.[1]) return reversedMatch[1];

  // Try name attribute (standard meta tags)
  const nameRegex = new RegExp(
    `<meta[^>]*name=["']${escapeRegex(property)}["'][^>]*content=["']([^"']*)["']`,
    "i"
  );
  const nameMatch = html.match(nameRegex);
  if (nameMatch?.[1]) return nameMatch[1];

  return "";
}

/**
 * Extract the <title> tag content.
 */
function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match?.[1]?.trim() ?? "";
}

/**
 * Extract the favicon URL from the HTML.
 */
function extractFavicon(html: string, baseUrl: string): string {
  const iconRegex =
    /<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']*)["']/i;
  const match = html.match(iconRegex);
  if (match?.[1]) {
    return resolveUrl(match[1], baseUrl);
  }
  // Default favicon location
  try {
    const parsed = new URL(baseUrl);
    return `${parsed.origin}/favicon.ico`;
  } catch {
    return "";
  }
}

/**
 * Resolve a potentially relative URL against a base URL.
 */
function resolveUrl(url: string, base: string): string {
  if (!url) return "";
  try {
    return new URL(url, base).toString();
  } catch {
    return url;
  }
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
