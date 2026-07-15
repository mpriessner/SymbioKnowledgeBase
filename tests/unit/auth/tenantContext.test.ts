import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ────────────────────────────────────────────────────────────────
// getTenantContext depends on: the canonical API-key verifier (apiAuth),
// the Supabase server client (@supabase/ssr), and the user-provisioning
// helper (ensureUserExists). We mock all three so we can drive each branch.

vi.mock("@/lib/apiAuth", () => ({
  resolveApiKey: vi.fn(),
}));

const mockGetUser = vi.fn();
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

vi.mock("@/lib/auth/ensureUserExists", () => ({
  ensureUserExists: vi.fn(),
}));

import { getTenantContext, AuthenticationError } from "@/lib/tenantContext";
import { resolveApiKey } from "@/lib/apiAuth";
import { ensureUserExists } from "@/lib/auth/ensureUserExists";

const mockedResolveApiKey = vi.mocked(resolveApiKey);
const mockedEnsureUserExists = vi.mocked(ensureUserExists);

// Placeholder Supabase URL that getTenantContext treats as "configured".
const VALID_SUPABASE_URL = "http://localhost:54341";
const VALID_SUPABASE_KEY = "anon-key";

function createMockRequest(headers: Record<string, string> = {}): NextRequest {
  const headersInit = new Headers();
  Object.entries(headers).forEach(([key, value]) =>
    headersInit.set(key, value)
  );
  return new NextRequest("http://localhost:3000/api/test", {
    headers: headersInit,
  });
}

/** Configure Supabase env so the cookie-session branch is reachable. */
function withSupabaseConfigured() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", VALID_SUPABASE_URL);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", VALID_SUPABASE_KEY);
}

/** Clear Supabase env so the "not configured" branch is reachable. */
function withSupabaseUnconfigured() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
}

describe("getTenantContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ── API key path ─────────────────────────────────────────────────────
  describe("API key authentication", () => {
    it("resolves context from a valid API key", async () => {
      mockedResolveApiKey.mockResolvedValue({
        tenantId: "tenant-789",
        userId: "user-abc",
        role: "USER",
        apiKeyId: "key-1",
        scopes: ["read", "write"],
      });

      const req = createMockRequest({
        authorization: "Bearer skb_live_abcdef1234567890",
      });
      const ctx = await getTenantContext(req);

      expect(ctx.tenantId).toBe("tenant-789");
      expect(ctx.userId).toBe("user-abc");
      expect(ctx.role).toBe("USER");
    });

    it("takes precedence over a Supabase session", async () => {
      withSupabaseConfigured();
      mockGetUser.mockResolvedValue({
        data: { user: { id: "session-user" } },
      });
      mockedEnsureUserExists.mockResolvedValue({
        id: "session-user",
        tenantId: "session-tenant",
        role: "ADMIN",
      });
      mockedResolveApiKey.mockResolvedValue({
        tenantId: "apikey-tenant",
        userId: "apikey-user",
        role: "USER",
        apiKeyId: "key-1",
        scopes: ["read"],
      });

      const req = createMockRequest({
        authorization: "Bearer skb_live_test",
      });
      const ctx = await getTenantContext(req);

      expect(ctx.tenantId).toBe("apikey-tenant");
      expect(ctx.userId).toBe("apikey-user");
    });

    it("throws 401 when the bearer token is invalid/revoked", async () => {
      mockedResolveApiKey.mockResolvedValue(null);

      const req = createMockRequest({
        authorization: "Bearer invalid-key",
      });

      await expect(getTenantContext(req)).rejects.toThrow(AuthenticationError);
      await expect(getTenantContext(req)).rejects.toThrow(
        "Invalid or revoked API key"
      );
    });
  });

  // ── Supabase session path ────────────────────────────────────────────
  describe("Supabase session authentication", () => {
    it("resolves context from a valid session", async () => {
      withSupabaseConfigured();
      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
      });
      mockedEnsureUserExists.mockResolvedValue({
        id: "user-123",
        tenantId: "tenant-456",
        role: "USER",
      });

      const req = createMockRequest();
      const ctx = await getTenantContext(req);

      expect(ctx).toEqual({
        tenantId: "tenant-456",
        userId: "user-123",
        role: "USER",
      });
    });

    it("throws when configured but there is no session user", async () => {
      withSupabaseConfigured();
      mockGetUser.mockResolvedValue({ data: { user: null } });

      const req = createMockRequest();

      await expect(getTenantContext(req)).rejects.toThrow(AuthenticationError);
      await expect(getTenantContext(req)).rejects.toThrow(
        "Authentication required"
      );
    });
  });

  // ── FAIL CLOSED on missing Supabase config (the critical fix) ─────────
  describe("missing Supabase config — fail closed", () => {
    it("throws (never synthesizes ADMIN) in production", async () => {
      withSupabaseUnconfigured();
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("ALLOW_DEV_AUTH", "1"); // must be ignored in production

      const req = createMockRequest();

      await expect(getTenantContext(req)).rejects.toThrow(AuthenticationError);
      // Crucially: it does NOT return an ADMIN context.
      await expect(getTenantContext(req)).rejects.toThrow(
        "Authentication is not configured"
      );
    });

    it("throws in non-production when ALLOW_DEV_AUTH is not set", async () => {
      withSupabaseUnconfigured();
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("ALLOW_DEV_AUTH", "");

      const req = createMockRequest();

      await expect(getTenantContext(req)).rejects.toThrow(AuthenticationError);
    });

    it("allows the dev fallback only when NODE_ENV!=production AND ALLOW_DEV_AUTH=1", async () => {
      withSupabaseUnconfigured();
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("ALLOW_DEV_AUTH", "1");
      vi.stubEnv("DEFAULT_TENANT_ID", "00000000-0000-4000-a000-000000000001");

      const req = createMockRequest();
      const ctx = await getTenantContext(req);

      expect(ctx.role).toBe("ADMIN");
      expect(ctx.userId).toBe("dev-user");
      expect(ctx.tenantId).toBe("00000000-0000-4000-a000-000000000001");
    });
  });
});
