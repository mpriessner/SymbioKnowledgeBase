import { NextRequest } from "next/server";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { prisma } from "@/lib/db";
import type { TenantContext } from "@/types/auth";
import { z } from "zod";

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url().nullable().optional(),
});

/**
 * GET /api/settings/profile — Get current user profile
 */
export const GET = withTenant(
  async (_req: NextRequest, ctx: TenantContext) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: ctx.userId },
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      });

      if (!user) {
        return errorResponse("NOT_FOUND", "User not found", undefined, 404);
      }

      return successResponse({
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
      });
    } catch (error) {
      console.error("GET /api/settings/profile error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);

/**
 * PATCH /api/settings/profile — Update user profile
 */
export const PATCH = withTenant(
  async (req: NextRequest, ctx: TenantContext) => {
    try {
      const body = await req.json();
      const parsed = updateProfileSchema.safeParse(body);

      if (!parsed.success) {
        const fieldErrors = parsed.error.flatten().fieldErrors;
        const details = Object.entries(fieldErrors).flatMap(([field, messages]) =>
          (messages ?? []).map((message) => ({ field, message }))
        );
        return errorResponse(
          "VALIDATION_ERROR",
          "Invalid request body",
          details,
          400
        );
      }

      const { name, avatarUrl } = parsed.data;

      // Build update data object with only provided fields
      const updateData: { name?: string; avatarUrl?: string | null } = {};
      if (name !== undefined) updateData.name = name;
      if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

      if (Object.keys(updateData).length === 0) {
        return errorResponse(
          "VALIDATION_ERROR",
          "No fields to update",
          undefined,
          400
        );
      }

      const updatedUser = await prisma.user.update({
        where: { id: ctx.userId },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      });

      return successResponse({
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        avatarUrl: updatedUser.avatarUrl,
      });
    } catch (error) {
      console.error("PATCH /api/settings/profile error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);
