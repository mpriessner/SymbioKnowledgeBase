import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { saveDocumentSchema } from "@/lib/validation/blocks";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { updatePageLinks } from "@/lib/wikilinks/indexer";
import { updateSearchIndex } from "@/lib/search/indexer";
import {
  triggerPageUpdateNotifications,
  triggerPageMentionNotifications,
} from "@/lib/notifications/triggers";
import type { TipTapDocument } from "@/lib/wikilinks/types";
import { syncPageToFilesystem } from "@/lib/sync/SyncService";
import { getSummaryService } from "@/lib/summary/SummaryService";
import type { TenantContext } from "@/types/auth";
import type { Prisma } from "@/generated/prisma/client";

// GET /api/pages/:id/blocks — Load all blocks for a page
export const GET = withTenant(
  async (
    req: NextRequest,
    ctx: TenantContext,
    routeContext: { params: Promise<Record<string, string>> }
  ) => {
    const { id: pageId } = await routeContext.params;

    try {
      // Verify page exists and belongs to tenant
      const page = await prisma.page.findFirst({
        where: {
          id: pageId,
          tenantId: ctx.tenantId,
        },
      });

      if (!page) {
        return errorResponse("NOT_FOUND", "Page not found", undefined, 404);
      }

      // Fetch all blocks for the page, ordered by position
      const blocks = await prisma.block.findMany({
        where: {
          pageId,
          tenantId: ctx.tenantId,
          deletedAt: null,
        },
        orderBy: { position: "asc" },
      });

      return successResponse(blocks, {
        count: blocks.length,
        pageId,
      });
    } catch (error) {
      console.error("Failed to fetch blocks:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Failed to fetch blocks",
        undefined,
        500
      );
    }
  }
);

// PUT /api/pages/:id/blocks — Save full TipTap document (upsert DOCUMENT block)
export const PUT = withTenant(
  async (
    req: NextRequest,
    ctx: TenantContext,
    routeContext: { params: Promise<Record<string, string>> }
  ) => {
    const { id: pageId } = await routeContext.params;

    try {
      // Parse and validate request body
      const body = await req.json();
      const parsed = saveDocumentSchema.safeParse(body);

      if (!parsed.success) {
        const fieldErrors = parsed.error.flatten().fieldErrors;
        const details = Object.entries(fieldErrors).flatMap(([field, messages]) =>
          (messages ?? []).map((message) => ({ field, message }))
        );
        return errorResponse("VALIDATION_ERROR", "Invalid input", details, 400);
      }

      // Verify page exists and belongs to tenant
      const page = await prisma.page.findFirst({
        where: {
          id: pageId,
          tenantId: ctx.tenantId,
        },
      });

      if (!page) {
        return errorResponse("NOT_FOUND", "Page not found", undefined, 404);
      }

      const content = parsed.data.content as unknown as Prisma.InputJsonValue;

      // Find existing DOCUMENT block for this page
      const existing = await prisma.block.findFirst({
        where: {
          pageId,
          tenantId: ctx.tenantId,
          type: "DOCUMENT",
          deletedAt: null,
        },
        select: { id: true, content: true, plainText: true },
      });

      // Capture old plainText for summary change detection
      const oldPlainText = existing?.plainText ?? "";

      let block;
      if (existing) {
        // Update existing DOCUMENT block
        block = await prisma.block.update({
          where: { id: existing.id },
          data: { content },
        });
      } else {
        // Create new DOCUMENT block
        block = await prisma.block.create({
          data: {
            tenantId: ctx.tenantId,
            pageId,
            type: "DOCUMENT",
            content,
            position: 0,
          },
        });
      }

      // Update the wikilink page_links index for this page
      await updatePageLinks(
        pageId,
        ctx.tenantId,
        [block.content as unknown as TipTapDocument]
      );

      // Update full-text search index
      await updateSearchIndex(
        block.id,
        block.content as unknown as TipTapDocument
      );

      // Trigger notifications (fire-and-forget, don't await)
      triggerPageUpdateNotifications({
        pageId,
        tenantId: ctx.tenantId,
        updatedBy: ctx.userId,
      });

      triggerPageMentionNotifications({
        pageId,
        tenantId: ctx.tenantId,
        content: block.content as unknown as TipTapDocument,
        authorId: ctx.userId,
      });

      // Sync page to filesystem mirror (fire-and-forget)
      syncPageToFilesystem(ctx.tenantId, pageId).catch((err) =>
        console.error("Sync after block save failed:", err)
      );

      // Trigger summary regeneration if content changed substantially (fire-and-forget)
      const newPlainText = block.plainText;
      getSummaryService()
        .onPageSaved(pageId, ctx.tenantId, oldPlainText, newPlainText)
        .catch((err) =>
          console.error("Summary generation trigger failed:", err)
        );

      return successResponse(block);
    } catch (error) {
      console.error("Failed to save document:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Failed to save document",
        undefined,
        500
      );
    }
  }
);
