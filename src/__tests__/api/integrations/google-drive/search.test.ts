import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const TENANT_ID = "tenant-1";
const USER_ID = "user-1";

const mockGetDriveAccessToken = vi.fn();
const mockSearchFiles = vi.fn();

vi.mock("@/lib/auth/withTenant", () => ({
  withTenant: (
    handler: (req: NextRequest, ctx: unknown) => Promise<Response>
  ) => {
    return async (req: NextRequest) => {
      const ctx = { tenantId: TENANT_ID, userId: USER_ID, role: "USER" };
      return handler(req, ctx);
    };
  },
}));

vi.mock("@/lib/integrations/googleDrive/session", () => ({
  getDriveAccessToken: (...args: unknown[]) => mockGetDriveAccessToken(...args),
}));

vi.mock("@/lib/integrations/googleDrive/client", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/integrations/googleDrive/client")
  >("@/lib/integrations/googleDrive/client");
  return {
    ...actual,
    searchFiles: (...args: unknown[]) => mockSearchFiles(...args),
  };
});

import { GET } from "@/app/api/integrations/google-drive/search/route";

function req(query: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/integrations/google-drive/search${query}`);
}

describe("GET /api/integrations/google-drive/search (a71-12 Phase 1 AC2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("400s when 'q' is missing", async () => {
    const res = await GET(req(""));
    expect(res.status).toBe(400);
    expect(mockGetDriveAccessToken).not.toHaveBeenCalled();
  });

  it("404s with NOT_CONFIGURED when the connector is not configured (config-gating)", async () => {
    mockGetDriveAccessToken.mockResolvedValue({ ok: false, reason: "not_configured" });

    const res = await GET(req("?q=protocol"));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_CONFIGURED");
    expect(mockSearchFiles).not.toHaveBeenCalled();
  });

  it("400s with NOT_CONNECTED when configured but the user has no connection", async () => {
    mockGetDriveAccessToken.mockResolvedValue({ ok: false, reason: "not_connected" });

    const res = await GET(req("?q=protocol"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("NOT_CONNECTED");
  });

  it("401s with RECONNECT_NEEDED when the stored token is invalid/expired", async () => {
    mockGetDriveAccessToken.mockResolvedValue({ ok: false, reason: "reconnect_needed" });

    const res = await GET(req("?q=protocol"));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error.code).toBe("RECONNECT_NEEDED");
  });

  it("returns matching files on a successful search", async () => {
    mockGetDriveAccessToken.mockResolvedValue({ ok: true, accessToken: "token-abc" });
    mockSearchFiles.mockResolvedValue([
      { id: "f1", name: "Protocol.pdf", mimeType: "application/pdf", modifiedTime: "2026-01-01T00:00:00Z" },
    ]);

    const res = await GET(req("?q=Protocol"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockSearchFiles).toHaveBeenCalledWith("token-abc", "Protocol");
    expect(body.data.files).toEqual([
      {
        id: "f1",
        name: "Protocol.pdf",
        mimeType: "application/pdf",
        modifiedTime: "2026-01-01T00:00:00Z",
        webViewLink: null,
      },
    ]);
  });

  it("returns 429 RATE_LIMITED when Drive rate-limits the search (error handling)", async () => {
    mockGetDriveAccessToken.mockResolvedValue({ ok: true, accessToken: "token-abc" });
    const { DriveRateLimitError } = await import("@/lib/integrations/googleDrive/client");
    mockSearchFiles.mockRejectedValue(new DriveRateLimitError());

    const res = await GET(req("?q=Protocol"));
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error.code).toBe("RATE_LIMITED");
  });

  it("returns 502 DRIVE_ERROR on an unexpected Drive API failure", async () => {
    mockGetDriveAccessToken.mockResolvedValue({ ok: true, accessToken: "token-abc" });
    const { DriveApiError } = await import("@/lib/integrations/googleDrive/client");
    mockSearchFiles.mockRejectedValue(new DriveApiError("boom", 500));

    const res = await GET(req("?q=Protocol"));
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error.code).toBe("DRIVE_ERROR");
  });
});
