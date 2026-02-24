import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { updatePageSchema } from "@/lib/validation/pages";
import type { TenantContext } from "@/types/auth";
import { serializePage } from "@/lib/pages/serialize";
import { isDescendant } from "@/lib/pages/getPageTree";
import {
  updateWikilinksOnRename,
  markWikilinksAsDeleted,
} from "@/lib/wikilinks/renameUpdater";
import {
  pageToMarkdown,
  savePageBlocks,
  markdownToTiptap,
} from "@/lib/markdown/helpers";
import { z } from "zod";

const pageIdSchema = z.string().uuid("Page ID must be a valid UUID");

export const GET = withTenant(
  async (
    req: NextRequest,
    context: TenantContext,
    { params }
  ) => {
    try {
      const { id } = await params;
      const idParsed = pageIdSchema.safeParse(id);
      if (!idParsed.success) {
        return errorResponse("VALIDATION_ERROR", "Invalid page ID", undefined, 400);
      }

      const { searchParams } = new URL(req.url);
      const format = searchParams.get("format");
      const accept = req.headers.get("accept");

      // Check if markdown format is requested
      const wantsMarkdown =
        format === "markdown" || accept?.includes("text/markdown");

      const page = await prisma.page.findFirst({
        where: {
          id: idParsed.data,
          tenantId: context.tenantId,
        },
        ...(wantsMarkdown ? { include: { blocks: { orderBy: { position: "asc" } } } } : {}),
      });

      if (!page) {
        return errorResponse("NOT_FOUND", "Page not found", undefined, 404);
      }

      // Return markdown if requested
      if (wantsMarkdown && "blocks" in page) {
        const markdown = pageToMarkdown(
          page as typeof page & {
            blocks: Array<{ id: string; content: unknown; position: number }>;
          }
        );
        return new Response(markdown, {
          headers: { "Content-Type": "text/markdown; charset=utf-8" },
        });
      }

      return successResponse(serializePage(page));
    } catch (error) {
      console.error("GET /api/pages/[id] error:", error);
      return errorResponse("INTERNAL_ERROR", "Internal server error", undefined, 500);
    }
  }
);

export const PUT = withTenant(
  async (
    req: NextRequest,
    context: TenantContext,
    { params }
  ) => {
    try {
      const { id } = await params;
      const idParsed = pageIdSchema.safeParse(id);
      if (!idParsed.success) {
        return errorResponse("VALIDATION_ERROR", "Invalid page ID", undefined, 400);
      }

      // Check if this is a markdown PUT
      const { searchParams } = new URL(req.url);
      const format = searchParams.get("format");
      const contentType = req.headers.get("content-type") || "";

      if (
        format === "markdown" ||
        contentType.includes("text/markdown")
      ) {
        const markdownBody = await req.text();
        if (markdownBody.length > 10 * 1024 * 1024) {
          return errorResponse(
            "VALIDATION_ERROR",
            "Content too large (max 10MB)",
            undefined,
            400
          );
        }

        const existingPageMd = await prisma.page.findFirst({
          where: { id: idParsed.data, tenantId: context.tenantId },
        });
        if (!existingPageMd) {
          return errorResponse("NOT_FOUND", "Page not found", undefined, 404);
        }

        const { content: tiptapContent, metadata } =
          markdownToTiptap(markdownBody);

        await prisma.page.update({
          where: { id: idParsed.data },
          data: {
            title: metadata.title || existingPageMd.title,
            icon: metadata.icon || existingPageMd.icon,
          },
        });

        await savePageBlocks(
          idParsed.data,
          context.tenantId,
          tiptapContent
        );

        return successResponse({ message: "Page updated from markdown" });
      }

      const body = await req.json();
      const parsed = updatePageSchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Invalid request body",
          undefined,
          400
        );
      }

      // Verify the page exists and belongs to this tenant
      const existingPage = await prisma.page.findFirst({
        where: { id: idParsed.data, tenantId: context.tenantId },
        select: { id: true, title: true, spaceType: true },
      });
      if (!existingPage) {
        return errorResponse("NOT_FOUND", "Page not found", undefined, 404);
      }

      const { title, parentId, icon, coverUrl, spaceType } = parsed.data;

      // If parentId is being changed, validate the new parent
      if (parentId !== undefined && parentId !== null) {
        // Cannot set a page as its own parent
        if (parentId === idParsed.data) {
          return errorResponse(
            "VALIDATION_ERROR",
            "A page cannot be its own parent",
            undefined,
            400
          );
        }

        const parentPage = await prisma.page.findFirst({
          where: { id: parentId, tenantId: context.tenantId },
        });
        if (!parentPage) {
          return errorResponse("NOT_FOUND", "Parent page not found", undefined, 404);
        }

        // Check for circular reference: is the target parent a descendant of this page?
        const circular = await isDescendant(
          context.tenantId,
          idParsed.data,
          parentId
        );
        if (circular) {
          return errorResponse(
            "VALIDATION_ERROR",
            "Cannot move a page under one of its own descendants (circular reference)",
            undefined,
            400
          );
        }
      }

      // Detect title change for wikilink propagation
      const titleChanged =
        title !== undefined && title !== existingPage.title;

      // Build the update data object, only including provided fields
      const updateData: Record<string, unknown> = {};
      if (title !== undefined) updateData.title = title;
      if (icon !== undefined) updateData.icon = icon;
      if (coverUrl !== undefined) updateData.coverUrl = coverUrl;
      if (spaceType !== undefined) updateData.spaceType = spaceType;

      if (parentId !== undefined) {
        updateData.parentId = parentId;

        // Assign the next available position among new siblings
        const maxPosition = await prisma.page.aggregate({
          where: {
            tenantId: context.tenantId,
            parentId: parentId,
            id: { not: idParsed.data }, // exclude the page being moved
          },
          _max: { position: true },
        });
        updateData.position = (maxPosition._max.position ?? -1) + 1;
      }

      // Use a transaction for atomicity when title changes or spaceType changes
      const updatedPage = await prisma.$transaction(async (tx) => {
        const page = await tx.page.update({
          where: { id: idParsed.data },
          data: updateData,
        });

        // If title changed, update wikilinks in source pages
        if (titleChanged && title) {
          await updateWikilinksOnRename(
            idParsed.data,
            title,
            context.tenantId,
            tx
          );
        }

        // If spaceType changed, cascade to all descendants
        if (spaceType !== undefined && spaceType !== existingPage.spaceType) {
          const updateDescendants = async (parentId: string): Promise<void> => {
            const children = await tx.page.findMany({
              where: { parentId, tenantId: context.tenantId },
              select: { id: true },
            });
            for (const child of children) {
              await tx.page.update({
                where: { id: child.id },
                data: { spaceType },
              });
              await updateDescendants(child.id);
            }
          };
          await updateDescendants(idParsed.data);
        }

        return page;
      });

      return successResponse(serializePage(updatedPage));
    } catch (error) {
      console.error("PUT /api/pages/[id] error:", error);
      return errorResponse("INTERNAL_ERROR", "Internal server error", undefined, 500);
    }
  }
);

export const DELETE = withTenant(
  async (
    req: NextRequest,
    context: TenantContext,
    { params }
  ) => {
    try {
      const { id } = await params;
      const idParsed = pageIdSchema.safeParse(id);
      if (!idParsed.success) {
        return errorResponse("VALIDATION_ERROR", "Invalid page ID", undefined, 400);
      }

      // Verify the page exists and belongs to this tenant
      const existingPage = await prisma.page.findFirst({
        where: { id: idParsed.data, tenantId: context.tenantId },
      });
      if (!existingPage) {
        return errorResponse("NOT_FOUND", "Page not found", undefined, 404);
      }

      // Mark wikilinks as deleted and clean up page_links
      await markWikilinksAsDeleted(idParsed.data, context.tenantId);

      await prisma.page.delete({
        where: { id: idParsed.data },
      });

      return new Response(null, { status: 204 });
    } catch (error) {
      console.error("DELETE /api/pages/[id] error:", error);
      return errorResponse("INTERNAL_ERROR", "Internal server error", undefined, 500);
    }
  }
);
