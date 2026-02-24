import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { compareDocumentVersions } from "@/lib/livingDocs/versioning";
import { compareVersionsSchema } from "@/lib/validation/livingDocs";
import type { TenantContext } from "@/types/auth";
import { z } from "zod";

const pageIdSchema = z.string().uuid("Page ID must be a valid UUID");

export const GET = withTenant(
  async (req: NextRequest, ctx: TenantContext, { params }) => {
    try {
      const resolvedParams = await Promise.resolve(params);
      const idParsed = pageIdSchema.safeParse(resolvedParams?.id);

      if (!idParsed.success) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Invalid page ID",
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

      const { searchParams } = new URL(req.url);
      const queryParams = Object.fromEntries(searchParams.entries());
      const parsed = compareVersionsSchema.safeParse(queryParams);

      if (!parsed.success) {
        return errorResponse(
          "VALIDATION_ERROR",
          "v1 and v2 query parameters are required (positive integers)",
          undefined,
          400
        );
      }

      const result = await compareDocumentVersions(
        idParsed.data,
        ctx.tenantId,
        parsed.data.v1,
        parsed.data.v2
      );

      if (!result) {
        return errorResponse(
          "NOT_FOUND",
          "One or both versions not found",
          undefined,
          404
        );
      }

      return successResponse(result);
    } catch (error) {
      console.error("GET /api/pages/:id/history/compare error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);
