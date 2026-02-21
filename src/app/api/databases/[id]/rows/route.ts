import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, listResponse, errorResponse } from "@/lib/apiResponse";
import { CreateRowSchema } from "@/types/database";
import type { DatabaseSchema } from "@/types/database";
import type { TenantContext } from "@/types/auth";
import {
  validateProperties,
  extractTitleFromProperties,
} from "@/lib/database/propertyValidators";
import { z } from "zod";

const dbIdSchema = z.string().uuid("Database ID must be a valid UUID");

/**
 * POST /api/databases/[id]/rows — Create a new row (also creates a linked page)
 */
export const POST = withTenant(
  async (req: NextRequest, context: TenantContext, { params }) => {
    try {
      const { id } = await params;
      const idParsed = dbIdSchema.safeParse(id);
      if (!idParsed.success) {
        return errorResponse("VALIDATION_ERROR", "Invalid database ID", undefined, 400);
      }

      const body = await req.json();

      const parseResult = CreateRowSchema.safeParse(body);
      if (!parseResult.success) {
        return errorResponse(
          "VALIDATION_ERROR",
          parseResult.error.issues[0]?.message ?? "Invalid request body",
          undefined,
          400
        );
      }

      // Fetch database and validate ownership
      const database = await prisma.database.findFirst({
        where: { id: idParsed.data, tenantId: context.tenantId },
      });

      if (!database) {
        return errorResponse("NOT_FOUND", "Database not found", undefined, 404);
      }

      const schema = database.schema as unknown as DatabaseSchema;

      // Validate properties against schema
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

      // Extract title from TITLE property for the auto-created page
      const pageTitle = extractTitleFromProperties(
        parseResult.data.properties,
        schema.columns
      );

      // Create page and row in a transaction
      const result = await prisma.$transaction(async (tx) => {
        const page = await tx.page.create({
          data: {
            title: pageTitle,
            tenantId: context.tenantId,
          },
        });

        const row = await tx.dbRow.create({
          data: {
            databaseId: idParsed.data,
            pageId: page.id,
            tenantId: context.tenantId,
            properties: JSON.parse(JSON.stringify(parseResult.data.properties)),
          },
        });

        return { row, page };
      });

      return successResponse(
        {
          id: result.row.id,
          databaseId: result.row.databaseId,
          pageId: result.row.pageId,
          tenantId: result.row.tenantId,
          properties: result.row.properties,
          page: {
            id: result.page.id,
            title: result.page.title,
            icon: result.page.icon,
          },
          createdAt: result.row.createdAt.toISOString(),
          updatedAt: result.row.updatedAt.toISOString(),
        },
        undefined,
        201
      );
    } catch (error) {
      console.error("POST /api/databases/[id]/rows error:", error);
      return errorResponse("INTERNAL_ERROR", "Internal server error", undefined, 500);
    }
  }
);

/**
 * GET /api/databases/[id]/rows — List all rows for a database
 */
export const GET = withTenant(
  async (_req: NextRequest, context: TenantContext, { params }) => {
    try {
      const { id } = await params;
      const idParsed = dbIdSchema.safeParse(id);
      if (!idParsed.success) {
        return errorResponse("VALIDATION_ERROR", "Invalid database ID", undefined, 400);
      }

      const database = await prisma.database.findFirst({
        where: { id: idParsed.data, tenantId: context.tenantId },
        select: { id: true },
      });

      if (!database) {
        return errorResponse("NOT_FOUND", "Database not found", undefined, 404);
      }

      const rows = await prisma.dbRow.findMany({
        where: { databaseId: idParsed.data, tenantId: context.tenantId },
        include: {
          page: { select: { id: true, title: true, icon: true } },
        },
        orderBy: { createdAt: "asc" },
      });

      const serialized = rows.map((row) => ({
        id: row.id,
        databaseId: row.databaseId,
        pageId: row.pageId,
        tenantId: row.tenantId,
        properties: row.properties,
        page: row.page,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }));

      return listResponse(serialized, serialized.length, serialized.length, 0);
    } catch (error) {
      console.error("GET /api/databases/[id]/rows error:", error);
      return errorResponse("INTERNAL_ERROR", "Internal server error", undefined, 500);
    }
  }
);
