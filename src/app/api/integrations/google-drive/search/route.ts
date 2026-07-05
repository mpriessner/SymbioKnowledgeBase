import { NextRequest } from "next/server";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import type { TenantContext } from "@/types/auth";
import { getDriveAccessToken } from "@/lib/integrations/googleDrive/session";
import {
  searchFiles,
  DriveRateLimitError,
  DriveApiError,
} from "@/lib/integrations/googleDrive/client";

const REASON_STATUS: Record<string, { code: string; status: number; message: string }> = {
  not_configured: {
    code: "NOT_CONFIGURED",
    status: 404,
    message: "Google Drive integration is not configured on this server",
  },
  not_connected: {
    code: "NOT_CONNECTED",
    status: 400,
    message: "Connect your Google Drive account before searching",
  },
  reconnect_needed: {
    code: "RECONNECT_NEEDED",
    status: 401,
    message: "Your Google Drive connection has expired — please reconnect",
  },
};

/**
 * GET /api/integrations/google-drive/search?q=... — search the caller's
 * Drive (read-only `files.list`, a71-12 Phase 1 AC2). Returns name, mime
 * type, and modified date for matching files.
 */
export const GET = withTenant(async (req: NextRequest, ctx: TenantContext) => {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q) {
    return errorResponse("VALIDATION_ERROR", "Missing required query param 'q'", undefined, 400);
  }

  const session = await getDriveAccessToken(ctx.tenantId, ctx.userId);
  if (!session.ok) {
    const mapped = REASON_STATUS[session.reason];
    return errorResponse(mapped.code, mapped.message, undefined, mapped.status);
  }

  try {
    const files = await searchFiles(session.accessToken, q);
    return successResponse({
      files: files.map((f) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        modifiedTime: f.modifiedTime,
        webViewLink: f.webViewLink ?? null,
      })),
    });
  } catch (error) {
    if (error instanceof DriveRateLimitError) {
      return errorResponse("RATE_LIMITED", error.message, undefined, 429);
    }
    if (error instanceof DriveApiError) {
      return errorResponse("DRIVE_ERROR", error.message, undefined, 502);
    }
    return errorResponse(
      "INTERNAL_ERROR",
      "Failed to search Google Drive",
      undefined,
      500
    );
  }
});
