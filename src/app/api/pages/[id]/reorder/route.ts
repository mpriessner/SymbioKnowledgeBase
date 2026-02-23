import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { isDescendant } from "@/lib/pages/getPageTree";
import type { TenantContext } from "@/types/auth";
import { z } from "zod";

const reorderSchema = z.object({
  parentId: z
    .string()
    .uuid("parentId must be a valid UUID")
    .nullable(),
  position: z
    .number()
    .int("Position must be an integer")
    .min(0, "Position must be non-negative"),
});

export const PUT = withTenant(
  async (req: NextRequest, context: TenantContext, routeContext) => {
    try {
      const { id } = await routeContext.params;

      const body = await req.json();
      const parsed = reorderSchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Invalid request body",
          undefined,
          400
        );
      }

      const { parentId, position } = parsed.data;

      // Verify the page exists and belongs to this tenant
      const page = await prisma.page.findFirst({
        where: { id, tenantId: context.tenantId },
      });
      if (!page) {
        return errorResponse("NOT_FOUND", "Page not found", undefined, 404);
      }

      // If moving to a new parent, validate it
      if (parentId !== null) {
        // Cannot move a page under itself
        if (parentId === id) {
          return errorResponse(
            "INVALID_OPERATION",
            "A page cannot be its own parent",
            undefined,
            400
          );
        }

        // Verify parent exists
        const parentPage = await prisma.page.findFirst({
          where: { id: parentId, tenantId: context.tenantId },
        });
        if (!parentPage) {
          return errorResponse(
            "NOT_FOUND",
            "Parent page not found",
            undefined,
            404
          );
        }

        // Check for circular reference
        const circular = await isDescendant(context.tenantId, id, parentId);
        if (circular) {
          return errorResponse(
            "CIRCULAR_REFERENCE",
            "Cannot move a page under one of its own descendants",
            undefined,
            400
          );
        }
      }

      // Perform the reorder in a transaction
      const updatedPage = await prisma.$transaction(async (tx) => {
        // Get all siblings at the target parent (excluding the moving page)
        const siblings = await tx.page.findMany({
          where: {
            tenantId: context.tenantId,
            parentId,
            id: { not: id },
          },
          orderBy: { position: "asc" },
          select: { id: true },
        });

        // Clamp position to valid range
        const clampedPosition = Math.min(position, siblings.length);

        // Build the new ordering: insert the page at the requested position
        const newOrder = [...siblings.map((s) => s.id)];
        newOrder.splice(clampedPosition, 0, id);

        // Update all positions in the new order
        const updatePromises = newOrder.map((siblingId, index) =>
          tx.page.update({
            where: { id: siblingId },
            data: {
              position: index,
              // Only update parentId for the moved page
              ...(siblingId === id ? { parentId } : {}),
            },
          })
        );

        await Promise.all(updatePromises);

        // Return the updated page
        return tx.page.findUniqueOrThrow({ where: { id } });
      });

      return successResponse({
        id: updatedPage.id,
        tenantId: updatedPage.tenantId,
        parentId: updatedPage.parentId,
        title: updatedPage.title,
        icon: updatedPage.icon,
        coverUrl: updatedPage.coverUrl,
        position: updatedPage.position,
        createdAt: updatedPage.createdAt.toISOString(),
        updatedAt: updatedPage.updatedAt.toISOString(),
      });
    } catch (error) {
      console.error("PUT /api/pages/[id]/reorder error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);
