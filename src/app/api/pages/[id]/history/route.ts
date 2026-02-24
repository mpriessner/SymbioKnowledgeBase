import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { listResponse, errorResponse } from "@/lib/apiResponse";
import { listDocumentVersions } from "@/lib/livingDocs/versioning";
import { listHistoryQuerySchema } from "@/lib/validation/livingDocs";
import type { TenantContext } from "@/types/auth";
import { z } from "zod";

const pageIdSchema = z.string().uuid("Page ID must be a valid UUID");

export const GET = withTenant(
  async (req: NextRequest, ctx: TenantContext, { params }) => {
    try {
      const resolvedParams = await Promise.resolve(params);
      const idRaw =
        typeof resolvedParams?.id === "string" ? resolvedParams.id : "";
      const idParsed = pageIdSchema.safeParse(idRaw);

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
      const parsed = listHistoryQuerySchema.safeParse(queryParams);

      if (!parsed.success) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Invalid query parameters",
          undefined,
          400
        );
      }

      const { limit, offset } = parsed.data;
      const { versions, total } = await listDocumentVersions(
        idParsed.data,
        ctx.tenantId,
        limit,
        offset
      );

      return listResponse(versions, total, limit, offset);
    } catch (error) {
      console.error("GET /api/pages/:id/history error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);
