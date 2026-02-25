import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { z } from "zod";
import type { TenantContext } from "@/types/auth";

const updateAccessSchema = z.object({
  generalAccess: z.enum(["INVITED_ONLY", "ANYONE_WITH_LINK"]),
});

/** PATCH /api/pages/[id]/access — Update general access level */
export const PATCH = withTenant(
  async (
    req: NextRequest,
    ctx: TenantContext,
    routeContext: { params: Promise<Record<string, string>> }
  ) => {
    const { id: pageId } = await routeContext.params;
    const body = await req.json();
    const parsed = updateAccessSchema.safeParse(body);

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
      select: { id: true },
    });
    if (!page) {
      return errorResponse("NOT_FOUND", "Page not found", undefined, 404);
    }

    const updated = await prisma.page.update({
      where: { id: pageId },
      data: { generalAccess: parsed.data.generalAccess },
    });

    return successResponse({
      general_access: updated.generalAccess,
    });
  }
);
