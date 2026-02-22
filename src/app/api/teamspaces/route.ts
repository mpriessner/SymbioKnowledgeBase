import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import {
  successResponse,
  listResponse,
  errorResponse,
} from "@/lib/apiResponse";
import { z } from "zod";
import type { TenantContext } from "@/types/auth";

const createTeamspaceSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  icon: z.string().nullable().optional(),
});

// POST /api/teamspaces — Create a teamspace
export const POST = withTenant(
  async (req: NextRequest, ctx: TenantContext) => {
    try {
      const body = await req.json();
      const parsed = createTeamspaceSchema.safeParse(body);

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

      const { name, icon } = parsed.data;

      // Check for duplicate name within tenant
      const existing = await prisma.teamspace.findUnique({
        where: {
          tenantId_name: { tenantId: ctx.tenantId, name },
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

      // Create teamspace and add creator as OWNER in a transaction
      const teamspace = await prisma.$transaction(async (tx) => {
        const ts = await tx.teamspace.create({
          data: {
            tenantId: ctx.tenantId,
            name,
            icon: icon ?? null,
          },
        });

        await tx.teamspaceMember.create({
          data: {
            teamspaceId: ts.id,
            userId: ctx.userId,
            role: "OWNER",
          },
        });

        return ts;
      });

      return successResponse(
        {
          id: teamspace.id,
          name: teamspace.name,
          icon: teamspace.icon,
          created_at: teamspace.createdAt.toISOString(),
          role: "OWNER",
        },
        undefined,
        201
      );
    } catch (error) {
      console.error("POST /api/teamspaces error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);

// GET /api/teamspaces — List user's teamspaces
export const GET = withTenant(
  async (_req: NextRequest, ctx: TenantContext) => {
    try {
      const memberships = await prisma.teamspaceMember.findMany({
        where: { userId: ctx.userId },
        include: {
          teamspace: {
            include: {
              _count: { select: { members: true, pages: true } },
            },
          },
        },
        orderBy: { teamspace: { name: "asc" } },
      });

      const data = memberships.map((m) => ({
        id: m.teamspace.id,
        name: m.teamspace.name,
        icon: m.teamspace.icon,
        role: m.role,
        member_count: m.teamspace._count.members,
        page_count: m.teamspace._count.pages,
        created_at: m.teamspace.createdAt.toISOString(),
      }));

      return listResponse(data, data.length, data.length, 0);
    } catch (error) {
      console.error("GET /api/teamspaces error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);
