import fs from "fs/promises";
import path from "path";
import { z } from "zod";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { errorResponse } from "@/lib/apiResponse";
import { MIRROR_ROOT } from "@/lib/sync/config";
import type { TenantContext } from "@/types/auth";

const idSchema = z.string().uuid();

/**
 * GET /api/attachments/:id — Serve the stored bytes of an attachment.
 *
 * Tenant-scoped: an attachment is only served to a session whose tenant owns
 * it, so a direct URL from another tenant's session 404s. Images are served
 * inline (so they render in <img> tags), everything else as a download.
 *
 * This is the browser-facing URL for every editor image/file node; the
 * mirror-relative path returned by the upload API is not a usable URL.
 */
export const GET = withTenant(
  async (
    _req: NextRequest,
    ctx: TenantContext,
    routeContext: { params: Promise<Record<string, string>> }
  ) => {
    const { id } = await routeContext.params;

    if (!idSchema.safeParse(id).success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Attachment ID must be a valid UUID",
        undefined,
        400
      );
    }

    const attachment = await prisma.fileAttachment.findFirst({
      where: { id, tenantId: ctx.tenantId, status: "READY" },
    });

    if (!attachment) {
      return errorResponse("NOT_FOUND", "Attachment not found", undefined, 404);
    }

    // Resolve the on-disk path and guard against path traversal: the stored
    // path must resolve to a location inside the mirror root.
    const root = path.resolve(MIRROR_ROOT);
    const absPath = path.resolve(root, attachment.storagePath);
    if (absPath !== root && !absPath.startsWith(root + path.sep)) {
      return errorResponse("NOT_FOUND", "Attachment not found", undefined, 404);
    }

    let bytes: Buffer;
    try {
      bytes = await fs.readFile(absPath);
    } catch {
      return errorResponse(
        "NOT_FOUND",
        "Attachment file is missing",
        undefined,
        404
      );
    }

    const mimeType = attachment.mimeType || "application/octet-stream";
    const disposition = mimeType.startsWith("image/") ? "inline" : "attachment";
    // fileName is sanitized at store time (no quotes/backslashes), so it is
    // safe to embed directly in the header.
    const safeName = attachment.fileName.replace(/["\\\r\n]/g, "");

    const headers = new Headers();
    headers.set("Content-Type", mimeType);
    headers.set("Content-Length", String(bytes.length));
    headers.set(
      "Content-Disposition",
      `${disposition}; filename="${safeName}"`
    );
    headers.set("Cache-Control", "private, max-age=3600");

    return new Response(new Uint8Array(bytes), { status: 200, headers });
  }
);
