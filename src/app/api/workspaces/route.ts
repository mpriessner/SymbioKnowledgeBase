import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/withTenant";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/apiResponse";

/**
 * GET /api/workspaces — list workspaces the current user belongs to.
 */
export const GET = withTenant(async (req, ctx) => {
  const { userId, tenantId } = ctx;

  // Ensure user has a TenantMember record for their primary tenant
  await prisma.tenantMember.upsert({
    where: {
      userId_tenantId: { userId, tenantId },
    },
    update: {},
    create: {
      userId,
      tenantId,
      role: "owner",
    },
  });

  const memberships = await prisma.tenantMember.findMany({
    where: { userId },
    include: {
      tenant: {
        include: {
          _count: { select: { members: true } },
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });

  // Check for active workspace cookie
  const activeCookie = req.cookies.get("skb_active_workspace")?.value;
  const activeId = activeCookie ?? tenantId;

  const data = memberships.map((m) => ({
    id: m.tenant.id,
    name: m.tenant.name,
    plan: "Free Plan",
    memberCount: m.tenant._count.members,
    isCurrent: m.tenant.id === activeId,
    role: m.role,
  }));

  return NextResponse.json({ data });
});

/**
 * POST /api/workspaces — create a new workspace.
 */
export const POST = withTenant(async (req, ctx) => {
  const { userId } = ctx;

  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("VALIDATION_ERROR", "Invalid JSON body");
  }

  const name = body.name?.trim();
  if (!name || name.length < 2) {
    return errorResponse("VALIDATION_ERROR", "Name must be at least 2 characters");
  }
  if (name.length > 50) {
    return errorResponse("VALIDATION_ERROR", "Name must be 50 characters or less");
  }

  // Create tenant + membership in a transaction
  const tenant = await prisma.tenant.create({
    data: {
      name,
      members: {
        create: { userId, role: "owner" },
      },
    },
  });

  // Set active workspace cookie
  const response = successResponse(
    { id: tenant.id, name: tenant.name, createdAt: tenant.createdAt },
    undefined,
    201
  );
  response.cookies.set("skb_active_workspace", tenant.id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });

  return response;
});
