import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import type { TenantContext } from "@/types/auth";
import {
  savePageBlocks,
  markdownToTiptap,
} from "@/lib/markdown/helpers";
import { serializePage } from "@/lib/pages/serialize";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * POST /api/pages/import
 * Import a .md file as a new page.
 * Accepts multipart/form-data with a "file" field.
 */
export const POST = withTenant(
  async (req: NextRequest, context: TenantContext) => {
    try {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;

      if (!file || !file.name.endsWith(".md")) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Please upload a .md file",
          undefined,
          400
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return errorResponse(
          "VALIDATION_ERROR",
          "File too large (max 10MB)",
          undefined,
          400
        );
      }

      const markdown = await file.text();
      const { content, metadata } = markdownToTiptap(markdown);

      const page = await prisma.page.create({
        data: {
          tenantId: context.tenantId,
          title: metadata.title || "Untitled Import",
          icon: metadata.icon || null,
          parentId: metadata.parent || null,
        },
      });

      await savePageBlocks(page.id, context.tenantId, content);

      return successResponse(serializePage(page), undefined, 201);
    } catch (error) {
      console.error("POST /api/pages/import error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);
