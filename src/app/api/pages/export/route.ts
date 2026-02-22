import { NextRequest } from "next/server";
import JSZip from "jszip";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { errorResponse } from "@/lib/apiResponse";
import type { TenantContext } from "@/types/auth";
import { pageToMarkdown, slugify } from "@/lib/markdown/helpers";

/**
 * GET /api/pages/export?format=zip
 * Bulk export all tenant pages as a zip of .md files.
 */
export const GET = withTenant(
  async (req: NextRequest, context: TenantContext) => {
    try {
      const pages = await prisma.page.findMany({
        where: { tenantId: context.tenantId },
        include: {
          blocks: { orderBy: { position: "asc" } },
        },
        take: 1000, // Safety limit
      });

      if (pages.length === 0) {
        return errorResponse(
          "NOT_FOUND",
          "No pages to export",
          undefined,
          404
        );
      }

      const zip = new JSZip();

      // Build page hierarchy map: pageId → page
      const pageMap = new Map(pages.map((p) => [p.id, p]));

      function getPath(
        page: (typeof pages)[number]
      ): string {
        const parts: string[] = [];
        let current: (typeof pages)[number] | undefined = page;
        while (current) {
          parts.unshift(slugify(current.title));
          current = current.parentId
            ? pageMap.get(current.parentId)
            : undefined;
        }
        return parts.join("/");
      }

      for (const page of pages) {
        const markdown = pageToMarkdown(page);
        const folderPath = getPath(page);
        // Pages with children become folder/index.md
        const hasChildren = pages.some(
          (p) => p.parentId === page.id
        );
        const filePath = hasChildren
          ? `${folderPath}/index.md`
          : `${folderPath}.md`;
        zip.file(filePath, markdown);
      }

      const zipBuffer = await zip.generateAsync({
        type: "uint8array",
      });

      return new Response(zipBuffer as unknown as BodyInit, {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition":
            'attachment; filename="knowledge-base-export.zip"',
        },
      });
    } catch (error) {
      console.error("GET /api/pages/export error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);
