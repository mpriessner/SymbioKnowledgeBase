import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import dns from "dns/promises";

vi.mock("dns/promises", () => ({
  default: {
    lookup: vi.fn(),
  },
  lookup: vi.fn(),
}));

import {
  validateUrlScheme,
  isDisallowedIp,
  resolveAndCheckHost,
  fetchUrlSnapshot,
} from "@/lib/documents/urlSnapshot";

const mockedLookup = vi.mocked(dns.lookup);

describe("validateUrlScheme (a71-08 AC7 — scheme allowlist)", () => {
  it("accepts http URLs", () => {
    expect(validateUrlScheme("http://example.com/doc.pdf").ok).toBe(true);
  });

  it("accepts https URLs", () => {
    expect(validateUrlScheme("https://example.com/doc.pdf").ok).toBe(true);
  });

  it("rejects javascript: URLs", () => {
    const result = validateUrlScheme("javascript:alert(1)");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/scheme/i);
  });

  it("rejects file: URLs", () => {
    const result = validateUrlScheme("file:///etc/passwd");
    expect(result.ok).toBe(false);
  });

  it("rejects data: URLs", () => {
    expect(validateUrlScheme("data:text/plain;base64,SGVsbG8=").ok).toBe(false);
  });

  it("rejects malformed URLs", () => {
    const result = validateUrlScheme("not a url");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/malformed/i);
  });
});

describe("isDisallowedIp (a71-08 AC7 — resolved-IP SSRF gate)", () => {
  it("blocks the cloud metadata endpoint", () => {
    expect(isDisallowedIp("169.254.169.254")).toBe(true);
  });

  it("blocks loopback", () => {
    expect(isDisallowedIp("127.0.0.1")).toBe(true);
  });

  it("blocks IPv6 loopback", () => {
    expect(isDisallowedIp("::1")).toBe(true);
  });

  it("blocks RFC-1918 10.0.0.0/8", () => {
    expect(isDisallowedIp("10.1.2.3")).toBe(true);
  });

  it("blocks RFC-1918 172.16.0.0/12", () => {
    expect(isDisallowedIp("172.16.0.1")).toBe(true);
    expect(isDisallowedIp("172.31.255.255")).toBe(true);
  });

  it("does not block 172.32.x.x (outside the /12 range)", () => {
    expect(isDisallowedIp("172.32.0.1")).toBe(false);
  });

  it("blocks RFC-1918 192.168.0.0/16", () => {
    expect(isDisallowedIp("192.168.1.1")).toBe(true);
  });

  it("allows a public IPv4 address", () => {
    expect(isDisallowedIp("93.184.216.34")).toBe(false);
  });

  it("fails closed on malformed input", () => {
    expect(isDisallowedIp("not-an-ip")).toBe(true);
  });
});

describe("resolveAndCheckHost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects the literal hostname 'localhost' without a DNS lookup", async () => {
    const result = await resolveAndCheckHost("localhost");
    expect(result.ok).toBe(false);
    expect(mockedLookup).not.toHaveBeenCalled();
  });

  it("blocks a hostname that resolves to the cloud metadata IP", async () => {
    mockedLookup.mockResolvedValue([
      { address: "169.254.169.254", family: 4 },
    ] as never);
    const result = await resolveAndCheckHost("metadata.internal.example.com");
    expect(result.ok).toBe(false);
  });

  it("allows a hostname that resolves to a public address", async () => {
    mockedLookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
    ] as never);
    const result = await resolveAndCheckHost("example.com");
    expect(result.ok).toBe(true);
  });

  it("blocks when DNS resolution fails", async () => {
    mockedLookup.mockRejectedValue(new Error("ENOTFOUND"));
    const result = await resolveAndCheckHost("doesnotexist.invalid");
    expect(result.ok).toBe(false);
  });
});

describe("fetchUrlSnapshot (a71-08 AC2, AC7, AC9)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("is non-fatal for a rejected scheme — returns fetchable: false, does not throw", async () => {
    const result = await fetchUrlSnapshot("javascript:alert(1)");
    expect(result.fetchable).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("is non-fatal when the resolved host is a private/loopback address", async () => {
    mockedLookup.mockResolvedValue([
      { address: "169.254.169.254", family: 4 },
    ] as never);
    const result = await fetchUrlSnapshot("http://metadata.example.com/latest");
    expect(result.fetchable).toBe(false);
  });

  it("fetches and returns a snapshot for a safe, public, fetchable URL", async () => {
    mockedLookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
    ] as never);

    const body = "<html><body><p>Hello snapshot world</p></body></html>";
    global.fetch = vi.fn().mockResolvedValue(
      new Response(body, { status: 200, headers: { "content-type": "text/html" } })
    ) as unknown as typeof fetch;

    const result = await fetchUrlSnapshot("https://example.com/doc");
    expect(result.fetchable).toBe(true);
    expect(result.snapshot).toContain("Hello snapshot world");
  });

  it("is non-fatal on a fetch-time network error (simulating a hang/timeout)", async () => {
    mockedLookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
    ] as never);
    global.fetch = vi
      .fn()
      .mockRejectedValue(new Error("The operation was aborted"));

    const result = await fetchUrlSnapshot("https://slow.example.com/doc");
    expect(result.fetchable).toBe(false);
    expect(result.error).toMatch(/abort/i);
  });

  it("caps an oversized response body rather than buffering it unbounded", async () => {
    mockedLookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
    ] as never);

    // Simulate a stream that would exceed the ~1MB cap.
    const oversized = "x".repeat(2 * 1024 * 1024);
    global.fetch = vi.fn().mockResolvedValue(
      new Response(oversized, { status: 200 })
    ) as unknown as typeof fetch;

    const result = await fetchUrlSnapshot("https://big.example.com/doc");
    expect(result.fetchable).toBe(true);
    // Snapshot text is truncated well below the raw 2MB body.
    expect(result.snapshot!.length).toBeLessThan(oversized.length);
  });

  it("does not follow redirect responses", async () => {
    mockedLookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
    ] as never);
    global.fetch = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: "http://169.254.169.254/latest" },
      })
    ) as unknown as typeof fetch;

    const result = await fetchUrlSnapshot("https://example.com/redirects-away");
    expect(result.fetchable).toBe(false);
    expect(result.error).toMatch(/redirect/i);
  });
});
