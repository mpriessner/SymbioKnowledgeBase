import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { updatePageSchema } from "@/lib/validation/pages";
import type { TenantContext } from "@/types/auth";
import { serializePage } from "@/lib/pages/serialize";
import { isDescendant } from "@/lib/pages/getPageTree";
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

      const page = await prisma.page.findFirst({
        where: {
          id: idParsed.data,
          tenantId: context.tenantId,
        },
      });

      if (!page) {
        return errorResponse("NOT_FOUND", "Page not found", undefined, 404);
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
      });
      if (!existingPage) {
        return errorResponse("NOT_FOUND", "Page not found", undefined, 404);
      }

      const { title, parentId, icon, coverUrl } = parsed.data;

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

      // Build the update data object, only including provided fields
      const updateData: Record<string, unknown> = {};
      if (title !== undefined) updateData.title = title;
      if (icon !== undefined) updateData.icon = icon;
      if (coverUrl !== undefined) updateData.coverUrl = coverUrl;

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

      const updatedPage = await prisma.page.update({
        where: { id: idParsed.data },
        data: updateData,
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
