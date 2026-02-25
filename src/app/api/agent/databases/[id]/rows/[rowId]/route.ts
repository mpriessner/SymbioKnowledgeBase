import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withAgentAuth } from "@/lib/agent/auth";
import type { AgentContext } from "@/lib/agent/auth";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { UpdateRowSchema } from "@/types/database";
import type { DatabaseSchema, RowProperties } from "@/types/database";
import {
  validateProperties,
  extractTitleFromProperties,
} from "@/lib/database/propertyValidators";
import { z } from "zod";

type RouteContext = { params: Promise<Record<string, string>> };

/**
 * PUT /api/agent/databases/:id/rows/:rowId — Update a row (partial merge)
 */
export const PUT = withAgentAuth(
  async (req: NextRequest, ctx: AgentContext, routeContext: RouteContext) => {
    try {
      const { id, rowId } = await routeContext.params;

      if (
        !z.string().uuid().safeParse(id).success ||
        !z.string().uuid().safeParse(rowId).success
      ) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Invalid database or row ID",
          undefined,
          400
        );
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

      // Fetch database for schema
      const database = await prisma.database.findFirst({
        where: { id, tenantId: ctx.tenantId },
      });

      if (!database) {
        return errorResponse(
          "NOT_FOUND",
          "Database not found",
          undefined,
          404
        );
      }

      // Fetch existing row
      const existingRow = await prisma.dbRow.findFirst({
        where: { id: rowId, databaseId: id, tenantId: ctx.tenantId },
      });

      if (!existingRow) {
        return errorResponse("NOT_FOUND", "Row not found", undefined, 404);
      }

      const schema = database.schema as unknown as DatabaseSchema;

      // Merge existing properties with new ones (partial update)
      const existingProps =
        (existingRow.properties as unknown as RowProperties) || {};
      const mergedProperties = { ...existingProps, ...parseResult.data.properties };

      // Validate merged properties
      const validation = validateProperties(mergedProperties, schema.columns);
      if (!validation.valid) {
        return errorResponse(
          "VALIDATION_ERROR",
          validation.errors.join("; "),
          undefined,
          400
        );
      }

      // Update row
      const updatedRow = await prisma.dbRow.update({
        where: { id: rowId },
        data: {
          properties: JSON.parse(JSON.stringify(mergedProperties)),
        },
      });

      // Sync page title if linked
      if (existingRow.pageId) {
        const pageTitle = extractTitleFromProperties(
          mergedProperties,
          schema.columns
        );
        await prisma.page.update({
          where: { id: existingRow.pageId },
          data: { title: pageTitle },
        });
      }

      return successResponse({
        id: updatedRow.id,
        properties: updatedRow.properties,
        updated_at: updatedRow.updatedAt.toISOString(),
      });
    } catch (error) {
      console.error("PUT /api/agent/databases/:id/rows/:rowId error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);

/**
 * DELETE /api/agent/databases/:id/rows/:rowId — Delete a row
 */
export const DELETE = withAgentAuth(
  async (_req: NextRequest, ctx: AgentContext, routeContext: RouteContext) => {
    try {
      const { id, rowId } = await routeContext.params;

      if (
        !z.string().uuid().safeParse(id).success ||
        !z.string().uuid().safeParse(rowId).success
      ) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Invalid database or row ID",
          undefined,
          400
        );
      }

      // Verify row exists and belongs to this database/tenant
      const row = await prisma.dbRow.findFirst({
        where: { id: rowId, databaseId: id, tenantId: ctx.tenantId },
      });

      if (!row) {
        return errorResponse("NOT_FOUND", "Row not found", undefined, 404);
      }

      await prisma.dbRow.delete({ where: { id: rowId } });

      return successResponse({
        id: rowId,
        deleted_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        "DELETE /api/agent/databases/:id/rows/:rowId error:",
        error
      );
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);
