import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { z } from "zod";
import type { TenantContext } from "@/types/auth";

const updateVisibilitySchema = z.object({
  teamspaceId: z.string().uuid().nullable(),
});

const inviteSchema = z.object({
  email: z.string().email(),
  permission: z.enum(["FULL_ACCESS", "CAN_EDIT", "CAN_COMMENT", "CAN_VIEW"]).default("CAN_VIEW"),
});

/** GET /api/pages/[id]/share — List all shares for a page (includes owner) */
export const GET = withTenant(
  async (
    req: NextRequest,
    ctx: TenantContext,
    routeContext: { params: Promise<Record<string, string>> }
  ) => {
    const { id: pageId } = await routeContext.params;

    const page = await prisma.page.findFirst({
      where: { id: pageId, tenantId: ctx.tenantId },
      select: { id: true, tenantId: true },
    });
    if (!page) {
      return errorResponse("NOT_FOUND", "Page not found", undefined, 404);
    }

    // Get the page creator (first user in tenant who created this page — use the createdBy concept via the page owner)
    // For now, we treat the page's tenant primary user as "owner" context
    // Fetch all shares
    const shares = await prisma.pageShare.findMany({
      where: { pageId, tenantId: ctx.tenantId },
      orderBy: { createdAt: "asc" },
    });

    // Fetch user details for all shared users
    const userIds = shares.map((s) => s.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds }, tenantId: ctx.tenantId },
      select: { id: true, name: true, email: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    // Get current user info for the owner entry
    const currentUser = await prisma.user.findFirst({
      where: { id: ctx.userId, tenantId: ctx.tenantId },
      select: { id: true, name: true, email: true },
    });

    // Build result: owner first, then shares
    const members = [
      {
        id: "owner",
        user_id: ctx.userId,
        user_name: currentUser?.name || currentUser?.email || "You",
        user_email: currentUser?.email || "",
        permission: "FULL_ACCESS" as const,
        is_owner: true,
        created_at: null,
      },
      ...shares
        .filter((s) => s.userId !== ctx.userId)
        .map((s) => {
          const user = userMap.get(s.userId);
          return {
            id: s.id,
            user_id: s.userId,
            user_name: user?.name || user?.email || "Unknown",
            user_email: user?.email || "",
            permission: s.permission,
            is_owner: false,
            created_at: s.createdAt.toISOString(),
          };
        }),
    ];

    return successResponse(members);
  }
);

/** POST /api/pages/[id]/share — Invite a user by email */
export const POST = withTenant(
  async (
    req: NextRequest,
    ctx: TenantContext,
    routeContext: { params: Promise<Record<string, string>> }
  ) => {
    const { id: pageId } = await routeContext.params;
    const body = await req.json();
    const parsed = inviteSchema.safeParse(body);

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

    // Verify page exists in tenant
    const page = await prisma.page.findFirst({
      where: { id: pageId, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!page) {
      return errorResponse("NOT_FOUND", "Page not found", undefined, 404);
    }

    // Find user by email within the same tenant
    const targetUser = await prisma.user.findFirst({
      where: { email: parsed.data.email, tenantId: ctx.tenantId },
      select: { id: true, name: true, email: true },
    });
    if (!targetUser) {
      return errorResponse(
        "NOT_FOUND",
        "User not found in this workspace",
        undefined,
        404
      );
    }

    // Check if share already exists
    const existing = await prisma.pageShare.findUnique({
      where: {
        pageId_userId: { pageId, userId: targetUser.id },
      },
    });
    if (existing) {
      return errorResponse(
        "CONFLICT",
        "This user already has access to this page",
        undefined,
        409
      );
    }

    const share = await prisma.pageShare.create({
      data: {
        pageId,
        userId: targetUser.id,
        tenantId: ctx.tenantId,
        permission: parsed.data.permission,
        sharedBy: ctx.userId,
      },
    });

    return successResponse(
      {
        id: share.id,
        user_id: targetUser.id,
        user_name: targetUser.name || targetUser.email,
        user_email: targetUser.email,
        permission: share.permission,
        is_owner: false,
        created_at: share.createdAt.toISOString(),
      },
      undefined,
      201
    );
  }
);

// PATCH /api/pages/:id/share — Update page visibility (move to/from teamspace)
export const PATCH = withTenant(
  async (
    req: NextRequest,
    ctx: TenantContext,
    routeContext: { params: Promise<Record<string, string>> }
  ) => {
    try {
      const { id: pageId } = await routeContext.params;

      const body = await req.json();
      const parsed = updateVisibilitySchema.safeParse(body);

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

      const page = await prisma.page.findFirst({
        where: { id: pageId, tenantId: ctx.tenantId },
      });

      if (!page) {
        return errorResponse("NOT_FOUND", "Page not found", undefined, 404);
      }

      // Permission check: if page is in a teamspace, user must be ADMIN+
      if (page.teamspaceId) {
        const member = await prisma.teamspaceMember.findUnique({
          where: {
            teamspaceId_userId: {
              teamspaceId: page.teamspaceId,
              userId: ctx.userId,
            },
          },
        });

        if (!member || (member.role !== "ADMIN" && member.role !== "OWNER")) {
          return errorResponse(
            "FORBIDDEN",
            "Admin or owner access required to change page visibility",
            undefined,
            403
          );
        }
      }

      // If moving to a teamspace, verify user is a member of that teamspace
      if (parsed.data.teamspaceId) {
        const targetMember = await prisma.teamspaceMember.findUnique({
          where: {
            teamspaceId_userId: {
              teamspaceId: parsed.data.teamspaceId,
              userId: ctx.userId,
            },
          },
        });

        if (!targetMember) {
          return errorResponse(
            "FORBIDDEN",
            "You are not a member of the target teamspace",
            undefined,
            403
          );
        }
      }

      const updatedPage = await prisma.page.update({
        where: { id: pageId },
        data: { teamspaceId: parsed.data.teamspaceId },
      });

      return successResponse({
        id: updatedPage.id,
        teamspaceId: updatedPage.teamspaceId,
      });
    } catch (error) {
      console.error("PATCH /api/pages/:id/share error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);
