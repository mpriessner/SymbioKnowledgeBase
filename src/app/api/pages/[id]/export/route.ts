import { NextRequest } from "next/server";
import { withTenant } from "@/lib/auth/withTenant";
import { errorResponse } from "@/lib/apiResponse";
import type { TenantContext } from "@/types/auth";
import {
  fetchPageWithBlocks,
  pageToMarkdown,
  slugify,
} from "@/lib/markdown/helpers";
import { z } from "zod";

const pageIdSchema = z.string().uuid("Page ID must be a valid UUID");

/**
 * GET /api/pages/:id/export
 * Downloads a single page as a .md file.
 */
export const GET = withTenant(
  async (
    req: NextRequest,
    context: TenantContext,
    { params }
  ) => {
    try {
      const { id } = await params;
      const idParsed = pageIdSchema.safeParse(id);
      if (!idParsed.success) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Invalid page ID",
          undefined,
          400
        );
      }

      const page = await fetchPageWithBlocks(
        idParsed.data,
        context.tenantId
      );
      if (!page) {
        return errorResponse(
          "NOT_FOUND",
          "Page not found",
          undefined,
          404
        );
      }

      const markdown = pageToMarkdown(page);
      const fileName = `${slugify(page.title)}.md`;

      return new Response(markdown, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="${fileName}"`,
        },
      });
    } catch (error) {
      console.error("GET /api/pages/[id]/export error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);
