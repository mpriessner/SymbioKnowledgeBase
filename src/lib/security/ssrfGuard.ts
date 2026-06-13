import dns from "node:dns";
import net from "node:net";

/**
 * SSRF guard for user-supplied URLs that the server will fetch (audit S5).
 *
 * NOTE ON SCOPE (honest, per live Codex): this performs a DNS-resolution-time
 * check. After it returns, `fetch()` lets undici resolve the hostname AGAIN, so
 * a DNS-rebinding host (public at check-time, private at connect-time) has a
 * residual TOCTOU window. This guard therefore does NOT guarantee "the server
 * never connects to a private address" — only that the host does not RESOLVE to
 * a private/loopback/link-local address at validation time. Combine with
 * `redirect: "error"` on the fetch to close the common public→3xx→private chain.
 * IP-pinning (resolve → connect by the validated IP) would close the rebinding
 * window but is intentionally not implemented for this low-value preview feature.
 */

export class BlockedUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockedUrlError";
  }
}

/** Parse an IPv4 string "a.b.c.d" into its four octets, or null. */
function parseIpv4(ip: string): [number, number, number, number] | null {
  if (net.isIPv4(ip) !== true) return null;
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return null;
  }
  return parts as [number, number, number, number];
}

/** Is this IPv4 address loopback / private / link-local / reserved-unsafe? */
function isBlockedIpv4(ip: string): boolean {
  const octets = parseIpv4(ip);
  if (!octets) return false;
  const [a, b] = octets;
  // 0.0.0.0/8 (incl. the unspecified address)
  if (a === 0) return true;
  // 10.0.0.0/8
  if (a === 10) return true;
  // 127.0.0.0/8 loopback
  if (a === 127) return true;
  // 169.254.0.0/16 link-local (incl. 169.254.169.254 cloud metadata)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  // 100.64.0.0/10 carrier-grade NAT (Tailscale lives here too)
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

/**
 * Decode the IPv4 embedded in an IPv4-mapped/compat IPv6 address to dotted form.
 * Handles BOTH the dotted tail (`::ffff:127.0.0.1`) and the hex-compressed tail
 * that `new URL()` normalizes to (`::ffff:7f00:1` ⇒ 127.0.0.1). Returns null if
 * the address is not a mapped form.
 */
function mappedIpv4(ipLower: string): string | null {
  // Dotted tail, e.g. ::ffff:169.254.169.254
  const dotted = ipLower.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (dotted) return dotted[1];
  // Hex tail after ::ffff:, e.g. ::ffff:a9fe:a9fe or ::ffff:7f00:1
  const hex = ipLower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const hi = parseInt(hex[1], 16);
    const lo = parseInt(hex[2], 16);
    return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
  }
  return null;
}

/** Is this IPv6 address loopback / private / link-local / unique-local / mapped-unsafe? */
function isBlockedIpv6(ip: string): boolean {
  if (net.isIPv6(ip) !== true) return false;
  const lower = ip.toLowerCase();
  // ::1 loopback, :: unspecified
  if (lower === "::1" || lower === "::") return true;
  // IPv4-mapped/compat IPv6 (e.g. ::ffff:169.254.169.254 / ::ffff:7f00:1)
  const mapped = mappedIpv4(lower);
  if (mapped && isBlockedIpv4(mapped)) return true;
  // fe80::/10 link-local
  if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) {
    return true;
  }
  // fc00::/7 unique-local (fc.. / fd..)
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  return false;
}

function isBlockedIp(ip: string): boolean {
  return isBlockedIpv4(ip) || isBlockedIpv6(ip);
}

/**
 * Validate that `rawUrl` is a public http(s) URL safe to fetch server-side.
 * Returns the parsed URL on success; throws BlockedUrlError otherwise.
 */
export async function assertUrlIsFetchable(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new BlockedUrlError("Malformed URL");
  }

  // Only http(s) — blocks file:, ftp:, gopher:, data:, etc.
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new BlockedUrlError(`Unsupported URL scheme: ${url.protocol}`);
  }

  // Strip IPv6 brackets for the hostname checks.
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const hostLower = host.toLowerCase();

  // Reject obvious local names outright (incl. trailing-dot + subdomains).
  if (
    hostLower === "localhost" ||
    hostLower === "localhost." ||
    hostLower.endsWith(".localhost") ||
    hostLower.endsWith(".localhost.")
  ) {
    throw new BlockedUrlError("Loopback host not allowed");
  }

  // If the host is already a literal IP, check it directly (catches decimal/
  // hex IPs only after URL normalization — Node's net.isIP handles dotted form).
  if (net.isIP(host) !== 0) {
    if (isBlockedIp(host)) {
      throw new BlockedUrlError("Private/loopback/link-local address not allowed");
    }
    return url;
  }

  // Otherwise resolve via DNS and reject if ANY resolved address is unsafe.
  let addresses: dns.LookupAddress[];
  try {
    addresses = await dns.promises.lookup(host, { all: true });
  } catch {
    throw new BlockedUrlError("Could not resolve host");
  }

  if (addresses.length === 0) {
    throw new BlockedUrlError("Host did not resolve to any address");
  }

  for (const { address } of addresses) {
    if (isBlockedIp(address)) {
      throw new BlockedUrlError(
        "Host resolves to a private/loopback/link-local address"
      );
    }
  }

  return url;
}
