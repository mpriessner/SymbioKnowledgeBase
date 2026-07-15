import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withAgentAuth } from "@/lib/agent/auth";
import type { AgentContext } from "@/lib/agent/auth";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { storeAttachment } from "@/lib/sync/attachments";
import { logAgentAction } from "@/lib/agent/audit";
import { appendDocumentAttachment } from "@/lib/documents/appendAttachment";

// Mirrors the 50MB/file cap enforced by the session-auth
// src/app/api/pages/[id]/attachments/route.ts — same limit, reused not
// reinvented (AC6).
const MAX_FILE_SIZE = 50 * 1024 * 1024;

type RouteContext = { params: Promise<Record<string, string>> };

/**
 * POST /api/agent/pages/:id/attachments — Upload an attachment to an
 * agent-created document page (a71-08 AC4).
 *
 * This is a dedicated route rather than an extension of the existing
 * session-auth `src/app/api/pages/[id]/attachments/route.ts`, so a bug here
 * cannot grant agent keys upload rights on arbitrary pages: it is
 * `withAgentAuth`-gated (write scope + rate limiting) and additionally
 * requires `page.kind === 'DOCUMENT'` (regression-risk mitigation called out
 * in the story).
 *
 * Beyond storing the file (reusing `storeAttachment`), this route performs
 * the "link the attachment into the page body" step the UI does but the
 * plain attachments route never did (Round 2 finding 2) — it appends an
 * `## Attachment` section referencing the attachment's `url`
 * (`/api/attachments/{id}`, browser-facing), never the mirror-relative
 * `relativePath` the editor cannot resolve (Round 2 finding 6).
 */
export const POST = withAgentAuth(
  async (req: NextRequest, ctx: AgentContext, routeContext: RouteContext) => {
    try {
      const { id: pageId } = await routeContext.params;

      const page = await prisma.page.findFirst({
        where: { id: pageId, tenantId: ctx.tenantId },
      });
      if (!page) {
        return errorResponse("NOT_FOUND", "Page not found", undefined, 404);
      }
      if (page.kind !== "DOCUMENT") {
        return errorResponse(
          "VALIDATION_ERROR",
          "Agent-key attachment uploads are only supported for document pages",
          undefined,
          400
        );
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

      let stored: { attachmentId: string; relativePath: string };
      try {
        stored = await storeAttachment(
          ctx.tenantId,
          pageId,
          ctx.userId,
          file.name,
          buffer,
          file.type || "application/octet-stream"
        );
      } catch (error) {
        console.error("Agent attachment upload error:", error);
        return errorResponse(
          "INTERNAL_ERROR",
          "Failed to store attachment",
          undefined,
          500
        );
      }

      const url = `/api/attachments/${stored.attachmentId}`;

      await appendDocumentAttachment(ctx.tenantId, pageId, {
        attachmentId: stored.attachmentId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
      });

      await logAgentAction(ctx, "document.attachment.upload", "page", pageId, {
        attachmentId: stored.attachmentId,
        fileName: file.name,
        fileSize: file.size,
      });

      return successResponse(
        {
          attachmentId: stored.attachmentId,
          url,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || "application/octet-stream",
        },
        undefined,
        201
      );
    } catch (error) {
      console.error("POST /api/agent/pages/:id/attachments error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);
