import { describe, test, expect, vi, beforeEach } from "vitest";

// Verifies the audit S15 MUST-FIX: a failed lastUsedAt update on the cookie-path
// API-key resolver (resolveApiKey) is routed through the structured logger, not
// swallowed with a bare console.error.

const mockApiKeyFindFirst = vi.fn();
const mockApiKeyUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    apiKey: {
      findFirst: (...a: unknown[]) => mockApiKeyFindFirst(...a),
      update: (...a: unknown[]) => mockApiKeyUpdate(...a),
    },
  },
}));

const mockLogAuthEvent = vi.fn(async (..._a: unknown[]) => {});
vi.mock("@/lib/agent/audit", () => ({
  logAuthEvent: (...a: unknown[]) => mockLogAuthEvent(...a),
}));

const { resolveApiKey } = await import("@/lib/apiAuth");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveApiKey lastUsedAt failure (audit S15)", () => {
  test("routes a failed lastUsedAt update through the structured logger", async () => {
    mockApiKeyFindFirst.mockResolvedValue({
      id: "key-x",
      user: { id: "user-x", tenantId: "tenant-x", role: "USER" },
    });
    mockApiKeyUpdate.mockRejectedValue(new Error("lastUsedAt write failed"));

    const ctx = await resolveApiKey("Bearer skb_live_whatever");

    // Resolution still succeeds despite the update failure.
    expect(ctx).toMatchObject({ tenantId: "tenant-x", userId: "user-x" });

    // The fire-and-forget .catch runs on the microtask queue.
    await new Promise((r) => setTimeout(r, 0));

    expect(mockLogAuthEvent).toHaveBeenCalledWith(
      "key.last_used_update_failed",
      "apiKey.lastUsedAt",
      expect.objectContaining({ apiKeyId: "key-x", userId: "user-x", tenantId: "tenant-x" }),
      expect.objectContaining({ reason: "lastUsedAt write failed" })
    );
  });

  test("returns null for an unknown key (no logging)", async () => {
    mockApiKeyFindFirst.mockResolvedValue(null);
    const ctx = await resolveApiKey("Bearer skb_live_unknown");
    expect(ctx).toBeNull();
    expect(mockLogAuthEvent).not.toHaveBeenCalled();
  });
});
