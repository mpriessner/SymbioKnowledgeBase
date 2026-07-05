import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const TENANT_ID = "tenant-1";
const USER_ID = "user-1";

const mockIsDriveConfigured = vi.fn();
const mockLoadGoogleDriveConfig = vi.fn();
const mockConsumeOAuthState = vi.fn();
const mockExchangeCodeForTokens = vi.fn();
const mockSaveConnection = vi.fn();
const mockLogDriveAction = vi.fn();

const VALID_CONFIG = {
  clientId: "cid",
  clientSecret: "secret",
  redirectUri: "https://kb.example.com/api/integrations/google-drive/callback",
  tokenEncKey: "a".repeat(64),
};

vi.mock("@/lib/integrations/googleDrive/config", () => ({
  isDriveConfigured: (...args: unknown[]) => mockIsDriveConfigured(...args),
  loadGoogleDriveConfig: (...args: unknown[]) => mockLoadGoogleDriveConfig(...args),
}));

vi.mock("@/lib/integrations/googleDrive/oauthState", () => ({
  consumeOAuthState: (...args: unknown[]) => mockConsumeOAuthState(...args),
}));

vi.mock("@/lib/integrations/googleDrive/client", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/integrations/googleDrive/client")
  >("@/lib/integrations/googleDrive/client");
  return {
    ...actual,
    exchangeCodeForTokens: (...args: unknown[]) => mockExchangeCodeForTokens(...args),
  };
});

vi.mock("@/lib/integrations/googleDrive/tokenStore", () => ({
  saveConnection: (...args: unknown[]) => mockSaveConnection(...args),
}));

vi.mock("@/lib/integrations/googleDrive/audit", () => ({
  logDriveAction: (...args: unknown[]) => mockLogDriveAction(...args),
}));

import { GET } from "@/app/api/integrations/google-drive/callback/route";

function req(query: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/integrations/google-drive/callback${query}`);
}

describe("GET /api/integrations/google-drive/callback (a71-12 Phase 1 AC9 — OAuth CSRF state)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDriveConfigured.mockReturnValue(true);
    mockLoadGoogleDriveConfig.mockReturnValue(VALID_CONFIG);
  });

  it("404s with NOT_CONFIGURED when the connector is not configured (config-gating)", async () => {
    mockIsDriveConfigured.mockReturnValue(false);

    const res = await GET(req("?state=s&code=c"));
    expect(res.status).toBe(404);
    expect(mockConsumeOAuthState).not.toHaveBeenCalled();
  });

  it("rejects a callback with a missing state", async () => {
    const res = await GET(req("?code=c"));
    expect(res.status).toBe(400);
    expect(mockConsumeOAuthState).not.toHaveBeenCalled();
  });

  it("rejects a callback with a missing code", async () => {
    const res = await GET(req("?state=s"));
    expect(res.status).toBe(400);
    expect(mockConsumeOAuthState).not.toHaveBeenCalled();
  });

  it("rejects a callback whose state is unknown/expired/already-consumed", async () => {
    mockConsumeOAuthState.mockResolvedValue(null);

    const res = await GET(req("?state=forged-state&code=c"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.message).toMatch(/state/i);
    expect(mockExchangeCodeForTokens).not.toHaveBeenCalled();
  });

  it("exchanges the code and stores the connection when state is valid (happy path)", async () => {
    mockConsumeOAuthState.mockResolvedValue({ tenantId: TENANT_ID, userId: USER_ID });
    mockExchangeCodeForTokens.mockResolvedValue({
      access_token: "access-1",
      refresh_token: "refresh-1",
      expires_in: 3600,
      scope: "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file",
    });

    const res = await GET(req("?state=valid-state&code=auth-code"));

    expect(res.status).toBe(307); // NextResponse.redirect
    expect(mockSaveConnection).toHaveBeenCalledWith(
      TENANT_ID,
      USER_ID,
      "refresh-1",
      expect.arrayContaining([
        "https://www.googleapis.com/auth/drive.readonly",
        "https://www.googleapis.com/auth/drive.file",
      ])
    );
    expect(mockLogDriveAction).toHaveBeenCalledWith(
      { tenantId: TENANT_ID, userId: USER_ID },
      "google_drive.connect",
      undefined,
      expect.any(Object)
    );
  });

  it("errors cleanly (never stores a connection) when Google grants no refresh token", async () => {
    mockConsumeOAuthState.mockResolvedValue({ tenantId: TENANT_ID, userId: USER_ID });
    mockExchangeCodeForTokens.mockResolvedValue({
      access_token: "access-1",
      expires_in: 3600,
    });

    const res = await GET(req("?state=valid-state&code=auth-code"));

    expect(res.status).toBe(502);
    expect(mockSaveConnection).not.toHaveBeenCalled();
  });

  it("rejects when Google reports an OAuth error/denial", async () => {
    const res = await GET(req("?error=access_denied"));
    expect(res.status).toBe(400);
    expect(mockConsumeOAuthState).not.toHaveBeenCalled();
  });
});
