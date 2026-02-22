import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { z } from "zod";
import type { TenantContext } from "@/types/auth";

const updateTeamspaceSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  icon: z.string().nullable().optional(),
});

// PATCH /api/teamspaces/:id — Update teamspace (ADMIN+ only)
export const PATCH = withTenant(
  async (
    req: NextRequest,
    ctx: TenantContext,
    routeContext: { params: Promise<Record<string, string>> }
  ) => {
    try {
      const { id } = await routeContext.params;

      // Verify membership and role
      const membership = await prisma.teamspaceMember.findUnique({
        where: {
          teamspaceId_userId: { teamspaceId: id, userId: ctx.userId },
        },
      });

      if (!membership) {
        return errorResponse(
          "NOT_FOUND",
          "Teamspace not found",
          undefined,
          404
        );
      }

      if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
        return errorResponse(
          "FORBIDDEN",
          "Admin or owner access required",
          undefined,
          403
        );
      }

      const body = await req.json();
      const parsed = updateTeamspaceSchema.safeParse(body);

      if (!parsed.success) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Invalid request body",
          parsed.error.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message,
          })),
          400
        );
      }

      // Check duplicate name if updating name
      if (parsed.data.name) {
        const existing = await prisma.teamspace.findFirst({
          where: {
            tenantId: ctx.tenantId,
            name: parsed.data.name,
            id: { not: id },
          },
        });

        if (existing) {
          return errorResponse(
            "CONFLICT",
            "A teamspace with that name already exists",
            undefined,
            409
          );
        }
      }

      const updated = await prisma.teamspace.update({
        where: { id },
        data: {
          ...(parsed.data.name !== undefined && { name: parsed.data.name }),
          ...(parsed.data.icon !== undefined && { icon: parsed.data.icon }),
        },
      });

      return successResponse({
        id: updated.id,
        name: updated.name,
        icon: updated.icon,
      });
    } catch (error) {
      console.error("PATCH /api/teamspaces/:id error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);

// DELETE /api/teamspaces/:id — Delete teamspace (OWNER only)
export const DELETE = withTenant(
  async (
    _req: NextRequest,
    ctx: TenantContext,
    routeContext: { params: Promise<Record<string, string>> }
  ) => {
    try {
      const { id } = await routeContext.params;

      const membership = await prisma.teamspaceMember.findUnique({
        where: {
          teamspaceId_userId: { teamspaceId: id, userId: ctx.userId },
        },
      });

      if (!membership) {
        return errorResponse(
          "NOT_FOUND",
          "Teamspace not found",
          undefined,
          404
        );
      }

      if (membership.role !== "OWNER") {
        return errorResponse(
          "FORBIDDEN",
          "Only the owner can delete a teamspace",
          undefined,
          403
        );
      }

      // Set all pages in this teamspace to private (teamspaceId = null)
      await prisma.$transaction(async (tx) => {
        await tx.page.updateMany({
          where: { teamspaceId: id },
          data: { teamspaceId: null },
        });

        await tx.teamspace.delete({ where: { id } });
      });

      return successResponse({ deleted: true });
    } catch (error) {
      console.error("DELETE /api/teamspaces/:id error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);
