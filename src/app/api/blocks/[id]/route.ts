import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { updateBlockSchema } from "@/lib/validation/blocks";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import type { TenantContext } from "@/types/auth";
import type { Prisma } from "@/generated/prisma/client";

// GET /api/blocks/:id — Read a single block
export const GET = withTenant(
  async (
    req: NextRequest,
    ctx: TenantContext,
    routeContext: { params: Promise<Record<string, string>> }
  ) => {
    const { id: blockId } = await routeContext.params;

    try {
      const block = await prisma.block.findFirst({
        where: {
          id: blockId,
          tenantId: ctx.tenantId,
          deletedAt: null,
        },
      });

      if (!block) {
        return errorResponse("NOT_FOUND", "Block not found", undefined, 404);
      }

      return successResponse(block);
    } catch (error) {
      console.error("Failed to fetch block:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Failed to fetch block",
        undefined,
        500
      );
    }
  }
);

// PUT /api/blocks/:id — Update a single block
export const PUT = withTenant(
  async (
    req: NextRequest,
    ctx: TenantContext,
    routeContext: { params: Promise<Record<string, string>> }
  ) => {
    const { id: blockId } = await routeContext.params;

    try {
      const body = await req.json();
      const parsed = updateBlockSchema.safeParse(body);

      if (!parsed.success) {
        const fieldErrors = parsed.error.flatten().fieldErrors;
        const details = Object.entries(fieldErrors).flatMap(([field, messages]) =>
          (messages ?? []).map((message) => ({ field, message }))
        );
        return errorResponse("VALIDATION_ERROR", "Invalid input", details, 400);
      }

      // Verify block exists and belongs to tenant
      const existing = await prisma.block.findFirst({
        where: {
          id: blockId,
          tenantId: ctx.tenantId,
          deletedAt: null,
        },
      });

      if (!existing) {
        return errorResponse("NOT_FOUND", "Block not found", undefined, 404);
      }

      const { content, ...rest } = parsed.data;
      const block = await prisma.block.update({
        where: { id: blockId },
        data: {
          ...rest,
          ...(content !== undefined
            ? { content: content as unknown as Prisma.InputJsonValue }
            : {}),
        },
      });

      return successResponse(block);
    } catch (error) {
      console.error("Failed to update block:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Failed to update block",
        undefined,
        500
      );
    }
  }
);

// DELETE /api/blocks/:id — Soft-delete a block
export const DELETE = withTenant(
  async (
    req: NextRequest,
    ctx: TenantContext,
    routeContext: { params: Promise<Record<string, string>> }
  ) => {
    const { id: blockId } = await routeContext.params;

    try {
      // Verify block exists and belongs to tenant
      const existing = await prisma.block.findFirst({
        where: {
          id: blockId,
          tenantId: ctx.tenantId,
          deletedAt: null,
        },
      });

      if (!existing) {
        return errorResponse("NOT_FOUND", "Block not found", undefined, 404);
      }

      // Soft-delete
      await prisma.block.update({
        where: { id: blockId },
        data: { deletedAt: new Date() },
      });

      return successResponse({ id: blockId, deleted: true });
    } catch (error) {
      console.error("Failed to delete block:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Failed to delete block",
        undefined,
        500
      );
    }
  }
);
