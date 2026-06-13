import { describe, test, expect, vi, beforeEach } from "vitest";

// Mock node:dns so we control what hostnames resolve to (no real network).
const mockLookup = vi.fn();
vi.mock("node:dns", () => ({
  default: {
    promises: {
      lookup: (...a: unknown[]) => mockLookup(...a),
    },
  },
}));

const { assertUrlIsFetchable, BlockedUrlError } = await import(
  "@/lib/security/ssrfGuard"
);

beforeEach(() => {
  vi.clearAllMocks();
  // Default: public-looking resolution for any hostname not a literal IP.
  mockLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
});

describe("assertUrlIsFetchable — schemes", () => {
  test.each(["file:///etc/passwd", "ftp://x/y", "gopher://x", "data:text/plain,hi"])(
    "rejects non-http(s) scheme: %s",
    async (u) => {
      await expect(assertUrlIsFetchable(u)).rejects.toBeInstanceOf(BlockedUrlError);
    }
  );

  test("rejects a malformed URL", async () => {
    await expect(assertUrlIsFetchable("not a url")).rejects.toBeInstanceOf(
      BlockedUrlError
    );
  });
});

describe("assertUrlIsFetchable — literal IPs (no DNS)", () => {
  test.each([
    "http://127.0.0.1/",
    "http://127.255.255.254/",
    "http://10.0.0.5/",
    "http://172.16.0.1/",
    "http://172.31.255.255/",
    "http://192.168.1.1/",
    "http://169.254.169.254/latest/meta-data/", // cloud metadata
    "http://0.0.0.0/",
    "http://100.100.100.100/", // CGNAT / Tailscale range
    "http://[::1]/",
    "http://[::]/",
    "http://[::ffff:169.254.169.254]/", // IPv4-mapped IPv6
    "http://[::ffff:127.0.0.1]/",
    "http://[fe80::1]/", // link-local
    "http://[fc00::1]/", // unique-local
    "http://[fd12:3456::1]/",
  ])("blocks private/loopback/link-local literal IP: %s", async (u) => {
    await expect(assertUrlIsFetchable(u)).rejects.toBeInstanceOf(BlockedUrlError);
    expect(mockLookup).not.toHaveBeenCalled();
  });

  test("allows a public literal IP", async () => {
    const url = await assertUrlIsFetchable("http://93.184.216.34/");
    expect(url.hostname).toBe("93.184.216.34");
  });
});

describe("assertUrlIsFetchable — hostnames", () => {
  test.each(["http://localhost/", "http://localhost./", "http://api.localhost/"])(
    "blocks localhost forms: %s",
    async (u) => {
      await expect(assertUrlIsFetchable(u)).rejects.toBeInstanceOf(BlockedUrlError);
    }
  );

  test("blocks a hostname that DNS-resolves to a private address", async () => {
    mockLookup.mockResolvedValue([{ address: "10.0.0.1", family: 4 }]);
    await expect(
      assertUrlIsFetchable("http://internal.example.com/")
    ).rejects.toBeInstanceOf(BlockedUrlError);
  });

  test("blocks host.docker.internal (resolves to a private host-gateway)", async () => {
    mockLookup.mockResolvedValue([{ address: "192.168.65.2", family: 4 }]);
    await expect(
      assertUrlIsFetchable("http://host.docker.internal:54341/")
    ).rejects.toBeInstanceOf(BlockedUrlError);
  });

  test("blocks if ANY resolved address is private (mixed result)", async () => {
    mockLookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ]);
    await expect(
      assertUrlIsFetchable("http://rebind.example.com/")
    ).rejects.toBeInstanceOf(BlockedUrlError);
  });

  test("allows a public hostname", async () => {
    const url = await assertUrlIsFetchable("https://example.com/page");
    expect(url.protocol).toBe("https:");
    expect(url.hostname).toBe("example.com");
  });

  test("throws when DNS resolution fails", async () => {
    mockLookup.mockRejectedValue(new Error("ENOTFOUND"));
    await expect(
      assertUrlIsFetchable("http://does-not-exist.invalid/")
    ).rejects.toBeInstanceOf(BlockedUrlError);
  });
});
