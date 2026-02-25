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

  // Create tenant + membership + welcome page in a transaction
  const tenant = await prisma.$transaction(async (tx) => {
    const newTenant = await tx.tenant.create({
      data: {
        name,
        members: {
          create: { userId, role: "owner" },
        },
      },
    });

    // Create a default welcome page so the workspace isn't empty
    const welcomePage = await tx.page.create({
      data: {
        tenantId: newTenant.id,
        title: `Welcome to ${name}`,
        icon: "👋",
        position: 0,
      },
    });

    // Create a DOCUMENT block with welcome content
    await tx.block.create({
      data: {
        tenantId: newTenant.id,
        pageId: welcomePage.id,
        type: "DOCUMENT",
        content: {
          type: "doc",
          content: [
            {
              type: "heading",
              attrs: { level: 1 },
              content: [{ type: "text", text: `Welcome to ${name}` }],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "This is your new workspace. Start creating pages to organize your knowledge.",
                },
              ],
            },
          ],
        },
        position: 0,
      },
    });

    return newTenant;
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
