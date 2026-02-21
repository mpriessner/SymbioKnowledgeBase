import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withAdmin } from "@/lib/auth/withAdmin";
import { updateUserSchema } from "@/lib/validation/users";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import type { TenantContext } from "@/types/auth";
import { z } from "zod";

const userIdSchema = z.string().uuid("User ID must be a valid UUID");

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  tenantId: true,
  createdAt: true,
  deactivatedAt: true,
} as const;

function serializeUser(user: {
  id: string;
  name: string | null;
  email: string;
  role: string;
  tenantId: string;
  createdAt: Date;
  deactivatedAt: Date | null;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
    createdAt: user.createdAt.toISOString(),
    isDeactivated: user.deactivatedAt !== null,
    deactivatedAt: user.deactivatedAt?.toISOString() ?? null,
  };
}

// GET /api/users/:id — Get a single user (admin only)
export const GET = withAdmin(
  async (_req: NextRequest, _ctx: TenantContext, params: Record<string, string>) => {
    const idParsed = userIdSchema.safeParse(params.id);
    if (!idParsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid user ID", undefined, 400);
    }

    const user = await prisma.user.findUnique({
      where: { id: idParsed.data },
      select: userSelect,
    });

    if (!user) {
      return errorResponse("NOT_FOUND", "User not found", undefined, 404);
    }

    return successResponse(serializeUser(user));
  }
);

// PUT /api/users/:id — Update user name and/or role (admin only)
export const PUT = withAdmin(
  async (req: NextRequest, _ctx: TenantContext, params: Record<string, string>) => {
    const idParsed = userIdSchema.safeParse(params.id);
    if (!idParsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid user ID", undefined, 400);
    }

    const body = await req.json();
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid user data",
        parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
        400
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: idParsed.data },
    });

    if (!existingUser) {
      return errorResponse("NOT_FOUND", "User not found", undefined, 404);
    }

    const updateData: Record<string, string> = {};
    if (parsed.data.name !== undefined) {
      updateData.name = parsed.data.name;
    }
    if (parsed.data.role !== undefined) {
      updateData.role = parsed.data.role;
    }

    if (Object.keys(updateData).length === 0) {
      return errorResponse(
        "VALIDATION_ERROR",
        "No fields to update. Provide at least one of: name, role.",
        undefined,
        400
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id: idParsed.data },
      data: updateData,
      select: userSelect,
    });

    return successResponse(serializeUser(updatedUser));
  }
);

// DELETE /api/users/:id — Deactivate a user (admin only, soft delete)
export const DELETE = withAdmin(
  async (_req: NextRequest, ctx: TenantContext, params: Record<string, string>) => {
    const idParsed = userIdSchema.safeParse(params.id);
    if (!idParsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid user ID", undefined, 400);
    }

    // Prevent admin from deactivating themselves
    if (idParsed.data === ctx.userId) {
      return errorResponse(
        "FORBIDDEN",
        "You cannot deactivate your own account",
        undefined,
        403
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: idParsed.data },
    });

    if (!existingUser) {
      return errorResponse("NOT_FOUND", "User not found", undefined, 404);
    }

    if (existingUser.deactivatedAt) {
      return errorResponse(
        "CONFLICT",
        "User is already deactivated",
        undefined,
        409
      );
    }

    const deactivatedUser = await prisma.user.update({
      where: { id: idParsed.data },
      data: { deactivatedAt: new Date() },
      select: userSelect,
    });

    return successResponse(serializeUser(deactivatedUser));
  }
);
