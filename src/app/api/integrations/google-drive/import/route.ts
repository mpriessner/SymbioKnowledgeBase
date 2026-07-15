import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import type { TenantContext } from "@/types/auth";
import type { Prisma } from "@/generated/prisma/client";
import { renderDocumentTemplate } from "@/lib/chemistryKb/documentTemplate";
import { markdownToTiptap } from "@/lib/agent/markdown";
import { extractPlainText } from "@/lib/search/indexer";
import { generatePagePath } from "@/lib/agent/pageTree";
import { storeAttachment } from "@/lib/sync/attachments";
import type { TipTapDocument } from "@/lib/wikilinks/types";
import { getDriveAccessToken } from "@/lib/integrations/googleDrive/session";
import {
  getFileMetadata,
  downloadFile,
  DriveRateLimitError,
  DriveApiError,
} from "@/lib/integrations/googleDrive/client";
import { logDriveAction } from "@/lib/integrations/googleDrive/audit";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB — mirrors the attachments route cap

const importSchema = z
  .object({
    file_id: z.string().min(1).max(256),
    space: z.enum(["private", "team"]),
    teamspace_id: z.string().uuid().optional(),
    tags: z.array(z.string().max(64)).max(20).optional(),
  })
  .refine((body) => body.space !== "team" || !!body.teamspace_id, {
    message: "teamspace_id is required when space is 'team'",
    path: ["teamspace_id"],
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
    message: "Connect your Google Drive account before importing",
  },
  reconnect_needed: {
    code: "RECONNECT_NEEDED",
    status: 401,
    message: "Your Google Drive connection has expired — please reconnect",
  },
};

/**
 * POST /api/integrations/google-drive/import — import a Drive file as a new
 * SKB document page (a71-12 Phase 1 AC3).
 *
 * Downloads the file's bytes via the *authenticated* Drive API (unlike
 * a71-08's unauthenticated URL-snapshot path, which cannot see private Drive
 * files), stores them through the existing attachment path
 * (`storeAttachment`), and creates a `kind='DOCUMENT'` page with
 * `docSource='drive'` and the original Drive file id recorded in `metadata`
 * plus `sourceUrl` set to the file's Drive `webViewLink` for reference.
 *
 * Note (a71-08 cross-link): per-user privacy of the imported `Page` is not
 * guaranteed today — `Page` has no owner column, so a "private" import is
 * still tenant-wide visible under the current schema (a71-11's Round-1
 * finding). Not addressed here; this route does not claim per-user privacy.
 */
export const POST = withTenant(async (req: NextRequest, ctx: TenantContext) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("VALIDATION_ERROR", "Expected JSON body", undefined, 400);
  }

  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("VALIDATION_ERROR", "Invalid request body", undefined, 400);
  }
  const { file_id: fileId, space, teamspace_id, tags } = parsed.data;

  if (teamspace_id) {
    const teamspace = await prisma.teamspace.findFirst({
      where: { id: teamspace_id, tenantId: ctx.tenantId },
    });
    if (!teamspace) {
      return errorResponse("NOT_FOUND", "Teamspace not found", undefined, 404);
    }
  }

  const session = await getDriveAccessToken(ctx.tenantId, ctx.userId);
  if (!session.ok) {
    const mapped = REASON_STATUS[session.reason];
    return errorResponse(mapped.code, mapped.message, undefined, mapped.status);
  }

  let metadata;
  let bytes: Buffer;
  try {
    metadata = await getFileMetadata(session.accessToken, fileId);
    bytes = await downloadFile(session.accessToken, fileId);
  } catch (error) {
    if (error instanceof DriveRateLimitError) {
      return errorResponse("RATE_LIMITED", error.message, undefined, 429);
    }
    if (error instanceof DriveApiError) {
      return errorResponse("DRIVE_ERROR", error.message, undefined, 502);
    }
    return errorResponse("INTERNAL_ERROR", "Failed to fetch file from Google Drive", undefined, 500);
  }

  if (bytes.length > MAX_FILE_SIZE) {
    return errorResponse(
      "VALIDATION_ERROR",
      `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`,
      undefined,
      400
    );
  }

  const spaceType = space === "team" ? "TEAM" : "PRIVATE";

  const maxPosition = await prisma.page.aggregate({
    where: {
      tenantId: ctx.tenantId,
      parentId: null,
      teamspaceId: teamspace_id ?? null,
    },
    _max: { position: true },
  });
  const nextPosition = (maxPosition._max.position ?? -1) + 1;

  const page = await prisma.page.create({
    data: {
      tenantId: ctx.tenantId,
      title: metadata.name,
      kind: "DOCUMENT",
      spaceType,
      teamspaceId: teamspace_id ?? null,
      position: nextPosition,
      sourceUrl: metadata.webViewLink ?? null,
      docSource: "drive",
      properties: {
        document: { driveFileId: fileId },
      } as Prisma.InputJsonValue,
    },
  });

  const template = renderDocumentTemplate({
    title: metadata.name,
    source: "drive",
    sourceDetail: fileId,
    addedBy: ctx.userId,
    tags,
  });
  const tiptap = markdownToTiptap(template) as TipTapDocument;
  const plainText = extractPlainText(tiptap);

  await prisma.block.create({
    data: {
      tenantId: ctx.tenantId,
      pageId: page.id,
      type: "DOCUMENT",
      content: tiptap as unknown as Prisma.InputJsonValue,
      position: 0,
      plainText,
    },
  });

  const attachment = await storeAttachment(
    ctx.tenantId,
    page.id,
    ctx.userId,
    metadata.name,
    bytes,
    metadata.mimeType || "application/octet-stream"
  );

  await logDriveAction(ctx, "google_drive.import", page.id, {
    driveFileId: fileId,
    space,
    teamspaceId: teamspace_id ?? null,
    mimeType: metadata.mimeType,
    fileSize: bytes.length,
  });

  const pagesById = new Map<string, { title: string; parentId: string | null }>([
    [page.id, { title: page.title, parentId: page.parentId }],
  ]);

  return successResponse(
    {
      id: page.id,
      title: page.title,
      kind: "document",
      space,
      teamspace_id: teamspace_id ?? null,
      path: generatePagePath(page.id, pagesById),
      source: "drive",
      drive_file_id: fileId,
      source_url: page.sourceUrl,
      attachment_id: attachment.attachmentId,
      created_at: page.createdAt.toISOString(),
    },
    undefined,
    201
  );
});
