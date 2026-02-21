import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { createBlockSchema } from "@/lib/validation/blocks";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import type { TenantContext } from "@/types/auth";
import type { Prisma } from "@/generated/prisma/client";

// POST /api/blocks — Create a new block
export const POST = withTenant(
  async (req: NextRequest, ctx: TenantContext) => {
    try {
      const body = await req.json();
      const parsed = createBlockSchema.safeParse(body);

      if (!parsed.success) {
        const fieldErrors = parsed.error.flatten().fieldErrors;
        const details = Object.entries(fieldErrors).flatMap(([field, messages]) =>
          (messages ?? []).map((message) => ({ field, message }))
        );
        return errorResponse("VALIDATION_ERROR", "Invalid input", details, 400);
      }

      const { pageId, type, content, position } = parsed.data;

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

      // Shift positions of existing blocks at or after the insertion point
      await prisma.block.updateMany({
        where: {
          pageId,
          tenantId: ctx.tenantId,
          position: { gte: position },
          deletedAt: null,
        },
        data: {
          position: { increment: 1 },
        },
      });

      // Create the new block
      const block = await prisma.block.create({
        data: {
          tenantId: ctx.tenantId,
          pageId,
          type,
          content: content as unknown as Prisma.InputJsonValue,
          position,
        },
      });

      return successResponse(block, undefined, 201);
    } catch (error) {
      console.error("Failed to create block:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Failed to create block",
        undefined,
        500
      );
    }
  }
);
