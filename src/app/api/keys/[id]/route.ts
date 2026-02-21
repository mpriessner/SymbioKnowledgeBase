import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import type { TenantContext } from "@/types/auth";

// DELETE /api/keys/:id — Revoke an API key (soft delete)
export const DELETE = withTenant(
  async (
    _req: NextRequest,
    ctx: TenantContext,
    routeContext: { params: Promise<Record<string, string>> }
  ) => {
    const { id } = await routeContext.params;

    // Find the key (scoped to user and tenant)
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        id,
        userId: ctx.userId,
        tenantId: ctx.tenantId,
      },
    });

    if (!apiKey) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "API key not found",
          },
          meta: { timestamp: new Date().toISOString() },
        },
        { status: 404 }
      );
    }

    if (apiKey.revokedAt) {
      return NextResponse.json(
        {
          error: {
            code: "CONFLICT",
            message: "API key is already revoked",
          },
          meta: { timestamp: new Date().toISOString() },
        },
        { status: 409 }
      );
    }

    // Soft-delete by setting revokedAt
    const revokedKey = await prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    return NextResponse.json({
      data: {
        id: revokedKey.id,
        name: revokedKey.name,
        revokedAt: revokedKey.revokedAt!.toISOString(),
      },
      meta: { timestamp: new Date().toISOString() },
    });
  }
);
