import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { UpdateRowSchema } from "@/types/database";
import type { DatabaseSchema } from "@/types/database";
import type { TenantContext } from "@/types/auth";
import {
  validateProperties,
  extractTitleFromProperties,
} from "@/lib/database/propertyValidators";
import { z } from "zod";

const dbIdSchema = z.string().uuid("Database ID must be a valid UUID");
const rowIdSchema = z.string().uuid("Row ID must be a valid UUID");

/**
 * GET /api/databases/[id]/rows/[rowId]
 */
export const GET = withTenant(
  async (_req: NextRequest, context: TenantContext, { params }) => {
    try {
      const { id, rowId } = await params;
      const idParsed = dbIdSchema.safeParse(id);
      const rowIdParsed = rowIdSchema.safeParse(rowId);
      if (!idParsed.success || !rowIdParsed.success) {
        return errorResponse("VALIDATION_ERROR", "Invalid ID", undefined, 400);
      }

      const row = await prisma.dbRow.findFirst({
        where: {
          id: rowIdParsed.data,
          databaseId: idParsed.data,
          tenantId: context.tenantId,
        },
        include: {
          page: { select: { id: true, title: true, icon: true } },
        },
      });

      if (!row) {
        return errorResponse("NOT_FOUND", "Row not found", undefined, 404);
      }

      return successResponse({
        id: row.id,
        databaseId: row.databaseId,
        pageId: row.pageId,
        tenantId: row.tenantId,
        properties: row.properties,
        page: row.page,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      });
    } catch (error) {
      console.error("GET /api/databases/[id]/rows/[rowId] error:", error);
      return errorResponse("INTERNAL_ERROR", "Internal server error", undefined, 500);
    }
  }
);

/**
 * PUT /api/databases/[id]/rows/[rowId]
 */
export const PUT = withTenant(
  async (req: NextRequest, context: TenantContext, { params }) => {
    try {
      const { id, rowId } = await params;
      const idParsed = dbIdSchema.safeParse(id);
      const rowIdParsed = rowIdSchema.safeParse(rowId);
      if (!idParsed.success || !rowIdParsed.success) {
        return errorResponse("VALIDATION_ERROR", "Invalid ID", undefined, 400);
      }

      const body = await req.json();

      const parseResult = UpdateRowSchema.safeParse(body);
      if (!parseResult.success) {
        return errorResponse(
          "VALIDATION_ERROR",
          parseResult.error.issues[0]?.message ?? "Invalid request body",
          undefined,
          400
        );
      }

      // Fetch database schema for validation
      const database = await prisma.database.findFirst({
        where: { id: idParsed.data, tenantId: context.tenantId },
      });

      if (!database) {
        return errorResponse("NOT_FOUND", "Database not found", undefined, 404);
      }

      const schema = database.schema as unknown as DatabaseSchema;
      const validation = validateProperties(
        parseResult.data.properties,
        schema.columns
      );
      if (!validation.valid) {
        return errorResponse(
          "VALIDATION_ERROR",
          validation.errors.join("; "),
          undefined,
          400
        );
      }

      // Verify the row exists
      const existingRow = await prisma.dbRow.findFirst({
        where: {
          id: rowIdParsed.data,
          databaseId: idParsed.data,
          tenantId: context.tenantId,
        },
      });
      if (!existingRow) {
        return errorResponse("NOT_FOUND", "Row not found", undefined, 404);
      }

      // Update row and sync page title
      const pageTitle = extractTitleFromProperties(
        parseResult.data.properties,
        schema.columns
      );

      const result = await prisma.$transaction(async (tx) => {
        const updatedRow = await tx.dbRow.update({
          where: { id: rowIdParsed.data },
          data: {
            properties: JSON.parse(JSON.stringify(parseResult.data.properties)),
          },
        });

        // Sync page title with TITLE property
        if (updatedRow.pageId) {
          await tx.page.update({
            where: { id: updatedRow.pageId },
            data: { title: pageTitle },
          });
        }

        return updatedRow;
      });

      return successResponse({
        id: result.id,
        databaseId: result.databaseId,
        pageId: result.pageId,
        tenantId: result.tenantId,
        properties: result.properties,
        createdAt: result.createdAt.toISOString(),
        updatedAt: result.updatedAt.toISOString(),
      });
    } catch (error) {
      console.error("PUT /api/databases/[id]/rows/[rowId] error:", error);
      return errorResponse("INTERNAL_ERROR", "Internal server error", undefined, 500);
    }
  }
);

/**
 * DELETE /api/databases/[id]/rows/[rowId]
 */
export const DELETE = withTenant(
  async (_req: NextRequest, context: TenantContext, { params }) => {
    try {
      const { id, rowId } = await params;
      const idParsed = dbIdSchema.safeParse(id);
      const rowIdParsed = rowIdSchema.safeParse(rowId);
      if (!idParsed.success || !rowIdParsed.success) {
        return errorResponse("VALIDATION_ERROR", "Invalid ID", undefined, 400);
      }

      const row = await prisma.dbRow.findFirst({
        where: {
          id: rowIdParsed.data,
          databaseId: idParsed.data,
          tenantId: context.tenantId,
        },
      });

      if (!row) {
        return errorResponse("NOT_FOUND", "Row not found", undefined, 404);
      }

      await prisma.dbRow.delete({ where: { id: rowIdParsed.data } });

      return new Response(null, { status: 204 });
    } catch (error) {
      console.error("DELETE /api/databases/[id]/rows/[rowId] error:", error);
      return errorResponse("INTERNAL_ERROR", "Internal server error", undefined, 500);
    }
  }
);
