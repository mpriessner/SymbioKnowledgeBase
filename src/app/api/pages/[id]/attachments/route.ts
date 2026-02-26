import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { storeAttachment, listAttachments } from "@/lib/sync/attachments";
import type { TenantContext } from "@/types/auth";

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

    const buffer = Buffer.from(await file.arrayBuffer());

    try {
      const result = await storeAttachment(
        ctx.tenantId,
        pageId,
        ctx.userId,
        file.name,
        buffer,
        file.type || "application/octet-stream"
      );

      return successResponse(
        {
          attachmentId: result.attachmentId,
          relativePath: result.relativePath,
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
