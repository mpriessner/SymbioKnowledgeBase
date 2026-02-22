import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { z } from "zod";
import type { TenantContext } from "@/types/auth";

const addMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["ADMIN", "MEMBER", "GUEST"]).default("MEMBER"),
});

// GET /api/teamspaces/:id/members — List members
export const GET = withTenant(
  async (
    _req: NextRequest,
    ctx: TenantContext,
    routeContext: { params: Promise<Record<string, string>> }
  ) => {
    try {
      const { id: teamspaceId } = await routeContext.params;

      // Verify caller is a member
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

      const members = await prisma.teamspaceMember.findMany({
        where: { teamspaceId },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      });

      const data = members.map((m) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        userName: m.user.name,
        userEmail: m.user.email,
        createdAt: m.createdAt.toISOString(),
      }));

      return successResponse(data);
    } catch (error) {
      console.error("GET /api/teamspaces/:id/members error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);

// POST /api/teamspaces/:id/members — Add member (ADMIN+ only)
export const POST = withTenant(
  async (
    req: NextRequest,
    ctx: TenantContext,
    routeContext: { params: Promise<Record<string, string>> }
  ) => {
    try {
      const { id: teamspaceId } = await routeContext.params;

      // Verify caller has ADMIN+ role
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

      if (
        callerMembership.role !== "OWNER" &&
        callerMembership.role !== "ADMIN"
      ) {
        return errorResponse(
          "FORBIDDEN",
          "Admin or owner access required to add members",
          undefined,
          403
        );
      }

      const body = await req.json();
      const parsed = addMemberSchema.safeParse(body);

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

      const { userId, role } = parsed.data;

      // Verify user exists in same tenant
      const targetUser = await prisma.user.findFirst({
        where: { id: userId, tenantId: ctx.tenantId },
        select: { id: true, name: true, email: true },
      });

      if (!targetUser) {
        return errorResponse(
          "NOT_FOUND",
          "User not found in tenant",
          undefined,
          404
        );
      }

      // Check if already a member
      const existingMembership = await prisma.teamspaceMember.findUnique({
        where: {
          teamspaceId_userId: { teamspaceId, userId },
        },
      });

      if (existingMembership) {
        return errorResponse(
          "CONFLICT",
          "User is already a member of this teamspace",
          undefined,
          409
        );
      }

      const member = await prisma.teamspaceMember.create({
        data: { teamspaceId, userId, role },
      });

      return successResponse(
        {
          id: member.id,
          user_id: member.userId,
          user_name: targetUser.name || targetUser.email,
          role: member.role,
          created_at: member.createdAt.toISOString(),
        },
        undefined,
        201
      );
    } catch (error) {
      console.error("POST /api/teamspaces/:id/members error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);
