import { NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import type { TenantContext } from "@/types/auth";
import { MIRROR_ROOT } from "@/lib/sync/config";
import { getDriveAccessToken } from "@/lib/integrations/googleDrive/session";
import {
  createFile,
  DriveRateLimitError,
  DriveApiError,
} from "@/lib/integrations/googleDrive/client";
import { logDriveAction } from "@/lib/integrations/googleDrive/audit";

const uploadSchema = z.object({
  attachment_id: z.string().min(1),
});

const REASON_STATUS: Record<string, { code: string; status: number; message: string }> = {
  not_configured: {
    code: "NOT_CONFIGURED",
    status: 404,
    message: "Google Drive integration is not configured on this server",
  },
  not_connected: {
    code: "NOT_CONNECTED",
    status: 400,
    message: "Connect your Google Drive account before exporting",
  },
  reconnect_needed: {
    code: "RECONNECT_NEEDED",
    status: 401,
    message: "Your Google Drive connection has expired — please reconnect",
  },
};

/**
 * POST /api/integrations/google-drive/upload — export an existing SKB
 * attachment to Google Drive as a new file (a71-12 Phase 2, AC6).
 *
 * Uses `files.create` only (`drive.file` scope) — this can only create a
 * brand-new file in the user's Drive. There is no file id in the request, so
 * it is structurally impossible for this call to overwrite or delete an
 * existing Drive file. No read-modify-write cycle on existing Drive content
 * is implemented or planned.
 */
export const POST = withTenant(async (req: NextRequest, ctx: TenantContext) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("VALIDATION_ERROR", "Expected JSON body", undefined, 400);
  }

  const parsed = uploadSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("VALIDATION_ERROR", "Invalid request body", undefined, 400);
  }

  const attachment = await prisma.fileAttachment.findFirst({
    where: { id: parsed.data.attachment_id, tenantId: ctx.tenantId, status: "READY" },
  });
  if (!attachment) {
    return errorResponse("NOT_FOUND", "Attachment not found", undefined, 404);
  }

  const tenantRoot = path.resolve(MIRROR_ROOT);
  const absPath = path.resolve(MIRROR_ROOT, attachment.storagePath);
  if (absPath !== tenantRoot && !absPath.startsWith(tenantRoot + path.sep)) {
    return errorResponse("VALIDATION_ERROR", "Invalid attachment path", undefined, 400);
  }

  let bytes: Buffer;
  try {
    bytes = await fs.readFile(absPath);
  } catch {
    return errorResponse("NOT_FOUND", "Attachment file missing on disk", undefined, 404);
  }

  const session = await getDriveAccessToken(ctx.tenantId, ctx.userId);
  if (!session.ok) {
    const mapped = REASON_STATUS[session.reason];
    return errorResponse(mapped.code, mapped.message, undefined, mapped.status);
  }

  try {
    const created = await createFile(
      session.accessToken,
      attachment.fileName,
      attachment.mimeType || "application/octet-stream",
      bytes
    );

    await logDriveAction(ctx, "google_drive.upload", attachment.id, {
      driveFileId: created.id,
      fileSize: bytes.length,
    });

    return successResponse(
      {
        drive_file_id: created.id,
        name: created.name,
        web_view_link: created.webViewLink ?? null,
      },
      undefined,
      201
    );
  } catch (error) {
    if (error instanceof DriveRateLimitError) {
      return errorResponse("RATE_LIMITED", error.message, undefined, 429);
    }
    if (error instanceof DriveApiError) {
      return errorResponse("DRIVE_ERROR", error.message, undefined, 502);
    }
    return errorResponse("INTERNAL_ERROR", "Failed to upload to Google Drive", undefined, 500);
  }
});
