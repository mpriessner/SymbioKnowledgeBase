import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import {
  getDocumentVersion,
  restoreDocumentVersion,
} from "@/lib/livingDocs/versioning";
import type { TenantContext } from "@/types/auth";
import { z } from "zod";

const pageIdSchema = z.string().uuid("Page ID must be a valid UUID");
const versionSchema = z.coerce.number().int().min(1);

export const GET = withTenant(
  async (_req: NextRequest, ctx: TenantContext, { params }) => {
    try {
      const resolvedParams = await Promise.resolve(params);
      const idParsed = pageIdSchema.safeParse(resolvedParams?.id);
      const versionParsed = versionSchema.safeParse(resolvedParams?.version);

      if (!idParsed.success || !versionParsed.success) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Invalid page ID or version",
          undefined,
          400
        );
      }

      const page = await prisma.page.findFirst({
        where: { id: idParsed.data, tenantId: ctx.tenantId },
        select: { id: true },
      });

      if (!page) {
        return errorResponse("NOT_FOUND", "Page not found", undefined, 404);
      }

      const version = await getDocumentVersion(
        idParsed.data,
        ctx.tenantId,
        versionParsed.data
      );

      if (!version) {
        return errorResponse(
          "NOT_FOUND",
          "Version not found",
          undefined,
          404
        );
      }

      return successResponse({
        id: version.id,
        version: version.version,
        content: version.content,
        plain_text: version.plainText,
        change_type: version.changeType,
        change_source: version.changeSource,
        change_notes: version.changeNotes,
        diff_from_prev: version.diffFromPrev,
        created_at: version.createdAt.toISOString(),
      });
    } catch (error) {
      console.error("GET /api/pages/:id/history/:version error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);

export const POST = withTenant(
  async (_req: NextRequest, ctx: TenantContext, { params }) => {
    try {
      const resolvedParams = await Promise.resolve(params);
      const idParsed = pageIdSchema.safeParse(resolvedParams?.id);
      const versionParsed = versionSchema.safeParse(resolvedParams?.version);

      if (!idParsed.success || !versionParsed.success) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Invalid page ID or version",
          undefined,
          400
        );
      }

      const page = await prisma.page.findFirst({
        where: { id: idParsed.data, tenantId: ctx.tenantId },
        select: { id: true },
      });

      if (!page) {
        return errorResponse("NOT_FOUND", "Page not found", undefined, 404);
      }

      const restored = await restoreDocumentVersion(
        idParsed.data,
        ctx.tenantId,
        versionParsed.data,
        ctx.userId
      );

      if (!restored) {
        return errorResponse(
          "NOT_FOUND",
          "Version not found",
          undefined,
          404
        );
      }

      return successResponse(
        {
          id: restored.id,
          version: restored.version,
          change_type: restored.changeType,
          change_notes: restored.changeNotes,
          created_at: restored.createdAt.toISOString(),
        },
        undefined,
        201
      );
    } catch (error) {
      console.error("POST /api/pages/:id/history/:version error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);
