import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { z } from "zod";
import type { TenantContext } from "@/types/auth";

const updateOptionsSchema = z.object({
  allowIndexing: z.boolean(),
});

/** GET /api/pages/[id]/publish — Get publish status */
export const GET = withTenant(
  async (
    req: NextRequest,
    ctx: TenantContext,
    routeContext: { params: Promise<Record<string, string>> }
  ) => {
    const { id: pageId } = await routeContext.params;

    const link = await prisma.publicShareLink.findFirst({
      where: {
        pageId,
        tenantId: ctx.tenantId,
        revokedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!link) {
      return successResponse({
        is_published: false,
        share_token: null,
        url: null,
        published_at: null,
        allow_indexing: false,
      });
    }

    const baseUrl = req.headers.get("x-forwarded-host")
      ? `https://${req.headers.get("x-forwarded-host")}`
      : new URL(req.url).origin;

    return successResponse({
      is_published: true,
      share_token: link.token,
      url: `${baseUrl}/shared/${link.token}`,
      published_at: link.publishedAt?.toISOString() ?? link.createdAt.toISOString(),
      allow_indexing: link.allowIndexing,
    });
  }
);

/** POST /api/pages/[id]/publish — Publish a page (create or reactivate link) */
export const POST = withTenant(
  async (
    req: NextRequest,
    ctx: TenantContext,
    routeContext: { params: Promise<Record<string, string>> }
  ) => {
    const { id: pageId } = await routeContext.params;

    // Verify page exists
    const page = await prisma.page.findFirst({
      where: { id: pageId, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!page) {
      return errorResponse("NOT_FOUND", "Page not found", undefined, 404);
    }

    // Check for existing active link
    const existing = await prisma.publicShareLink.findFirst({
      where: {
        pageId,
        tenantId: ctx.tenantId,
        revokedAt: null,
      },
    });

    if (existing) {
      // Already published — return existing link
      const baseUrl = req.headers.get("x-forwarded-host")
        ? `https://${req.headers.get("x-forwarded-host")}`
        : new URL(req.url).origin;

      return successResponse({
        share_token: existing.token,
        url: `${baseUrl}/shared/${existing.token}`,
        published_at: existing.publishedAt?.toISOString() ?? existing.createdAt.toISOString(),
        allow_indexing: existing.allowIndexing,
      });
    }

    // Create new link with a random token
    const token = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
    const now = new Date();
    // Set expiry far in the future (10 years) for published links
    const expiresAt = new Date(now.getTime() + 10 * 365 * 24 * 60 * 60 * 1000);

    const link = await prisma.publicShareLink.create({
      data: {
        pageId,
        tenantId: ctx.tenantId,
        token,
        createdBy: ctx.userId,
        publishedAt: now,
        expiresAt,
      },
    });

    const baseUrl = req.headers.get("x-forwarded-host")
      ? `https://${req.headers.get("x-forwarded-host")}`
      : new URL(req.url).origin;

    return successResponse(
      {
        share_token: link.token,
        url: `${baseUrl}/shared/${link.token}`,
        published_at: link.publishedAt?.toISOString(),
        allow_indexing: link.allowIndexing,
      },
      undefined,
      201
    );
  }
);

/** DELETE /api/pages/[id]/publish — Unpublish a page */
export const DELETE = withTenant(
  async (
    req: NextRequest,
    ctx: TenantContext,
    routeContext: { params: Promise<Record<string, string>> }
  ) => {
    const { id: pageId } = await routeContext.params;

    // Revoke all active links for this page
    await prisma.publicShareLink.updateMany({
      where: {
        pageId,
        tenantId: ctx.tenantId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    return new NextResponse(null, { status: 204 });
  }
);

/** PATCH /api/pages/[id]/publish — Update publish options */
export const PATCH = withTenant(
  async (
    req: NextRequest,
    ctx: TenantContext,
    routeContext: { params: Promise<Record<string, string>> }
  ) => {
    const { id: pageId } = await routeContext.params;
    const body = await req.json();
    const parsed = updateOptionsSchema.safeParse(body);

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

    // Update the active link
    const link = await prisma.publicShareLink.findFirst({
      where: {
        pageId,
        tenantId: ctx.tenantId,
        revokedAt: null,
      },
    });

    if (!link) {
      return errorResponse("NOT_FOUND", "No active publish link found", undefined, 404);
    }

    const updated = await prisma.publicShareLink.update({
      where: { id: link.id },
      data: { allowIndexing: parsed.data.allowIndexing },
    });

    return successResponse({
      allow_indexing: updated.allowIndexing,
    });
  }
);
