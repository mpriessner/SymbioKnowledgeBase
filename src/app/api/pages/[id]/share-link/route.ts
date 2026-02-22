import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { z } from "zod";
import { randomBytes } from "crypto";
import type { TenantContext } from "@/types/auth";

const generateLinkSchema = z.object({
  expiresInDays: z.number().int().min(1).max(365).default(30),
});

// POST /api/pages/:id/share-link — Generate a public share link
export const POST = withTenant(
  async (
    req: NextRequest,
    ctx: TenantContext,
    routeContext: { params: Promise<Record<string, string>> }
  ) => {
    try {
      const { id: pageId } = await routeContext.params;

      const body = await req.json();
      const parsed = generateLinkSchema.safeParse(body);

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

      const token = randomBytes(16).toString("hex");
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + parsed.data.expiresInDays);

      const shareLink = await prisma.publicShareLink.create({
        data: {
          pageId,
          tenantId: ctx.tenantId,
          token,
          createdBy: ctx.userId,
          expiresAt,
        },
      });

      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const url = `${baseUrl}/shared/${token}`;

      return successResponse(
        {
          token: shareLink.token,
          url,
          expires_at: shareLink.expiresAt.toISOString(),
        },
        undefined,
        201
      );
    } catch (error) {
      console.error("POST /api/pages/:id/share-link error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);

// DELETE /api/pages/:id/share-link — Revoke a share link by token
export const DELETE = withTenant(
  async (
    req: NextRequest,
    ctx: TenantContext,
    routeContext: { params: Promise<Record<string, string>> }
  ) => {
    try {
      const { id: pageId } = await routeContext.params;
      const { searchParams } = new URL(req.url);
      const token = searchParams.get("token");

      if (!token) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Token query parameter is required",
          undefined,
          400
        );
      }

      const shareLink = await prisma.publicShareLink.findFirst({
        where: {
          token,
          pageId,
          tenantId: ctx.tenantId,
          revokedAt: null,
        },
      });

      if (!shareLink) {
        return errorResponse(
          "NOT_FOUND",
          "Share link not found",
          undefined,
          404
        );
      }

      await prisma.publicShareLink.update({
        where: { id: shareLink.id },
        data: { revokedAt: new Date() },
      });

      return successResponse({ revoked: true });
    } catch (error) {
      console.error("DELETE /api/pages/:id/share-link error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);
