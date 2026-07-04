import { NextRequest } from "next/server";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { duplicatePage } from "@/lib/pages/duplicatePage";
import type { TenantContext } from "@/types/auth";
import { z } from "zod";

const pageIdSchema = z.string().uuid("Page ID must be a valid UUID");

const duplicateBodySchema = z.object({
  includeChildren: z.boolean().optional().default(true),
});

export const POST = withTenant(
  async (req: NextRequest, context: TenantContext, { params }) => {
    try {
      const { id } = await params;
      const idParsed = pageIdSchema.safeParse(id);
      if (!idParsed.success) {
        return errorResponse("VALIDATION_ERROR", "Invalid page ID", undefined, 400);
      }

      // Body is optional; when absent, includeChildren defaults to true.
      let includeChildren = true;
      const raw = await req.text();
      if (raw.trim().length > 0) {
        let json: unknown;
        try {
          json = JSON.parse(raw);
        } catch {
          return errorResponse(
            "VALIDATION_ERROR",
            "Invalid request body",
            undefined,
            400
          );
        }
        const parsed = duplicateBodySchema.safeParse(json);
        if (!parsed.success) {
          return errorResponse(
            "VALIDATION_ERROR",
            "Invalid request body",
            undefined,
            400
          );
        }
        includeChildren = parsed.data.includeChildren;
      }

      const result = await duplicatePage(context.tenantId, idParsed.data, {
        includeChildren,
      });

      if (!result.ok) {
        if (result.code === "NOT_FOUND") {
          return errorResponse("NOT_FOUND", "Page not found", undefined, 404);
        }
        // CAP_EXCEEDED — reject the whole clone; nothing was persisted.
        return errorResponse(
          "PAYLOAD_TOO_LARGE",
          `Cannot duplicate more than ${result.cap} pages at once (this subtree has ${result.count}). Nothing was copied.`,
          undefined,
          413
        );
      }

      return successResponse(
        {
          id: result.rootId,
          pageCount: result.pageCount,
          databaseSkipped: result.databaseSkipped,
        },
        undefined,
        201
      );
    } catch (error) {
      console.error("POST /api/pages/[id]/duplicate error:", error);
      return errorResponse("INTERNAL_ERROR", "Internal server error", undefined, 500);
    }
  }
);
