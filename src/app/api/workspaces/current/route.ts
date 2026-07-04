import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import type { TenantContext } from "@/types/auth";

const renameWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

/**
 * PATCH /api/workspaces/current — rename the active workspace.
 *
 * The active workspace is `ctx.tenantId`, which getTenantContext already
 * resolves from the `skb_active_workspace` cookie (with membership check).
 *
 * Authorization: the caller's PER-WORKSPACE role must be owner or admin. This
 * queries TenantMember.role for (userId, tenantId) explicitly — `ctx.role` is
 * the GLOBAL dbUser.role and is the wrong scope here.
 */
export const PATCH = withTenant(async (req: NextRequest, ctx: TenantContext) => {
  const { userId, tenantId } = ctx;

  // Per-workspace role gate — do NOT use ctx.role (global scope).
  const membership = await prisma.tenantMember.findUnique({
    where: {
      userId_tenantId: { userId, tenantId },
    },
  });

  if (!membership) {
    return errorResponse("NOT_FOUND", "Workspace not found", undefined, 404);
  }

  if (membership.role !== "owner" && membership.role !== "admin") {
    return errorResponse(
      "FORBIDDEN",
      "Only workspace owners and admins can rename the workspace",
      undefined,
      403
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("VALIDATION_ERROR", "Invalid JSON body");
  }

  const parsed = renameWorkspaceSchema.safeParse(body);
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

  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data: { name: parsed.data.name },
  });

  return successResponse({
    id: updated.id,
    name: updated.name,
    createdAt: updated.createdAt,
  });
});
