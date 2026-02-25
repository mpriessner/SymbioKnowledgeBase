import { withTenant } from "@/lib/auth/withTenant";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/apiResponse";

/**
 * POST /api/workspaces/switch — switch to a different workspace.
 */
export const POST = withTenant(async (req, ctx) => {
  const { userId } = ctx;

  let body: { workspaceId?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("VALIDATION_ERROR", "Invalid JSON body");
  }

  const { workspaceId } = body;
  if (!workspaceId) {
    return errorResponse("VALIDATION_ERROR", "workspaceId is required");
  }

  // Verify user is a member of the target workspace
  const membership = await prisma.tenantMember.findUnique({
    where: {
      userId_tenantId: { userId, tenantId: workspaceId },
    },
    include: { tenant: true },
  });

  if (!membership) {
    return errorResponse("FORBIDDEN", "Access denied", undefined, 403);
  }

  // Set active workspace cookie
  const response = successResponse({
    id: membership.tenant.id,
    name: membership.tenant.name,
  });
  response.cookies.set("skb_active_workspace", workspaceId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
});
