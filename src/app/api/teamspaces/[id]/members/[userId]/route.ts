import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { z } from "zod";
import type { TenantContext } from "@/types/auth";

const updateRoleSchema = z.object({
  role: z.enum(["OWNER", "ADMIN", "MEMBER", "GUEST"]),
});

// PATCH /api/teamspaces/:id/members/:userId — Update member role (OWNER only)
export const PATCH = withTenant(
  async (
    req: NextRequest,
    ctx: TenantContext,
    routeContext: { params: Promise<Record<string, string>> }
  ) => {
    try {
      const params = await routeContext.params;
      const teamspaceId = params.id;
      const targetUserId = params.userId;

      // Verify caller is OWNER
      const callerMembership = await prisma.teamspaceMember.findUnique({
        where: {
          teamspaceId_userId: {
            teamspaceId,
            userId: ctx.userId,
          },
        },
      });

      if (!callerMembership || callerMembership.role !== "OWNER") {
        return errorResponse(
          "FORBIDDEN",
          "Only the owner can change member roles",
          undefined,
          403
        );
      }

      const body = await req.json();
      const parsed = updateRoleSchema.safeParse(body);

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

      const { role } = parsed.data;

      // Find target member
      const targetMembership = await prisma.teamspaceMember.findUnique({
        where: {
          teamspaceId_userId: {
            teamspaceId,
            userId: targetUserId,
          },
        },
      });

      if (!targetMembership) {
        return errorResponse(
          "NOT_FOUND",
          "Member not found",
          undefined,
          404
        );
      }

      // If transferring ownership, demote current owner to ADMIN
      if (role === "OWNER") {
        await prisma.$transaction(async (tx) => {
          await tx.teamspaceMember.update({
            where: { id: callerMembership.id },
            data: { role: "ADMIN" },
          });

          await tx.teamspaceMember.update({
            where: { id: targetMembership.id },
            data: { role: "OWNER" },
          });
        });
      } else {
        await prisma.teamspaceMember.update({
          where: { id: targetMembership.id },
          data: { role },
        });
      }

      return successResponse({
        user_id: targetUserId,
        role,
      });
    } catch (error) {
      console.error(
        "PATCH /api/teamspaces/:id/members/:userId error:",
        error
      );
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);

// DELETE /api/teamspaces/:id/members/:userId — Remove member
export const DELETE = withTenant(
  async (
    _req: NextRequest,
    ctx: TenantContext,
    routeContext: { params: Promise<Record<string, string>> }
  ) => {
    try {
      const params = await routeContext.params;
      const teamspaceId = params.id;
      const targetUserId = params.userId;

      // Verify caller has permission
      const callerMembership = await prisma.teamspaceMember.findUnique({
        where: {
          teamspaceId_userId: {
            teamspaceId,
            userId: ctx.userId,
          },
        },
      });

      if (!callerMembership) {
        return errorResponse(
          "NOT_FOUND",
          "Teamspace not found",
          undefined,
          404
        );
      }

      // Users can remove themselves; ADMIN/OWNER can remove others
      const isSelf = targetUserId === ctx.userId;
      const isAdmin =
        callerMembership.role === "OWNER" ||
        callerMembership.role === "ADMIN";

      if (!isSelf && !isAdmin) {
        return errorResponse(
          "FORBIDDEN",
          "Admin or owner access required to remove members",
          undefined,
          403
        );
      }

      // Owner cannot be removed (must transfer ownership first)
      const targetMembership = await prisma.teamspaceMember.findUnique({
        where: {
          teamspaceId_userId: {
            teamspaceId,
            userId: targetUserId,
          },
        },
      });

      if (!targetMembership) {
        return errorResponse(
          "NOT_FOUND",
          "Member not found",
          undefined,
          404
        );
      }

      if (targetMembership.role === "OWNER") {
        return errorResponse(
          "FORBIDDEN",
          "Cannot remove the owner. Transfer ownership first.",
          undefined,
          403
        );
      }

      await prisma.teamspaceMember.delete({
        where: { id: targetMembership.id },
      });

      return successResponse({ removed: true });
    } catch (error) {
      console.error(
        "DELETE /api/teamspaces/:id/members/:userId error:",
        error
      );
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);
