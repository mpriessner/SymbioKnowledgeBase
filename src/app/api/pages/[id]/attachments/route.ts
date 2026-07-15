import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import {
  storeAttachment,
  listAttachments,
  adjustStorageUsed,
  wouldExceedQuota,
} from "@/lib/sync/attachments";
import type { TenantContext } from "@/types/auth";
import { appendDocumentAttachment } from "@/lib/documents/appendAttachment";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * GET /api/pages/:id/attachments — List attachments for a page.
 */
export const GET = withTenant(
  async (
    _req: NextRequest,
    ctx: TenantContext,
    routeContext: { params: Promise<Record<string, string>> }
  ) => {
    const { id: pageId } = await routeContext.params;

    const page = await prisma.page.findFirst({
      where: { id: pageId, tenantId: ctx.tenantId },
    });

    if (!page) {
      return errorResponse("NOT_FOUND", "Page not found", undefined, 404);
    }

    const attachments = await listAttachments(ctx.tenantId, pageId);
    return successResponse(attachments);
  }
);

/**
 * POST /api/pages/:id/attachments — Upload an attachment to a page.
 *
 * Accepts multipart/form-data with a "file" field.
 * Returns the relative path for embedding in markdown.
 */
export const POST = withTenant(
  async (
    req: NextRequest,
    ctx: TenantContext,
    routeContext: { params: Promise<Record<string, string>> }
  ) => {
    const { id: pageId } = await routeContext.params;

    const page = await prisma.page.findFirst({
      where: { id: pageId, tenantId: ctx.tenantId },
    });

    if (!page) {
      return errorResponse("NOT_FOUND", "Page not found", undefined, 404);
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return errorResponse(
        "VALIDATION_ERROR",
        "Expected multipart/form-data",
        undefined,
        400
      );
    }

    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Missing 'file' field",
        undefined,
        400
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return errorResponse(
        "VALIDATION_ERROR",
        `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`,
        undefined,
        400
      );
    }

    // Reject if storing this file would exceed the tenant's storage quota.
    // BigInt arithmetic keeps this exact for multi-GB quotas.
    const tenant = await prisma.tenant.findUnique({
      where: { id: ctx.tenantId },
      select: { storageQuota: true, storageUsed: true },
    });
    if (
      tenant &&
      wouldExceedQuota(
        tenant.storageUsed,
        tenant.storageQuota,
        BigInt(file.size)
      )
    ) {
      return errorResponse(
        "QUOTA_EXCEEDED",
        "Storage quota exceeded",
        undefined,
        413
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "application/octet-stream";

    try {
      const result = await storeAttachment(
        ctx.tenantId,
        pageId,
        ctx.userId,
        file.name,
        buffer,
        mimeType
      );

      // Account for the newly stored bytes through the single shared owner.
      await adjustStorageUsed(ctx.tenantId, BigInt(buffer.length));

      if (page.kind === "DOCUMENT") {
        await appendDocumentAttachment(ctx.tenantId, pageId, {
          attachmentId: result.attachmentId,
          fileName: file.name,
          fileSize: file.size,
          mimeType,
        });
      }

      return successResponse(
        {
          attachmentId: result.attachmentId,
          relativePath: result.relativePath,
          // Browser-facing serving URL — every editor node references this,
          // never the mirror-relative path.
          url: `/api/attachments/${result.attachmentId}`,
          fileName: file.name,
          fileSize: file.size,
          mimeType,
          // Kept for backward compatibility; the UI keys off mimeType, not
          // this field (it renders image syntax for every file type).
          markdown: `![${file.name}](${result.relativePath})`,
        },
        undefined,
        201
      );
    } catch (error) {
      console.error("Attachment upload error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Failed to store attachment",
        undefined,
        500
      );
    }
  }
);
