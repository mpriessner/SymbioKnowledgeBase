import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { z } from "zod";
import type { TenantContext } from "@/types/auth";

const updateVisibilitySchema = z.object({
  teamspaceId: z.string().uuid().nullable(),
});

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
