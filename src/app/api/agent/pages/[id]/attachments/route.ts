import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withAgentAuth } from "@/lib/agent/auth";
import type { AgentContext } from "@/lib/agent/auth";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { storeAttachment } from "@/lib/sync/attachments";
import { logAgentAction } from "@/lib/agent/audit";
import { markdownToTiptap, tiptapToMarkdown } from "@/lib/agent/markdown";
import { extractPlainText } from "@/lib/search/indexer";
import type { TipTapDocument } from "@/lib/wikilinks/types";
import type { Prisma } from "@/generated/prisma/client";

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

      // Link the attachment into the page body — the required third step
      // (Round 2 finding 2). Append to the existing DOCUMENT block if one
      // exists, else create it.
      const existingBlock = await prisma.block.findFirst({
        where: { pageId, tenantId: ctx.tenantId, type: "DOCUMENT" },
      });

      const referenceMarkdown = `## Attachment\n![${file.name}](${url})`;

      if (existingBlock) {
        const existingMarkdown = tiptapToMarkdown(existingBlock.content);
        const newMarkdown = `${existingMarkdown}\n${referenceMarkdown}`;
        const newTiptap = markdownToTiptap(newMarkdown) as TipTapDocument;
        await prisma.block.update({
          where: { id: existingBlock.id },
          data: {
            content: newTiptap as unknown as Prisma.InputJsonValue,
            plainText: extractPlainText(newTiptap),
          },
        });
      } else {
        const newTiptap = markdownToTiptap(referenceMarkdown) as TipTapDocument;
        await prisma.block.create({
          data: {
            tenantId: ctx.tenantId,
            pageId,
            type: "DOCUMENT",
            content: newTiptap as unknown as Prisma.InputJsonValue,
            position: 0,
            plainText: extractPlainText(newTiptap),
          },
        });
      }

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
